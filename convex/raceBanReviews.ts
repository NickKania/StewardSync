import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUserRole } from "./lib/auth";
import { UserFacingError } from "./lib/errors";

const STAFF_ROLES = new Set([
  "head_steward",
  "event_manager",
  "league_manager",
]);
const REVIEW_MANAGER_ROLES = new Set(["head_steward", "league_manager"]);
const ONE_HOUR_MS = 60 * 60 * 1000;
const SEND_MEETING_REMINDER_FN = "raceBanReviewDiscord:sendMeetingReminder" as any;
const CREATE_MEETING_THREAD_POST_FN =
  "raceBanReviewDiscord:createOrUpdateMeetingThreadPost" as any;

const normalizeAvailabilityWindows = (
  availabilityWindows: Array<{ startAt: number; endAt: number }>,
) => {
  const normalized = availabilityWindows
    .map((window) => ({
      startAt: window.startAt,
      endAt: window.endAt,
    }))
    .filter((window) => Number.isFinite(window.startAt) && Number.isFinite(window.endAt))
    .filter((window) => window.endAt > window.startAt)
    .sort((a, b) => a.startAt - b.startAt);

  if (normalized.length === 0) {
    throw new UserFacingError("Please provide at least one valid date/time range.");
  }

  return normalized;
};

const getLinkedReviewForPenalty = async (ctx: any, penalty: any) => {
  if (penalty.raceBanReviewId) {
    const linked = await ctx.db.get(penalty.raceBanReviewId);
    if (linked) {
      return linked;
    }
  }

  return await ctx.db
    .query("raceBanReviews")
    .withIndex("by_driver_series_penalty", (q: any) =>
      q.eq("driverSeriesPenaltyId", penalty._id),
    )
    .first();
};

const canManageReview = (role: string) => REVIEW_MANAGER_ROLES.has(role);

const formatMeetingWindow = (startAt: number, endAt?: number) => {
  const meetingStartLabel = new Date(startAt).toLocaleString("en-US", {
    dateStyle: "full",
    timeStyle: "short",
  });
  if (!endAt) {
    return meetingStartLabel;
  }
  const meetingEndLabel = new Date(endAt).toLocaleString("en-US", {
    timeStyle: "short",
  });
  return `${meetingStartLabel} - ${meetingEndLabel}`;
};

export const getDriverRequirement = query({
  args: {
    driverSeriesPenaltyId: v.id("driverSeriesPenalties"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const penalty = await ctx.db.get(args.driverSeriesPenaltyId);
    if (!penalty) {
      return null;
    }

    const [driver, threshold, seriesPenalty] = await Promise.all([
      ctx.db.get(penalty.driverId),
      ctx.db.get(penalty.seriesPenaltyThresholdId),
      ctx.db.get(penalty.seriesPenaltyId),
    ]);

    if (!driver || !threshold || !seriesPenalty) {
      return null;
    }

    const requiresReview =
      penalty.requiresReview ?? threshold.requiresReview ?? false;
    if (!requiresReview) {
      return null;
    }

    const role = await getCurrentUserRole(ctx, args.userId);
    const isOwner = driver.userId === args.userId;
    if (!isOwner && !STAFF_ROLES.has(role)) {
      throw new UserFacingError("You do not have access to this review request.");
    }

    const existingRequest = await getLinkedReviewForPenalty(ctx, penalty);

    return {
      driverSeriesPenaltyId: penalty._id,
      isServed: penalty.isServed,
      driver: {
        _id: driver._id,
        driverName: driver.driverName,
        driverNumber: driver.driverNumber,
      },
      penalty: {
        _id: seriesPenalty._id,
        penaltyName: seriesPenalty.penaltyName,
      },
      threshold: {
        _id: threshold._id,
        threshold: threshold.threshold,
        requiresReview,
      },
      existingRequest: existingRequest
        ? {
            _id: existingRequest._id,
            status: existingRequest.status,
            availabilityWindows: existingRequest.availabilityWindows,
            selectedMeetingStartAt: existingRequest.selectedMeetingStartAt ?? null,
            selectedMeetingEndAt: existingRequest.selectedMeetingEndAt ?? null,
          }
        : null,
    };
  },
});

export const createOrUpdateRequest = mutation({
  args: {
    driverSeriesPenaltyId: v.id("driverSeriesPenalties"),
    userId: v.id("users"),
    availabilityWindows: v.array(
      v.object({
        startAt: v.number(),
        endAt: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const availabilityWindows = normalizeAvailabilityWindows(args.availabilityWindows);
    const penalty = await ctx.db.get(args.driverSeriesPenaltyId);
    if (!penalty) {
      throw new UserFacingError("Penalty assignment not found.");
    }

    const [driver, threshold] = await Promise.all([
      ctx.db.get(penalty.driverId),
      ctx.db.get(penalty.seriesPenaltyThresholdId),
    ]);

    if (!driver || !threshold) {
      throw new UserFacingError("Unable to load penalty details.");
    }

    const requiresReview =
      penalty.requiresReview ?? threshold.requiresReview ?? false;
    if (!requiresReview) {
      throw new UserFacingError("This penalty does not require a review meeting.");
    }

    const role = await getCurrentUserRole(ctx, args.userId);
    const isOwner = driver.userId === args.userId;
    if (!isOwner && !STAFF_ROLES.has(role)) {
      throw new UserFacingError("You can only submit review availability for your own profile.");
    }

    const now = Date.now();
    const existingRequest = await getLinkedReviewForPenalty(ctx, penalty);

    if (existingRequest) {
      if (existingRequest.status === "completed") {
        throw new UserFacingError("This review request has already been completed.");
      }

      if (existingRequest.status === "scheduled") {
        throw new UserFacingError(
          "A meeting has already been scheduled. Please contact a head steward to reschedule.",
        );
      }

      await ctx.db.patch(existingRequest._id, {
        availabilityWindows,
        updatedAt: now,
      });

      if (penalty.raceBanReviewId !== existingRequest._id) {
        await ctx.db.patch(penalty._id, {
          raceBanReviewId: existingRequest._id,
          requiresReview,
        });
      }

      return {
        requestId: existingRequest._id,
        created: false,
      };
    }

    const requestId = await ctx.db.insert("raceBanReviews", {
      driverSeriesPenaltyId: penalty._id,
      driverId: penalty.driverId,
      userId: args.userId,
      seriesId: penalty.seriesId,
      seriesPenaltyId: penalty.seriesPenaltyId,
      seriesPenaltyThresholdId: penalty.seriesPenaltyThresholdId,
      status: "open",
      availabilityWindows,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(penalty._id, {
      raceBanReviewId: requestId,
      requiresReview,
    });

    return {
      requestId,
      created: true,
    };
  },
});

export const listPendingRequests = query({
  args: {
    seriesId: v.optional(v.id("series")),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const role = await getCurrentUserRole(ctx, args.userId);
    if (!STAFF_ROLES.has(role)) {
      throw new UserFacingError("You do not have access to race review requests.");
    }

    const requests = args.seriesId
      ? await ctx.db
          .query("raceBanReviews")
          .withIndex("by_series", (q) => q.eq("seriesId", args.seriesId as any))
          .collect()
      : await ctx.db.query("raceBanReviews").collect();

    const pendingRequests = requests.filter((request) => request.status !== "completed");

    const rows = await Promise.all(
      pendingRequests.map(async (request) => {
        const [driver, seriesPenalty, series, threshold] = await Promise.all([
          ctx.db.get(request.driverId),
          ctx.db.get(request.seriesPenaltyId),
          ctx.db.get(request.seriesId),
          ctx.db.get(request.seriesPenaltyThresholdId),
        ]);

        const driverUser = driver?.userId
          ? await ctx.db.get(driver.userId)
          : null;
        const driverName =
          driverUser?.officialName || driver?.driverName || "Unknown Driver";

        return {
          _id: request._id,
          driverSeriesPenaltyId: request.driverSeriesPenaltyId,
          status: request.status,
          createdAt: request.createdAt,
          selectedMeetingStartAt: request.selectedMeetingStartAt ?? null,
          selectedMeetingEndAt: request.selectedMeetingEndAt ?? null,
          availabilityCount: request.availabilityWindows.length,
          driverName,
          driverNumber: driver?.driverNumber ?? null,
          penaltyName: seriesPenalty?.penaltyName ?? "Unknown Penalty",
          threshold: threshold?.threshold ?? null,
          seriesName: series?.name ?? "Unknown Series",
        };
      }),
    );

    return rows.sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === "open" ? -1 : 1;
      }
      return a.createdAt - b.createdAt;
    });
  },
});

export const listOutstandingRequirements = query({
  args: {
    seriesId: v.optional(v.id("series")),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const role = await getCurrentUserRole(ctx, args.userId);
    if (!STAFF_ROLES.has(role)) {
      throw new UserFacingError("You do not have access to race review requirements.");
    }

    const penalties = args.seriesId
      ? await ctx.db
          .query("driverSeriesPenalties")
          .withIndex("by_series", (q) => q.eq("seriesId", args.seriesId as any))
          .collect()
      : await ctx.db.query("driverSeriesPenalties").collect();

    const rows = await Promise.all(
      penalties.map(async (penalty) => {
        const [driver, seriesPenalty, series, threshold] = await Promise.all([
          ctx.db.get(penalty.driverId),
          ctx.db.get(penalty.seriesPenaltyId),
          ctx.db.get(penalty.seriesId),
          ctx.db.get(penalty.seriesPenaltyThresholdId),
        ]);

        if (!driver || !seriesPenalty || !series || !threshold) {
          return null;
        }

        const requiresReview =
          penalty.requiresReview ?? threshold.requiresReview ?? false;
        if (!requiresReview) {
          return null;
        }

        const linkedRequest = await getLinkedReviewForPenalty(ctx, penalty);
        if (linkedRequest?.status === "completed") {
          return null;
        }

        const status = !linkedRequest
          ? "missing_request"
          : linkedRequest.status === "scheduled"
            ? "scheduled"
            : "open";

        const driverUser = driver?.userId
          ? await ctx.db.get(driver.userId)
          : null;
        const driverName =
          driverUser?.officialName || driver.driverName || "Unknown Driver";

        return {
          driverSeriesPenaltyId: penalty._id,
          reviewRequestId: linkedRequest?._id ?? null,
          seriesName: series.name,
          driverName,
          driverNumber: driver.driverNumber,
          penaltyName: seriesPenalty.penaltyName,
          threshold: threshold.threshold,
          isServed: penalty.isServed,
          status,
          selectedMeetingStartAt: linkedRequest?.selectedMeetingStartAt ?? null,
        };
      }),
    );

    return rows
      .filter((row) => row !== null)
      .sort((a, b) => {
        if (a!.status !== b!.status) {
          return a!.status === "missing_request" ? -1 : 1;
        }
        if (a!.seriesName !== b!.seriesName) {
          return a!.seriesName.localeCompare(b!.seriesName);
        }
        return a!.driverName.localeCompare(b!.driverName);
      });
  },
});

export const getById = query({
  args: {
    id: v.id("raceBanReviews"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const role = await getCurrentUserRole(ctx, args.userId);
    if (!STAFF_ROLES.has(role)) {
      throw new UserFacingError("You do not have access to this race review.");
    }

    const request = await ctx.db.get(args.id);
    if (!request) {
      return null;
    }

    const [driver, requester, series, seriesPenalty, threshold, driverPenalty] =
      await Promise.all([
        ctx.db.get(request.driverId),
        ctx.db.get(request.userId),
        ctx.db.get(request.seriesId),
        ctx.db.get(request.seriesPenaltyId),
        ctx.db.get(request.seriesPenaltyThresholdId),
        ctx.db.get(request.driverSeriesPenaltyId),
      ]);

    const scheduledBy = request.scheduledBy
      ? await ctx.db.get(request.scheduledBy)
      : null;
    const completedBy = request.completedBy
      ? await ctx.db.get(request.completedBy)
      : null;
    const notesUpdatedBy = request.notesUpdatedBy
      ? await ctx.db.get(request.notesUpdatedBy)
      : null;

    const reports = await ctx.db.query("reports").collect();
    const eventCache = new Map<string, any>();
    const raceCache = new Map<string, any>();

    const atFaultReports = await Promise.all(
      reports
        .filter((report) => report.status === "finalized")
        .filter((report) =>
          report.atFaultDriverId
            ? report.atFaultDriverId === request.driverId
            : report.reportedDriverId === request.driverId,
        )
        .map(async (report) => {
          const eventKey = report.eventId.toString();
          if (!eventCache.has(eventKey)) {
            eventCache.set(eventKey, await ctx.db.get(report.eventId));
          }
          const event = eventCache.get(eventKey);
          if (!event || event.seriesId !== request.seriesId) {
            return null;
          }

          const raceKey = report.raceId.toString();
          if (!raceCache.has(raceKey)) {
            raceCache.set(raceKey, await ctx.db.get(report.raceId));
          }
          const race = raceCache.get(raceKey);

          const appliedPenalty = report.appliedPenalty
            ? await ctx.db.get(report.appliedPenalty as any)
            : null;

          return {
            _id: report._id,
            reportId: report.reportId ?? null,
            eventName: event.trackName,
            eventNumber: event.eventNumber,
            raceNumber: race?.raceNumber ?? null,
            sessionName:
              race?.sessionName?.trim() ||
              (typeof race?.raceNumber === "number"
                ? `Race ${race.raceNumber}`
                : "Session"),
            appliedPenaltyName: (appliedPenalty as any)?.name ?? null,
            finalDecision: report.finalDecision ?? "",
            finalizedAt: report.finalizedAt ?? report.updatedAt ?? report.createdAt,
          };
        }),
    );

    return {
      ...request,
      driver,
      requester,
      series,
      seriesPenalty,
      threshold,
      driverPenalty,
      scheduledBy,
      completedBy,
      notesUpdatedBy,
      reports: atFaultReports
        .filter((report) => report !== null)
        .sort((a, b) => (b?.finalizedAt ?? 0) - (a?.finalizedAt ?? 0)),
    };
  },
});

export const getMeetingNotificationContext = internalQuery({
  args: {
    id: v.id("raceBanReviews"),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.id);
    if (
      !request ||
      request.status !== "scheduled" ||
      !request.selectedMeetingStartAt ||
      !request.scheduledBy
    ) {
      return null;
    }

    const [driver, requester, scheduler, series, seriesPenalty] = await Promise.all([
      ctx.db.get(request.driverId),
      ctx.db.get(request.userId),
      ctx.db.get(request.scheduledBy),
      ctx.db.get(request.seriesId),
      ctx.db.get(request.seriesPenaltyId),
    ]);

    if (!requester || !scheduler) {
      return null;
    }

    const driverLabel = driver
      ? `${driver.driverName} #${driver.driverNumber}`
      : "Unknown Driver";
    const requesterName = requester.officialName || requester.name || "Requester";
    const schedulerName = scheduler.officialName || scheduler.name || "Steward";

    return {
      reviewId: request._id,
      selectedMeetingStartAt: request.selectedMeetingStartAt,
      selectedMeetingEndAt: request.selectedMeetingEndAt ?? null,
      meetingTimeLabel: formatMeetingWindow(
        request.selectedMeetingStartAt,
        request.selectedMeetingEndAt,
      ),
      meetingThreadId: request.meetingThreadId ?? null,
      requesterDiscordId: requester.discordId ?? null,
      schedulerDiscordId: scheduler.discordId ?? null,
      requesterName,
      schedulerName,
      driverLabel,
      seriesName: series?.name ?? "Unknown Series",
      penaltyName: seriesPenalty?.penaltyName ?? "Race Review",
    };
  },
});

export const scheduleMeeting = mutation({
  args: {
    id: v.id("raceBanReviews"),
    scheduledBy: v.id("users"),
    selectedMeetingStartAt: v.number(),
    selectedMeetingEndAt: v.number(),
  },
  handler: async (ctx, args) => {
    const role = await getCurrentUserRole(ctx, args.scheduledBy);
    if (!canManageReview(role)) {
      throw new UserFacingError(
        "Only head stewards and league managers can schedule race review meetings.",
      );
    }

    const request = await ctx.db.get(args.id);
    if (!request) {
      throw new UserFacingError("Race review request not found.");
    }
    if (request.status === "completed") {
      throw new UserFacingError("This review request is already completed.");
    }
    if (args.selectedMeetingEndAt <= args.selectedMeetingStartAt) {
      throw new UserFacingError("Meeting end time must be after start time.");
    }

    const fitsAvailability = request.availabilityWindows.some(
      (window) =>
        args.selectedMeetingStartAt >= window.startAt &&
        args.selectedMeetingEndAt <= window.endAt,
    );
    if (!fitsAvailability) {
      throw new UserFacingError(
        "Selected meeting time must be within one of the driver's availability windows.",
      );
    }

    const now = Date.now();
    if (request.meetingReminderJobId) {
      await ctx.scheduler.cancel(request.meetingReminderJobId);
    }

    await ctx.db.patch(args.id, {
      status: "scheduled",
      selectedMeetingStartAt: args.selectedMeetingStartAt,
      selectedMeetingEndAt: args.selectedMeetingEndAt,
      scheduledBy: args.scheduledBy,
      scheduledAt: now,
      notificationError: undefined,
      meetingReminderError: undefined,
      meetingReminderSentAt: undefined,
      meetingReminderJobId: undefined,
      updatedAt: now,
    });

    const driverPenalty = await ctx.db.get(request.driverSeriesPenaltyId);
    if (driverPenalty && driverPenalty.raceBanReviewId !== request._id) {
      await ctx.db.patch(driverPenalty._id, {
        raceBanReviewId: request._id,
      });
    }

    const reminderAt = args.selectedMeetingStartAt - ONE_HOUR_MS;
    const reminderJobId =
      reminderAt <= now
        ? await ctx.scheduler.runAfter(0, SEND_MEETING_REMINDER_FN, {
            id: args.id,
            expectedMeetingStartAt: args.selectedMeetingStartAt,
          })
        : await ctx.scheduler.runAt(reminderAt, SEND_MEETING_REMINDER_FN, {
            id: args.id,
            expectedMeetingStartAt: args.selectedMeetingStartAt,
          });

    await ctx.db.patch(args.id, {
      meetingReminderJobId: reminderJobId,
      updatedAt: Date.now(),
    });

    await ctx.scheduler.runAfter(0, CREATE_MEETING_THREAD_POST_FN, {
      id: args.id,
      expectedMeetingStartAt: args.selectedMeetingStartAt,
    });

    return args.id;
  },
});

export const markCompleted = mutation({
  args: {
    id: v.id("raceBanReviews"),
    completedBy: v.id("users"),
  },
  handler: async (ctx, args) => {
    const role = await getCurrentUserRole(ctx, args.completedBy);
    if (!canManageReview(role)) {
      throw new UserFacingError(
        "Only head stewards and league managers can complete race reviews.",
      );
    }

    const request = await ctx.db.get(args.id);
    if (!request) {
      throw new UserFacingError("Race review request not found.");
    }

    if (request.meetingReminderJobId) {
      await ctx.scheduler.cancel(request.meetingReminderJobId);
    }

    await ctx.db.patch(args.id, {
      status: "completed",
      completedBy: args.completedBy,
      completedAt: Date.now(),
      meetingReminderJobId: undefined,
      updatedAt: Date.now(),
    });

    const driverPenalty = await ctx.db.get(request.driverSeriesPenaltyId);
    if (driverPenalty && driverPenalty.raceBanReviewId !== request._id) {
      await ctx.db.patch(driverPenalty._id, {
        raceBanReviewId: request._id,
      });
    }

    return args.id;
  },
});

export const recordNotificationResult = mutation({
  args: {
    id: v.id("raceBanReviews"),
    sent: v.boolean(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      notificationSentAt: args.sent ? Date.now() : undefined,
      notificationError: args.sent ? undefined : args.error ?? "Notification failed",
      updatedAt: Date.now(),
    });
    return args.id;
  },
});

export const recordMeetingThreadNotificationResult = internalMutation({
  args: {
    id: v.id("raceBanReviews"),
    expectedMeetingStartAt: v.number(),
    sent: v.boolean(),
    threadId: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.id);
    if (!request || request.selectedMeetingStartAt !== args.expectedMeetingStartAt) {
      return null;
    }

    const now = Date.now();
    const patch: Record<string, any> = {
      updatedAt: now,
    };
    if (args.threadId) {
      patch["meetingThreadId"] = args.threadId;
    }
    if (args.sent) {
      patch["notificationSentAt"] = now;
      patch["notificationError"] = undefined;
    } else {
      patch["notificationError"] =
        args.error ?? "Failed to create race review meeting thread.";
    }

    await ctx.db.patch(args.id, patch);
    return args.id;
  },
});

export const recordMeetingReminderResult = internalMutation({
  args: {
    id: v.id("raceBanReviews"),
    expectedMeetingStartAt: v.number(),
    sent: v.boolean(),
    threadId: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.id);
    if (!request || request.selectedMeetingStartAt !== args.expectedMeetingStartAt) {
      return null;
    }

    const now = Date.now();
    const patch: Record<string, any> = {
      meetingReminderJobId: undefined,
      updatedAt: now,
    };
    if (args.threadId) {
      patch["meetingThreadId"] = args.threadId;
    }
    if (args.sent) {
      patch["meetingReminderSentAt"] = now;
      patch["meetingReminderError"] = undefined;
    } else {
      patch["meetingReminderError"] =
        args.error ?? "Failed to send race review meeting reminder.";
    }

    await ctx.db.patch(args.id, patch);
    return args.id;
  },
});

export const updateNotes = mutation({
  args: {
    id: v.id("raceBanReviews"),
    userId: v.id("users"),
    notes: v.string(),
  },
  handler: async (ctx, args) => {
    const role = await getCurrentUserRole(ctx, args.userId);
    if (!canManageReview(role)) {
      throw new UserFacingError(
        "Only head stewards and league managers can update race review notes.",
      );
    }

    const request = await ctx.db.get(args.id);
    if (!request) {
      throw new UserFacingError("Race review request not found.");
    }

    await ctx.db.patch(args.id, {
      notes: args.notes,
      notesUpdatedAt: Date.now(),
      notesUpdatedBy: args.userId,
      updatedAt: Date.now(),
    });

    return args.id;
  },
});
