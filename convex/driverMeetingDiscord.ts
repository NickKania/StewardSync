"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import {
  withDiscordClient,
  createPrivateThread,
  getEnvOrThrow,
} from "./discord";

interface CreateDriverMeetingThreadArgs {
  driverLabel: string;
  driverNumber: number;
  seriesName: string;
  driverDiscordId: string;
  creatorDiscordId: string;
  creatorName: string;
  initialMessage: string;
}

export const createDriverMeetingThreadAction = internalAction({
  args: {
    driverLabel: v.string(),
    driverNumber: v.number(),
    seriesName: v.string(),
    driverDiscordId: v.string(),
    creatorDiscordId: v.string(),
    creatorName: v.string(),
    initialMessage: v.string(),
  },
  handler: async (ctx, args: CreateDriverMeetingThreadArgs) => {
    return await withDiscordClient(async (client) => {
      const parentChannelId = getEnvOrThrow("DISCORD_RACE_REVIEW_CHANNEL_ID");

      // Build thread name
      const threadName = `Driver Meeting: ${args.driverLabel} (#${args.driverNumber})`;

      // Collect unique participants
      const participants = [args.driverDiscordId];
      if (args.creatorDiscordId !== args.driverDiscordId) {
        participants.push(args.creatorDiscordId);
      }

      // Create private thread
      const thread = await createPrivateThread(client, {
        name: threadName,
        parentChannelId,
        participantDiscordIds: participants,
        reason: "Driver meeting requested",
      });

      // Send formatted initial message
      const timestamp = new Date().toLocaleString();
      const content = `${args.initialMessage}\n\n_Created by ${args.creatorName} at ${timestamp}_`;
      await thread.send({ content });

      return {
        threadId: thread.id,
        threadName: thread.name,
      };
    });
  },
});
