import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const migratePenaltiesAddLap1Time = mutation({
  args: {},
  handler: async (ctx) => {
    const penalties = await ctx.db.query("penalties").collect();

    let migrated = 0;
    for (const penalty of penalties) {
      const penaltyDoc = penalty as any;

      if (!penaltyDoc.timePenaltyLap1) {
        await ctx.db.patch(penalty._id, {
          timePenaltyLap1: penalty.timePenalty,
        });
        migrated++;
      }
    }

    return { success: true, migrated };
  },
});

export const migrateReportsAddLap = mutation({
  args: {},
  handler: async (ctx) => {
    const reports = await ctx.db.query("reports").collect();

    let migrated = 0;
    for (const report of reports) {
      const reportDoc = report as any;

      if (!reportDoc.lap) {
        // Randomly assign lap 1 or lap 2
        const randomLap = Math.random() < 0.5 ? 1 : 2;
        await ctx.db.patch(report._id, {
          lap: randomLap,
        });
        migrated++;
      }
    }

    return { success: true, migrated };
  },
});
