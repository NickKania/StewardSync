import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

interface SimGridDriver {
  username: string;
  realName: string;
  identifier: string;
  steam64Id: string;
  platform: string;
  carNumber: string;
  carClass: string;
  carName: string;
  fiaEsportsLicenceNumber: string;
  registeredAt: string;
}

function parseCSV(csvText: string): SimGridDriver[] {
  const lines = csvText.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  
  const drivers: SimGridDriver[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    
    const values: string[] = [];
    let inQuotes = false;
    let current = '';
    
    for (let char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    
    const driver: Partial<SimGridDriver> = {};
    headers.forEach((header, index) => {
      const value = values[index] || '';
      switch (header.toLowerCase()) {
        case 'username':
          driver.username = value;
          break;
        case 'real name':
          driver.realName = value;
          break;
        case 'identifier':
          driver.identifier = value;
          break;
        case 'steam64_id':
          driver.steam64Id = value;
          break;
        case 'platform':
          driver.platform = value;
          break;
        case 'car number':
          driver.carNumber = value;
          break;
        case 'car class':
          driver.carClass = value;
          break;
        case 'car name':
          driver.carName = value;
          break;
        case 'fia esports licence number':
          driver.fiaEsportsLicenceNumber = value;
          break;
        case 'registered at':
          driver.registeredAt = value;
          break;
      }
    });
    
    drivers.push(driver as SimGridDriver);
  }
  
  return drivers;
}

interface ImportOrUpdateDriverResult {
  action: "created" | "updated";
  driverId: string;
}

interface GetOrCreateDriverClassResult {
  action: "existing" | "created";
  driverClassId: string;
}

// Helper function to get or create driver class
async function runGetOrCreateDriverClass(
  ctx: any,
  args: {
    seriesId: string;
    className: string;
  },
): Promise<GetOrCreateDriverClassResult> {
  // @ts-ignore - Circular type inference in Convex API
  return ctx.runMutation(api.driverClasses.getOrCreate, args);
}

// Helper function to avoid circular type inference in Convex
async function runImportOrUpdateDriver(
  ctx: any,
  args: {
    championshipId: string;
    driverNumber: number;
    driverName: string;
    username?: string;
    driverClassId: string;
    steamId?: string;
  },
): Promise<ImportOrUpdateDriverResult> {
  return ctx.runMutation(api.drivers.importOrUpdateDriver, args);
}

export const importDriversFromSimGrid = action({
  args: {
    championshipId: v.id("series"),
    simgridChampionshipId: v.string(),
  },
  handler: async (ctx, args) => {
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
      const simgridDrivers = parseCSV(csvText);

      const results: Array<{ action: string; driverId: string; name: string }> = [];
      
      // Track driver classes to avoid duplicate getOrCreate calls
      const driverClassCache = new Map<string, string>();

      for (const simgridDriver of simgridDrivers) {
        const carNumber = parseInt(simgridDriver.carNumber, 10);
        if (isNaN(carNumber)) {
          continue;
        }

        // Get or create driver class
        const classCacheKey = `${args.championshipId}:${simgridDriver.carClass}`;
        let driverClassId: string;
        
        if (driverClassCache.has(classCacheKey)) {
          driverClassId = driverClassCache.get(classCacheKey)!;
        } else {
          const driverClassResult = await runGetOrCreateDriverClass(ctx, {
            seriesId: args.championshipId,
            className: simgridDriver.carClass,
          });
          driverClassId = driverClassResult.driverClassId;
          driverClassCache.set(classCacheKey, driverClassId);
        }

        const result = await runImportOrUpdateDriver(ctx, {
          championshipId: args.championshipId,
          driverNumber: carNumber,
          driverName: simgridDriver.realName,
          username: simgridDriver.username,
          driverClassId: driverClassId,
          steamId: simgridDriver.steam64Id || undefined,
        });
        
        results.push({
          action: result.action,
          driverId: result.driverId,
          name: simgridDriver.username,
        });
      }
      
      return {
        success: true,
        imported: results.length,
        driverClassesCreated: [...driverClassCache.values()].length,
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
