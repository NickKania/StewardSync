import { internalMutation, internalAction, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

const RUN_SCHEDULED_IMPORT_FN = "scheduledImports:runScheduledImport" as any;

async function runGetSeriesById(ctx: any, args: { id: Id<"series"> }) {
  return ctx.runQuery("series:getById", args);
}

async function runGetEventsBySeriesId(ctx: any, args: { seriesId: Id<"series"> }) {
  return ctx.runQuery("events:getBySeriesId", args);
}

async function runImportDriversFromSimGrid(ctx: any, args: { championshipId: Id<"series">; simgridChampionshipId: string }) {
  return ctx.runAction("actions:importDriversFromSimGrid", args);
}

async function runScheduleNextRun(ctx: any, args: { seriesId: Id<"series">; nextRunTime: number }) {
  return ctx.runMutation("scheduledImports:scheduleNextRun", args);
}

async function runDeactivateSchedule(ctx: any, args: { seriesId: Id<"series"> }) {
  return ctx.runMutation("scheduledImports:deactivateSchedule", args);
}

function getNextOccurrence(dayOfWeek: number, timeStr: string, fromDate: Date): Date {
  const [hours, minutes] = timeStr.split(":").map(Number);
  const result = new Date(fromDate);
  result.setUTCHours(hours, minutes, 0, 0);
  
  const currentDayOfWeek = result.getUTCDay();
  const daysUntilTarget = (dayOfWeek - currentDayOfWeek + 7) % 7;
  
  if (daysUntilTarget === 0) {
    if (result.getTime() <= fromDate.getTime()) {
      result.setUTCDate(result.getUTCDate() + 7);
    }
  } else {
    result.setUTCDate(result.getUTCDate() + daysUntilTarget);
  }
  
  return result;
}

function findNextScheduledRun(
  daysOfWeek: number[],
  timeStr: string,
  fromDate: Date,
  seriesEndDate: number | null
): Date | null {
  if (daysOfWeek.length === 0) return null;
  
  let nextRun: Date | null = null;
  
  for (const dayOfWeek of daysOfWeek) {
    const occurrence = getNextOccurrence(dayOfWeek, timeStr, fromDate);
    if (!nextRun || occurrence < nextRun) {
      nextRun = occurrence;
    }
  }
  
  if (seriesEndDate && nextRun && nextRun.getTime() > seriesEndDate) {
    return null;
  }
  
  return nextRun;
}

async function getSeriesDateRange(ctx: any, seriesId: Id<"series">): Promise<{ startDate: number | null; endDate: number | null }> {
  const events = await ctx.db
    .query("events")
    .withIndex("by_series", (q: any) => q.eq("seriesId", seriesId))
    .collect();
  
  if (events.length === 0) {
    return { startDate: null, endDate: null };
  }
  
  const sortedEvents = events.sort((a: any, b: any) => a.eventDate - b.eventDate);
  
  return {
    startDate: sortedEvents[0].eventDate,
    endDate: sortedEvents[sortedEvents.length - 1].eventDate,
  };
}

export const getScheduleStatus = query({
  args: { seriesId: v.id("series") },
  handler: async (ctx, args) => {
    const series = await ctx.db.get(args.seriesId);
    if (!series) return null;
    
    const dateRange = await getSeriesDateRange(ctx, args.seriesId);
    
    let nextRun: number | null = null;
    if (series.isScheduledImportActive && series.scheduledImportTime && series.scheduledImportDays?.length) {
      const next = findNextScheduledRun(
        series.scheduledImportDays,
        series.scheduledImportTime,
        new Date(),
        dateRange.endDate
      );
      nextRun = next ? next.getTime() : null;
    }
    
    return {
      isScheduledImportActive: series.isScheduledImportActive ?? false,
      scheduledImportTime: series.scheduledImportTime,
      scheduledImportDays: series.scheduledImportDays ?? [],
      nextRun,
      seriesStartDate: dateRange.startDate,
      seriesEndDate: dateRange.endDate,
      hasEvents: dateRange.startDate !== null,
    };
  },
});

export const scheduleImport = mutation({
  args: {
    seriesId: v.id("series"),
    scheduledImportTime: v.string(),
    scheduledImportDays: v.array(v.number()),
  },
  handler: async (ctx, args) => {
    const series = await ctx.db.get(args.seriesId);
    if (!series) {
      throw new Error("Series not found");
    }
    
    if (!series.simgridLink) {
      throw new Error("Series must have a SimGrid link configured");
    }
    
    const dateRange = await getSeriesDateRange(ctx, args.seriesId);
    if (!dateRange.startDate || !dateRange.endDate) {
      throw new Error("Series must have events to schedule imports");
    }
    
    if (args.scheduledImportDays.length === 0) {
      throw new Error("At least one day must be selected");
    }
    
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(args.scheduledImportTime)) {
      throw new Error("Invalid time format. Use HH:MM (24-hour format)");
    }
    
    for (const day of args.scheduledImportDays) {
      if (day < 0 || day > 6) {
        throw new Error("Days must be between 0 (Sunday) and 6 (Saturday)");
      }
    }
    
    if (series.scheduledImportJobId) {
      try {
        await ctx.scheduler.cancel(series.scheduledImportJobId);
      } catch (e) {
        // Job may have already completed
      }
    }
    
    const now = new Date();
    const nextRun = findNextScheduledRun(
      args.scheduledImportDays,
      args.scheduledImportTime,
      now,
      dateRange.endDate
    );
    
    let jobId: Id<"_scheduled_functions"> | undefined;
    
    if (nextRun) {
      jobId = await ctx.scheduler.runAt(nextRun.getTime(), RUN_SCHEDULED_IMPORT_FN, {
        seriesId: args.seriesId,
        expectedRunTime: nextRun.getTime(),
      });
    }
    
    await ctx.db.patch(args.seriesId, {
      scheduledImportTime: args.scheduledImportTime,
      scheduledImportDays: args.scheduledImportDays,
      scheduledImportJobId: jobId,
      isScheduledImportActive: true,
    });
    
    return {
      success: true,
      nextRun: nextRun ? nextRun.getTime() : null,
    };
  },
});

export const cancelScheduledImport = mutation({
  args: { seriesId: v.id("series") },
  handler: async (ctx, args) => {
    const series = await ctx.db.get(args.seriesId);
    if (!series) {
      throw new Error("Series not found");
    }
    
    if (series.scheduledImportJobId) {
      try {
        await ctx.scheduler.cancel(series.scheduledImportJobId);
      } catch (e) {
        // Job may have already completed
      }
    }
    
    await ctx.db.patch(args.seriesId, {
      scheduledImportJobId: undefined,
      isScheduledImportActive: false,
    });
    
    return { success: true };
  },
});

export const updateScheduleWithNewDates = mutation({
  args: { seriesId: v.id("series") },
  handler: async (ctx, args) => {
    const series = await ctx.db.get(args.seriesId);
    if (!series || !series.isScheduledImportActive || !series.scheduledImportTime || !series.scheduledImportDays?.length) {
      return;
    }
    
    const dateRange = await getSeriesDateRange(ctx, args.seriesId);
    
    if (series.scheduledImportJobId) {
      try {
        await ctx.scheduler.cancel(series.scheduledImportJobId);
      } catch (e) {
        // Job may have already completed
      }
    }
    
    const now = new Date();
    const nextRun = findNextScheduledRun(
      series.scheduledImportDays,
      series.scheduledImportTime,
      now,
      dateRange.endDate
    );
    
    let jobId: Id<"_scheduled_functions"> | undefined;
    
    if (nextRun) {
      jobId = await ctx.scheduler.runAt(nextRun.getTime(), RUN_SCHEDULED_IMPORT_FN, {
        seriesId: args.seriesId,
        expectedRunTime: nextRun.getTime(),
      });
    }
    
    await ctx.db.patch(args.seriesId, {
      scheduledImportJobId: jobId,
    });
  },
});

export const runScheduledImport = internalAction({
  args: {
    seriesId: v.id("series"),
    expectedRunTime: v.number(),
  },
  handler: async (ctx, args) => {
    const series = await runGetSeriesById(ctx, { id: args.seriesId });
    
    if (!series || !series.isScheduledImportActive) {
      console.log(`Skipping import for series ${args.seriesId}: schedule inactive or series not found`);
      return;
    }
    
    if (!series.simgridLink) {
      console.log(`Skipping import for series ${args.seriesId}: no SimGrid link`);
      return;
    }
    
    const championshipId = extractChampionshipId(series.simgridLink);
    if (!championshipId) {
      console.log(`Skipping import for series ${args.seriesId}: could not extract championship ID`);
      return;
    }
    
    try {
      const result = await runImportDriversFromSimGrid(ctx, {
        championshipId: args.seriesId,
        simgridChampionshipId: championshipId,
      });
      
      console.log(`Scheduled import completed for series ${args.seriesId}:`, result);
    } catch (error) {
      console.error(`Scheduled import failed for series ${args.seriesId}:`, error);
    }
    
    if (series.scheduledImportTime && series.scheduledImportDays?.length) {
      const events = await runGetEventsBySeriesId(ctx, { seriesId: args.seriesId });
      let seriesEndDate: number | null = null;
      
      if (events && events.length > 0) {
        const sortedEvents = [...events].sort((a: any, b: any) => a.eventDate - b.eventDate);
        seriesEndDate = sortedEvents[sortedEvents.length - 1].eventDate;
      }
      
      const now = new Date();
      const nextRun = findNextScheduledRun(
        series.scheduledImportDays,
        series.scheduledImportTime,
        now,
        seriesEndDate
      );
      
      if (nextRun) {
        await runScheduleNextRun(ctx, {
          seriesId: args.seriesId,
          nextRunTime: nextRun.getTime(),
        });
        
        console.log(`Next scheduled import for series ${args.seriesId} at ${nextRun.toISOString()}`);
      } else {
        await runDeactivateSchedule(ctx, {
          seriesId: args.seriesId,
        });
        console.log(`No more scheduled imports for series ${args.seriesId} - series has ended`);
      }
    }
  },
});

export const scheduleNextRun = internalMutation({
  args: {
    seriesId: v.id("series"),
    nextRunTime: v.number(),
  },
  handler: async (ctx, args) => {
    const jobId = await ctx.scheduler.runAt(args.nextRunTime, RUN_SCHEDULED_IMPORT_FN, {
      seriesId: args.seriesId,
      expectedRunTime: args.nextRunTime,
    });
    
    await ctx.db.patch(args.seriesId, {
      scheduledImportJobId: jobId,
    });
  },
});

export const deactivateSchedule = internalMutation({
  args: {
    seriesId: v.id("series"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.seriesId, {
      scheduledImportJobId: undefined,
      isScheduledImportActive: false,
    });
  },
});

function extractChampionshipId(url: string): string | null {
  const patterns = [/championship\/(\d+)/, /id=(\d+)/, /\/(\d+)\/?$/];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  
  return null;
}
