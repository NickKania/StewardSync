"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import {
  ChannelType,
  Client,
  GatewayIntentBits,
  ThreadAutoArchiveDuration,
  type ThreadChannel,
} from "discord.js";

const GET_MEETING_CONTEXT_FN = "raceBanReviews:getMeetingNotificationContext" as any;
const GET_THREAD_CLOSE_CONTEXT_FN = "raceBanReviews:getMeetingThreadCloseContext" as any;
const RECORD_MEETING_THREAD_RESULT_FN =
  "raceBanReviews:recordMeetingThreadNotificationResult" as any;
const RECORD_MEETING_REMINDER_RESULT_FN =
  "raceBanReviews:recordMeetingReminderResult" as any;

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

const stepError = (
  step: string,
  error: unknown,
  meta?: Record<string, unknown>,
) => {
  const base = toErrorMessage(error, "Unknown error");
  const metaText = meta ? ` | meta=${JSON.stringify(meta)}` : "";
  return new Error(`[${step}] ${base}${metaText}`);
};

const getEnvOrThrow = (key: string) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} is not configured.`);
  }
  return value;
};

const toErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
};

const toMention = (discordId: string) => `<@${discordId}>`;

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

const toDiscordTimestamp = (timestampMs: number, style: "F" | "t" | "R") =>
  `<t:${Math.floor(timestampMs / 1000)}:${style}>`;

const formatDiscordMeetingWindow = (context: MeetingNotificationContext) => {
  const startLong = toDiscordTimestamp(context.selectedMeetingStartAt, "F");
  const startRelative = toDiscordTimestamp(context.selectedMeetingStartAt, "R");
  if (!context.selectedMeetingEndAt) {
    return `${startLong} (${startRelative})`;
  }

  const endShort = toDiscordTimestamp(context.selectedMeetingEndAt, "t");
  return `${startLong} - ${endShort} (${startRelative})`;
};

const withDiscordClient = async <T>(
  callback: (client: Client) => Promise<T>,
) => {
  const token = getEnvOrThrow("DISCORD_BOT_TOKEN");
  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });
  console.info("[RaceReviewDiscord] Logging in Discord bot client.");
  await client.login(token);
  console.info("[RaceReviewDiscord] Discord bot login succeeded.", {
    botUserId: client.user?.id ?? null,
  });
  try {
    return await callback(client);
  } finally {
    client.destroy();
  }
};

const fetchThreadIfAvailable = async (
  client: Client,
  threadId: string | null,
): Promise<ThreadChannel | null> => {
  if (!threadId) {
    return null;
  }
  const channel = await client.channels.fetch(threadId).catch(() => null);
  if (!channel || !channel.isThread()) {
    return null;
  }
  return channel;
};

const createMeetingThread = async (
  client: Client,
  context: MeetingNotificationContext,
  openingMessage: string,
): Promise<ThreadChannel> => {
  const parentChannelId = getEnvOrThrow("DISCORD_RACE_REVIEW_CHANNEL_ID");
  console.info("[RaceReviewDiscord] Fetching parent channel.", {
    parentChannelId,
    reviewId: context.reviewId,
  });
  const parentChannel = await client.channels.fetch(parentChannelId).catch((error) => {
    throw stepError("fetch_parent_channel", error, {
      parentChannelId,
      reviewId: context.reviewId,
    });
  });

  if (!parentChannel) {
    throw new Error("Configured Discord race review channel was not found.");
  }

  const threadName = buildThreadName(context);
  console.info("[RaceReviewDiscord] Creating meeting thread.", {
    parentChannelId,
    parentChannelType: parentChannel.type,
    threadName,
    requesterDiscordId: context.requesterDiscordId,
    schedulerDiscordId: context.schedulerDiscordId,
  });

  if (parentChannel.type !== ChannelType.GuildText) {
    throw stepError(
      "invalid_parent_channel_type",
      new Error(
        "DISCORD_RACE_REVIEW_CHANNEL_ID must reference a Discord text channel that supports private threads.",
      ),
      {
        parentChannelId,
        parentChannelType: parentChannel.type,
        reviewId: context.reviewId,
      },
    );
  }

  const thread = await parentChannel.threads
    .create({
      name: threadName,
      autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
      type: ChannelType.PrivateThread,
      invitable: false,
      reason: "Race review meeting scheduled",
    })
    .catch((error) => {
      throw stepError("create_private_thread", error, {
        parentChannelId,
        threadName,
        reviewId: context.reviewId,
      });
    });

  if (!context.requesterDiscordId || !context.schedulerDiscordId) {
    throw new Error(
      "Both requester and scheduler Discord IDs are required to create a private thread.",
    );
  }

  await thread.members.add(context.requesterDiscordId).catch((error) => {
    throw stepError("add_requester_to_thread", error, {
      threadId: thread.id,
      requesterDiscordId: context.requesterDiscordId,
    });
  });
  if (context.schedulerDiscordId !== context.requesterDiscordId) {
    await thread.members.add(context.schedulerDiscordId).catch((error) => {
      throw stepError("add_scheduler_to_thread", error, {
        threadId: thread.id,
        schedulerDiscordId: context.schedulerDiscordId,
      });
    });
  }
  await thread.send({ content: openingMessage }).catch((error) => {
    throw stepError("send_opening_message", error, {
      threadId: thread.id,
    });
  });
  return thread;
};

const ensureMeetingThread = async (
  client: Client,
  context: MeetingNotificationContext,
  openingMessage: string,
) => {
  const existingThread = await fetchThreadIfAvailable(client, context.meetingThreadId);
  if (existingThread) {
    console.info("[RaceReviewDiscord] Reusing existing thread.", {
      threadId: existingThread.id,
      reviewId: context.reviewId,
    });
    return { thread: existingThread, created: false };
  }

  const createdThread = await createMeetingThread(client, context, openingMessage);
  return { thread: createdThread, created: true };
};

const loadContext = async (
  ctx: any,
  id: string,
  expectedMeetingStartAt: number,
): Promise<MeetingNotificationContext | null> => {
  const context = await ctx.runQuery(GET_MEETING_CONTEXT_FN, {
    id,
  });
  if (!context || context.selectedMeetingStartAt !== expectedMeetingStartAt) {
    return null;
  }
  return context;
};

const loadCloseContext = async (
  ctx: any,
  id: string,
): Promise<MeetingThreadCloseContext | null> => {
  const context = await ctx.runQuery(GET_THREAD_CLOSE_CONTEXT_FN, { id });
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
  handler: async (ctx, args) => {
    let threadId: string | undefined;
    try {
      console.info("[RaceReviewDiscord] createOrUpdateMeetingThreadPost started.", {
        reviewId: args.id,
        expectedMeetingStartAt: args.expectedMeetingStartAt,
      });
      const context = await loadContext(ctx, args.id, args.expectedMeetingStartAt);
      if (!context) {
        console.warn("[RaceReviewDiscord] createOrUpdateMeetingThreadPost skipped.", {
          reviewId: args.id,
          expectedMeetingStartAt: args.expectedMeetingStartAt,
        });
        return { skipped: true };
      }

      const mentions = buildParticipantMentions(context);
      const meetingTime = formatDiscordMeetingWindow(context);
      const content =
        `${mentions} Meeting accepted. ${context.schedulerName} will meet with ${context.requesterName} at ${meetingTime}.`;

      threadId = await withDiscordClient(async (client) => {
        const { thread, created } = await ensureMeetingThread(client, context, content);
        if (!created) {
          await thread.send({ content }).catch((error) => {
            throw stepError("send_thread_update_message", error, {
              threadId: thread.id,
              reviewId: args.id,
            });
          });
        }
        return thread.id;
      });

      await ctx.runMutation(RECORD_MEETING_THREAD_RESULT_FN, {
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
      console.error("[RaceReviewDiscord] createOrUpdateMeetingThreadPost failed.", {
        reviewId: args.id,
        expectedMeetingStartAt: args.expectedMeetingStartAt,
        threadId: threadId ?? null,
        error: message,
      });

      await ctx.runMutation(RECORD_MEETING_THREAD_RESULT_FN, {
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
  handler: async (ctx, args) => {
    try {
      console.info("[RaceReviewDiscord] closeMeetingThread started.", {
        reviewId: args.id,
      });

      const context = await loadCloseContext(ctx, args.id);
      if (!context || !context.meetingThreadId) {
        console.info("[RaceReviewDiscord] closeMeetingThread skipped.", {
          reviewId: args.id,
          reason: !context ? "missing_or_not_completed" : "missing_thread_id",
        });
        return { skipped: true };
      }

      const result = await withDiscordClient(async (client) => {
        const thread = await fetchThreadIfAvailable(client, context.meetingThreadId);
        if (!thread) {
          return { skipped: true as const, reason: "thread_not_found" };
        }

        if (!thread.archived) {
          await thread.setArchived(true, "Race review completed").catch((error) => {
            throw stepError("archive_meeting_thread", error, {
              reviewId: args.id,
              threadId: context.meetingThreadId,
            });
          });
        }

        if (typeof thread.setLocked === "function" && !thread.locked) {
          await thread.setLocked(true, "Race review completed").catch((error) => {
            throw stepError("lock_meeting_thread", error, {
              reviewId: args.id,
              threadId: context.meetingThreadId,
            });
          });
        }

        return {
          closed: true as const,
          threadId: thread.id,
          archived: true,
          locked: true,
        };
      });

      console.info("[RaceReviewDiscord] closeMeetingThread completed.", {
        reviewId: args.id,
        ...result,
      });
      return result;
    } catch (error: unknown) {
      const message = toErrorMessage(error, "Failed to close race review meeting thread.");
      console.error("[RaceReviewDiscord] closeMeetingThread failed.", {
        reviewId: args.id,
        error: message,
      });
      return { sent: false, error: message };
    }
  },
});

export const sendMeetingReminder = internalAction({
  args: {
    id: v.id("raceBanReviews"),
    expectedMeetingStartAt: v.number(),
  },
  handler: async (ctx, args) => {
    let threadId: string | undefined;
    try {
      console.info("[RaceReviewDiscord] sendMeetingReminder started.", {
        reviewId: args.id,
        expectedMeetingStartAt: args.expectedMeetingStartAt,
      });
      const context = await loadContext(ctx, args.id, args.expectedMeetingStartAt);
      if (!context) {
        console.warn("[RaceReviewDiscord] sendMeetingReminder skipped.", {
          reviewId: args.id,
          expectedMeetingStartAt: args.expectedMeetingStartAt,
        });
        return { skipped: true };
      }

      const mentions = buildParticipantMentions(context);
      const meetingTime = formatDiscordMeetingWindow(context);
      const msUntilMeeting = context.selectedMeetingStartAt - Date.now();
      const startsSoonText =
        msUntilMeeting < 30 * 60 * 1000 ? "starts soon" : "starts in about 1 hour";
      const reminderMessage =
        `${mentions} Reminder: your race review meeting ${startsSoonText} at ${meetingTime}.`;

      threadId = await withDiscordClient(async (client) => {
        const { thread } = await ensureMeetingThread(
          client,
          context,
          `${mentions} Race review meeting thread created for ${meetingTime}.`,
        );
        await thread.send({ content: reminderMessage }).catch((error) => {
          throw stepError("send_reminder_message", error, {
            threadId: thread.id,
            reviewId: args.id,
          });
        });
        return thread.id;
      });

      await ctx.runMutation(RECORD_MEETING_REMINDER_RESULT_FN, {
        id: args.id,
        expectedMeetingStartAt: args.expectedMeetingStartAt,
        sent: true,
        threadId,
      });

      return { sent: true, threadId };
    } catch (error: unknown) {
      const message = toErrorMessage(error, "Failed to send race review reminder.");
      console.error("[RaceReviewDiscord] sendMeetingReminder failed.", {
        reviewId: args.id,
        expectedMeetingStartAt: args.expectedMeetingStartAt,
        threadId: threadId ?? null,
        error: message,
      });

      await ctx.runMutation(RECORD_MEETING_REMINDER_RESULT_FN, {
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
