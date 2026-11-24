import { internal } from "./_generated/api";
import { internalAction, type ActionCtx } from "./_generated/server";
import { v } from "convex/values";
import {
  sendDiscordMessage,
  type DiscordThread,
  createPrivateThread,
  fetchThreadIfAvailable,
  closeThread,
  toMention,
  toDiscordTimestamp,
} from "./discord";
import { Id } from "./_generated/dataModel";

const getEnv = (key: string): string | undefined => process.env[key];

interface MeetingThreadArgs {
  id: Id<"raceBanReviews">;
  expectedMeetingStartAt: number;
}

interface CloseMeetingThreadArgs {
  id: Id<"raceBanReviews">;
}

type MeetingNotificationContext = {
  reviewId: string;
  selectedMeetingStartAt: number;
  selectedMeetingEndAt: number | null;
  meetingTimeLabel: string;
  meetingThreadId: string | null;
  requesterDiscordId: string | null;
  schedulerDiscordId: string | null;
  requesterName: string;
  schedulerName: string;
  driverLabel: string;
  seriesName: string;
  penaltyName: string;
};

type MeetingThreadCloseContext = {
  reviewId: string;
  meetingThreadId: string | null;
  status: "open" | "scheduled" | "completed";
};

const toErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
};

const buildParticipantMentions = (context: MeetingNotificationContext) => {
  if (!context.requesterDiscordId || !context.schedulerDiscordId) {
    throw new Error(
      "Both requester and scheduler must have linked Discord accounts for meeting notifications.",
    );
  }
  return `${toMention(context.requesterDiscordId)} ${toMention(context.schedulerDiscordId)}`;
};

const buildThreadName = (context: MeetingNotificationContext) => {
  const raw = `Race Review: ${context.driverLabel} (${context.seriesName})`;
  return raw.length > 100 ? raw.slice(0, 100) : raw;
};

const formatDiscordMeetingWindow = (context: MeetingNotificationContext) => {
  const startLong = toDiscordTimestamp(context.selectedMeetingStartAt, "F");
  const startRelative = toDiscordTimestamp(context.selectedMeetingStartAt, "R");
  if (!context.selectedMeetingEndAt) {
    return `${startLong} (${startRelative})`;
  }

  const endShort = toDiscordTimestamp(context.selectedMeetingEndAt, "t");
  return `${startLong} - ${endShort} (${startRelative})`;
};

const createMeetingThread = async (
  context: MeetingNotificationContext,
  openingMessage: string,
): Promise<DiscordThread> => {
  const parentChannelId = getEnv("DISCORD_RACE_REVIEW_CHANNEL_ID");
  if (!parentChannelId) {
    throw new Error("DISCORD_RACE_REVIEW_CHANNEL_ID is not configured.");
  }

  const threadName = buildThreadName(context);

  if (!context.requesterDiscordId || !context.schedulerDiscordId) {
    throw new Error(
      "Both requester and scheduler Discord IDs are required to create a private thread.",
    );
  }

  const participants = [context.requesterDiscordId];
  if (context.schedulerDiscordId !== context.requesterDiscordId) {
    participants.push(context.schedulerDiscordId);
  }

  const thread = await createPrivateThread({
    name: threadName,
    parentChannelId,
    participantDiscordIds: participants,
    reason: "Race review meeting scheduled",
  });

  await sendDiscordMessage(thread.id, openingMessage);
  return thread;
};

const ensureMeetingThread = async (
  context: MeetingNotificationContext,
  openingMessage: string,
) => {
  const existingThread = await fetchThreadIfAvailable(context.meetingThreadId);
  if (existingThread) {
    return { thread: existingThread, created: false };
  }

  const createdThread = await createMeetingThread(context, openingMessage);
  return { thread: createdThread, created: true };
};

const loadContext = async (
  ctx: ActionCtx,
  id: Id<"raceBanReviews">,
  expectedMeetingStartAt: number,
): Promise<MeetingNotificationContext | null> => {
  const context = await ctx.runQuery(internal.raceBanReviews.getMeetingNotificationContext, {
    id,
  });
  if (!context || context.selectedMeetingStartAt !== expectedMeetingStartAt) {
    return null;
  }
  return context;
};

const loadCloseContext = async (
  ctx: ActionCtx,
  id: Id<"raceBanReviews">,
): Promise<MeetingThreadCloseContext | null> => {
  const context = await ctx.runQuery(internal.raceBanReviews.getMeetingThreadCloseContext, { id });
  if (!context || context.status !== "completed") {
    return null;
  }
  return context;
};

export const createOrUpdateMeetingThreadPost = internalAction({
  args: {
    id: v.id("raceBanReviews"),
    expectedMeetingStartAt: v.number(),
  },
  handler: async (ctx, args: MeetingThreadArgs) => {
    let threadId: string | undefined;
    try {
      const context = await loadContext(ctx, args.id, args.expectedMeetingStartAt);
      if (!context) {
        return { skipped: true };
      }

      const mentions = buildParticipantMentions(context);
      const meetingTime = formatDiscordMeetingWindow(context);
      const content =
        `${mentions} Meeting accepted. ${context.schedulerName} will meet with ${context.requesterName} at ${meetingTime}.`;

      const { thread, created } = await ensureMeetingThread(context, content);
      threadId = thread.id;
      if (!created) await sendDiscordMessage(threadId, content);

      await ctx.runMutation(internal.raceBanReviews.recordMeetingThreadNotificationResult, {
        id: args.id,
        expectedMeetingStartAt: args.expectedMeetingStartAt,
        sent: true,
        threadId,
      });

      return { sent: true, threadId };
    } catch (error: unknown) {
      const message = toErrorMessage(
        error,
        "Failed to create race review meeting notification thread.",
      );

      await ctx.runMutation(internal.raceBanReviews.recordMeetingThreadNotificationResult, {
        id: args.id,
        expectedMeetingStartAt: args.expectedMeetingStartAt,
        sent: false,
        threadId,
        error: message,
      });

      return { sent: false, error: message };
    }
  },
});

export const closeMeetingThread = internalAction({
  args: {
    id: v.id("raceBanReviews"),
  },
  handler: async (ctx, args: CloseMeetingThreadArgs) => {
    try {
      const context = await loadCloseContext(ctx, args.id);
      if (!context || !context.meetingThreadId) {
        return { skipped: true };
      }

      return await closeThread(context.meetingThreadId, "Race review completed");
    } catch (error: unknown) {
      const message = toErrorMessage(error, "Failed to close race review meeting thread.");
      return { sent: false, error: message };
    }
  },
});

export const sendMeetingReminder = internalAction({
  args: {
    id: v.id("raceBanReviews"),
    expectedMeetingStartAt: v.number(),
  },
  handler: async (ctx, args: MeetingThreadArgs) => {
    let threadId: string | undefined;
    try {
      const context = await loadContext(ctx, args.id, args.expectedMeetingStartAt);
      if (!context) {
        return { skipped: true };
      }

      const mentions = buildParticipantMentions(context);
      const meetingTime = formatDiscordMeetingWindow(context);
      const msUntilMeeting = context.selectedMeetingStartAt - Date.now();
      const startsSoonText =
        msUntilMeeting < 30 * 60 * 1000 ? "starts soon" : "starts in about 1 hour";
      const reminderMessage =
        `${mentions} Reminder: your race review meeting ${startsSoonText} at ${meetingTime}.`;

      const { thread } = await ensureMeetingThread(
        context,
        `${mentions} Race review meeting thread created for ${meetingTime}.`,
      );
      threadId = thread.id;
      await sendDiscordMessage(threadId, reminderMessage);

      await ctx.runMutation(internal.raceBanReviews.recordMeetingReminderResult, {
        id: args.id,
        expectedMeetingStartAt: args.expectedMeetingStartAt,
        sent: true,
        threadId,
      });

      return { sent: true, threadId };
    } catch (error: unknown) {
      const message = toErrorMessage(error, "Failed to send race review reminder.");

      await ctx.runMutation(internal.raceBanReviews.recordMeetingReminderResult, {
        id: args.id,
        expectedMeetingStartAt: args.expectedMeetingStartAt,
        sent: false,
        threadId,
        error: message,
      });

      return { sent: false, error: message };
    }
  },
});
