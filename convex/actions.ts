import { action } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { parseSimGridDriversCsv } from "./lib/simgridCsv";

interface ImportOrUpdateDriverResult {
  action: "created" | "updated";
  driverId: Id<"drivers">;
}

// Helper function to avoid circular type inference in Convex
async function runImportOrUpdateDriver(
  ctx: any,
  args: {
    championshipId: Id<"series">;
    driverNumber?: number;
    driverName: string;
    username?: string;
    steamId?: string;
    driverClassId?: Id<"driverClasses">;
  },
): Promise<ImportOrUpdateDriverResult> {
  // @ts-ignore - Circular type inference in Convex API
  return ctx.runMutation(api.drivers.importOrUpdateDriver, args);
}

export const importDriversFromSimGrid = action({
  args: {
    championshipId: v.id("series"),
    simgridChampionshipId: v.string(),
  },
  handler: async (ctx: any, args) => {
    const apiKey = process.env["SIMGRID_API_KEY"];
    if (!apiKey) {
      throw new Error("SIMGRID_API_KEY environment variable not configured");
    }

    const url = `https://www.thesimgrid.com/api/v1/championships/${args.simgridChampionshipId}/entrylist?format=csv`;
    
    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch drivers: ${response.statusText}`);
      }
      
      const csvText = await response.text();
      const simgridDrivers = parseSimGridDriversCsv(csvText);

      const results: Array<{
        action: string;
        driverId: Id<"drivers">;
        name: string;
      }> = [];

      for (const simgridDriver of simgridDrivers) {
        const carNumber = simgridDriver.carNumber?.trim()
          ? Number(simgridDriver.carNumber)
          : undefined;

        // Get or create driver class based on carClass from SimGrid
        let driverClassId: Id<"driverClasses"> | undefined;
        if (simgridDriver.carClass) {
          const classResult: any = await ctx.runMutation(api.driverClasses.getOrCreate, {
            seriesId: args.championshipId,
            className: simgridDriver.carClass,
          });
          driverClassId = classResult.driverClassId;
        }

        const result = await runImportOrUpdateDriver(ctx, {
          championshipId: args.championshipId,
          ...(carNumber === undefined ? {} : { driverNumber: carNumber }),
          driverName: simgridDriver.realName,
          username: simgridDriver.username,
          steamId: simgridDriver.steam64Id || undefined,
          driverClassId,
        });
        
        results.push({
          action: result.action,
          driverId: result.driverId,
          name: simgridDriver.username,
        });
      }

      const inactiveResult: any = await ctx.runMutation(api.drivers.markInactiveDrivers, {
        championshipId: args.championshipId,
        activeDriverIds: results.map((result) => result.driverId),
      });

      return {
        success: true,
        imported: results.length,
        markedInactive: inactiveResult.markedInactive,
        results,
      };
    } catch (error) {
      console.error('Error importing drivers from SimGrid:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});
