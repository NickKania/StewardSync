import { mutation, query } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { requireRole } from "./lib/auth";
import { UserFacingError } from "./lib/errors";

type SeriesCopySessionPreview = {
  raceNumber?: number;
  sessionName?: string;
};

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function buildSessionName(race: {
  raceNumber?: number;
  sessionName?: string;
}): string {
  const explicit = race.sessionName?.trim();
  if (explicit) return explicit;

  if (typeof race.raceNumber === "number" && Number.isFinite(race.raceNumber)) {
    return `Race ${race.raceNumber}`;
  }

  return "Session";
}

async function assertValidCopyRequest(
  ctx: any,
  args: {
    currentUserId: Id<"users">;
    sourceSeriesId: Id<"series">;
    targetSeriesId: Id<"series">;
  },
) {
  await requireRole(ctx, args.currentUserId, ["event_manager", "league_manager"]);

  if (args.sourceSeriesId === args.targetSeriesId) {
    throw new UserFacingError("Source and target series must be different");
  }

  const [sourceSeries, targetSeries] = await Promise.all([
    ctx.db.get(args.sourceSeriesId),
    ctx.db.get(args.targetSeriesId),
  ]);

  if (!sourceSeries) {
    throw new UserFacingError("Source series not found");
  }

  if (!targetSeries) {
    throw new UserFacingError("Target series not found");
  }

  return { sourceSeries, targetSeries };
}

async function buildPreview(
  ctx: any,
  args: {
    sourceSeriesId: Id<"series">;
    targetSeriesId: Id<"series">;
  },
) {
  const sourcePenalties = await ctx.db
    .query("penalties")
    .withIndex("by_series", (q: any) => q.eq("seriesId", args.sourceSeriesId))
    .collect();
  const targetPenalties = await ctx.db
    .query("penalties")
    .withIndex("by_series", (q: any) => q.eq("seriesId", args.targetSeriesId))
    .collect();
  const targetPenaltyNames = new Set(
    targetPenalties.map((penalty: any) => normalizeName(penalty.name)),
  );

  const sourceSeriesPenalties = await ctx.db
    .query("seriesPenalties")
    .withIndex("by_series", (q: any) => q.eq("seriesId", args.sourceSeriesId))
    .collect();
  const targetSeriesPenalties = await ctx.db
    .query("seriesPenalties")
    .withIndex("by_series", (q: any) => q.eq("seriesId", args.targetSeriesId))
    .collect();
  const targetSeriesPenaltyNames = new Set(
    targetSeriesPenalties.map((penalty: any) =>
      normalizeName(penalty.penaltyName),
    ),
  );

  const targetClasses = await ctx.db
    .query("driverClasses")
    .withIndex("by_series", (q: any) => q.eq("seriesId", args.targetSeriesId))
    .collect();
  const targetClassesByClassName = new Map<string, Doc<"driverClasses">>(
    targetClasses.map((driverClass: any) => [
      normalizeName(driverClass.className),
      driverClass,
    ]),
  );

  const sourceEvents = await ctx.db
    .query("events")
    .withIndex("by_series", (q: any) => q.eq("seriesId", args.sourceSeriesId))
    .collect();
  const targetEvents = await ctx.db
    .query("events")
    .withIndex("by_series", (q: any) => q.eq("seriesId", args.targetSeriesId))
    .collect();
  const targetEventsByNumber = new Map<number, Doc<"events">>(
    targetEvents.map((event: any) => [event.eventNumber, event]),
  );

  const penaltiesToCreate = sourcePenalties
    .filter((penalty: any) => !targetPenaltyNames.has(normalizeName(penalty.name)))
    .map((penalty: any) => ({
      name: penalty.name,
      timePenalty: penalty.timePenalty,
      selfReportReduction: penalty.selfReportReduction,
      timePenaltyLap1: penalty.timePenaltyLap1,
      licensePoints: penalty.licensePoints,
      allowNoDriverAtFault: penalty.allowNoDriverAtFault,
    }));

  const seriesPenalties = await Promise.all(
    sourceSeriesPenalties.map(async (seriesPenalty: any) => {
      const thresholds = await ctx.db
        .query("seriesPenaltyThresholds")
        .withIndex("by_series_penalty", (q: any) =>
          q.eq("seriesPenaltyId", seriesPenalty._id),
        )
        .collect();

      const thresholdPreviews = await Promise.all(
        thresholds.map(async (threshold: any) => {
          const sourceClasses = (
            await Promise.all(
              threshold.driverClassIds.map((id: Id<"driverClasses">) =>
                ctx.db.get(id),
              ),
            )
          ).filter(Boolean);
          const sourceClassNames = sourceClasses.map(
            (driverClass: any) => driverClass.className,
          );
          const matchedClasses = sourceClassNames
            .map((className: string) =>
              targetClassesByClassName.get(normalizeName(className)),
            )
            .filter(Boolean);
          const matchedClassNames = new Set(
            matchedClasses.map((driverClass: any) =>
              normalizeName(driverClass.className),
            ),
          );

          return {
            threshold: threshold.threshold,
            requiresReview: threshold.requiresReview ?? false,
            sourceClasses: sourceClassNames,
            matchedClassIds: matchedClasses.map(
              (driverClass: any) => driverClass._id,
            ),
            matchedClasses: matchedClasses.map((driverClass: any) => ({
              id: driverClass._id,
              className: driverClass.className,
              displayName: driverClass.displayName,
            })),
            unmatchedClasses: sourceClassNames.filter(
              (className: string) =>
                !matchedClassNames.has(normalizeName(className)),
            ),
          };
        }),
      );

      return {
        penaltyName: seriesPenalty.penaltyName,
        penaltyDescription: seriesPenalty.penaltyDescription,
        alreadyExists: targetSeriesPenaltyNames.has(
          normalizeName(seriesPenalty.penaltyName),
        ),
        thresholds: thresholdPreviews,
      };
    }),
  );

  const sessionsByEvent: Record<
    number,
    {
      toCreate: SeriesCopySessionPreview[];
      alreadyExists: string[];
    }
  > = {};
  const eventsNotFound: number[] = [];

  for (const sourceEvent of sourceEvents) {
    const sourceRaces = await ctx.db
      .query("races")
      .withIndex("by_event", (q: any) => q.eq("eventId", sourceEvent._id))
      .collect();

    if (sourceRaces.length === 0) continue;

    const targetEvent = targetEventsByNumber.get(sourceEvent.eventNumber);
    if (!targetEvent) {
      eventsNotFound.push(sourceEvent.eventNumber);
      continue;
    }

    const targetRaces = await ctx.db
      .query("races")
      .withIndex("by_event", (q: any) => q.eq("eventId", targetEvent._id))
      .collect();
    const targetSessionNames = new Set(
      targetRaces.map((race: any) => normalizeName(buildSessionName(race))),
    );

    const eventPreview = {
      toCreate: [] as SeriesCopySessionPreview[],
      alreadyExists: [] as string[],
    };

    for (const sourceRace of sourceRaces) {
      const sessionName = buildSessionName(sourceRace);
      if (targetSessionNames.has(normalizeName(sessionName))) {
        eventPreview.alreadyExists.push(sessionName);
        continue;
      }

      eventPreview.toCreate.push({
        raceNumber: sourceRace.raceNumber,
        sessionName,
      });
    }

    sessionsByEvent[sourceEvent.eventNumber] = eventPreview;
  }

  return {
    penalties: {
      toCreate: penaltiesToCreate,
      alreadyExists: sourcePenalties
        .filter((penalty: any) => targetPenaltyNames.has(normalizeName(penalty.name)))
        .map((penalty: any) => penalty.name),
    },
    seriesPenalties,
    sessions: {
      byEvent: sessionsByEvent,
      eventsNotFound: eventsNotFound.sort((a, b) => a - b),
    },
  };
}

export const preview = query({
  args: {
    currentUserId: v.id("users"),
    sourceSeriesId: v.id("series"),
    targetSeriesId: v.id("series"),
  },
  handler: async (ctx, args) => {
    await assertValidCopyRequest(ctx, args);
    return await buildPreview(ctx, args);
  },
});

export const execute = mutation({
  args: {
    currentUserId: v.id("users"),
    sourceSeriesId: v.id("series"),
    targetSeriesId: v.id("series"),
  },
  handler: async (ctx, args) => {
    await assertValidCopyRequest(ctx, args);

    const previewResult = await buildPreview(ctx, args);
    const now = Date.now();
    const warnings: string[] = [];

    for (const penalty of previewResult.penalties.toCreate) {
      await ctx.db.insert("penalties", {
        seriesId: args.targetSeriesId,
        name: penalty.name,
        timePenalty: penalty.timePenalty,
        selfReportReduction: penalty.selfReportReduction ?? 0,
        timePenaltyLap1: penalty.timePenaltyLap1 ?? penalty.timePenalty,
        licensePoints: penalty.licensePoints,
        allowNoDriverAtFault: penalty.allowNoDriverAtFault ?? false,
        createdAt: now,
      });
    }

    let seriesPenaltiesCreated = 0;
    let seriesPenaltiesSkipped = 0;
    let thresholdsCreated = 0;

    for (const seriesPenalty of previewResult.seriesPenalties) {
      if (seriesPenalty.alreadyExists) {
        seriesPenaltiesSkipped += 1;
        continue;
      }

      const seriesPenaltyId = await ctx.db.insert("seriesPenalties", {
        seriesId: args.targetSeriesId,
        penaltyName: seriesPenalty.penaltyName,
        penaltyDescription: seriesPenalty.penaltyDescription,
        createdAt: now,
      });
      seriesPenaltiesCreated += 1;

      for (const threshold of seriesPenalty.thresholds) {
        if (threshold.unmatchedClasses.length > 0) {
          warnings.push(
            `${seriesPenalty.penaltyName} threshold ${threshold.threshold}: unmatched classes ${threshold.unmatchedClasses.join(", ")}`,
          );
        }

        await ctx.db.insert("seriesPenaltyThresholds", {
          seriesPenaltyId,
          threshold: threshold.threshold,
          driverClassIds: threshold.matchedClassIds,
          requiresReview: threshold.requiresReview,
          createdAt: now,
        });
        thresholdsCreated += 1;
      }
    }

    const targetEvents = await ctx.db
      .query("events")
      .withIndex("by_series", (q: any) => q.eq("seriesId", args.targetSeriesId))
      .collect();
    const targetEventsByNumber = new Map<number, Doc<"events">>(
      targetEvents.map((event: any) => [event.eventNumber, event]),
    );

    let sessionsCreated = 0;
    let sessionsSkipped = 0;
    for (const [eventNumber, eventPreview] of Object.entries(
      previewResult.sessions.byEvent,
    )) {
      const targetEvent = targetEventsByNumber.get(Number(eventNumber));
      if (!targetEvent) continue;

      sessionsSkipped += eventPreview.alreadyExists.length;
      for (const session of eventPreview.toCreate) {
        await ctx.db.insert("races", {
          eventId: targetEvent._id,
          raceNumber: session.raceNumber ?? 0,
          sessionName: session.sessionName ?? buildSessionName(session),
          createdAt: now,
        });
        sessionsCreated += 1;
      }
    }

    for (const eventNumber of previewResult.sessions.eventsNotFound) {
      warnings.push(`Target series has no event ${eventNumber}; sessions skipped`);
    }

    return {
      penaltiesCreated: previewResult.penalties.toCreate.length,
      penaltiesSkipped: previewResult.penalties.alreadyExists.length,
      seriesPenaltiesCreated,
      seriesPenaltiesSkipped,
      thresholdsCreated,
      sessionsCreated,
      sessionsSkipped,
      warnings,
    };
  },
});
