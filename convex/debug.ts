import { query } from "./_generated/server";
import { v } from "convex/values";
import { checkUserDriverConflict } from "./lib/reports";

export const debugReportConflict = query({
  args: {
    userId: v.id("users"),
    reportId: v.id("reports"),
  },
  handler: async (ctx, args) => {
    console.log(`[DEBUG QUERY] debugReportConflict called with userId: ${args.userId}, reportId: ${args.reportId}`);

    const report = await ctx.db.get(args.reportId);
    if (!report) {
      console.log(`[DEBUG QUERY] Report not found: ${args.reportId}`);
      return {
        error: "Report not found",
        result: null,
      };
    }

    const result = await checkUserDriverConflict(ctx, args.userId, report);
    console.log(`[DEBUG QUERY] debugReportConflict result:`, result);

    return result;
  },
});

export const checkConflict = query({
  args: {
    userId: v.id("users"),
    reportId: v.id("reports"),
  },
  handler: async (ctx, args) => {
    console.log(`[DEBUG QUERY] checkConflict called with userId: ${args.userId}, reportId: ${args.reportId}`);

    const report = await ctx.db.get(args.reportId);
    if (!report) {
      console.log(`[DEBUG QUERY] Report not found: ${args.reportId}`);
      return {
        error: "Report not found",
        hasConflict: false,
        conflictType: null,
      };
    }

    const result = await checkUserDriverConflict(ctx, args.userId, report);
    console.log(`[DEBUG QUERY] checkConflict result:`, result);

    return {
      hasConflict: result.hasConflict,
      conflictType: result.conflictType,
      driverName: result.driverName,
    };
  },
});
