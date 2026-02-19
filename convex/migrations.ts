import { mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { UserFacingError } from "./lib/errors";
import type { Id } from "./_generated/dataModel";

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

export const migrateDriversToV2 = internalMutation({
  args: {},
  handler: async (ctx) => {
    console.log("[MIGRATION] Starting Drivers 2.0 migration");

    const drivers = await ctx.db.query("drivers").collect();
    let migratedCount = 0;
    let totalPointsCalculated = 0;

    for (const driver of drivers) {
      const driverDoc = driver as any;

      if (driverDoc.accumulatedLicensePoints !== undefined && driverDoc.isActive !== undefined) {
        continue;
      }

      const reports = await ctx.db
        .query("reports")
        .withIndex("by_reported_driver", (q) => q.eq("reportedDriverId", driver._id))
        .collect();

      const finalizedReports = reports.filter((r) =>
        r.status === "finalized" &&
        (r.atFaultDriverId === driver._id || (!r.atFaultDriverId && r.reportedDriverId === driver._id))
      );

      let totalPoints = 0;
      for (const report of finalizedReports) {
        if (report.appliedPenalty) {
          const event = await ctx.db.get(report.eventId);
          if (event) {
            const penalty = await ctx.db
              .query("penalties")
              .withIndex("by_series", (q) => q.eq("seriesId", event.seriesId))
              .collect()
              .then((penalties) =>
                penalties.find((p) => p.name === report.appliedPenalty)
              );

            totalPoints += penalty?.licensePoints || 0;
          }
        }
      }

      await ctx.db.patch(driver._id, {
        accumulatedLicensePoints: totalPoints,
        isActive: true,
      });

      migratedCount++;
      totalPointsCalculated += totalPoints;

      console.log(`[MIGRATION] Driver #${driver.driverNumber} (${driver.driverName}): ${totalPoints} points`);
    }

    console.log(`[MIGRATION] Complete: ${migratedCount} drivers, ${totalPointsCalculated} total points`);

    return {
      migratedCount,
      totalPointsCalculated,
    };
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
          lap: String(randomLap),
        });
        migrated++;
      }
    }

    return { success: true, migrated };
  },
});

export const assignPenaltiesForSeries = internalMutation({
  args: { seriesId: v.id("series") },
  handler: async (ctx, args) => {
    console.log("[assignPenaltiesForSeries] Starting assignment for series:", args.seriesId);

    // Requirements for penalty assignment:
    // 1. Driver must have driverClassId set (run migrateDriverClasses migration)
    // 2. Threshold must have driverClassIds array with at least one entry (run migrateDriverClasses migration)
    // 3. Driver's driverClassId must be in threshold's driverClassIds
    // If these requirements are not met, check the returned diagnostic arrays for details
    const events = await ctx.db
      .query("events")
      .withIndex("by_series", (q) => q.eq("seriesId", args.seriesId))
      .collect();

    const drivers = await ctx.db
      .query("drivers")
      .withIndex("by_championship", (q) =>
        q.eq("championshipId", args.seriesId),
      )
      .collect();

    const penaltyAccumulator: Record<string, number> = {};

    for (const event of events) {
      const reports = await ctx.db
        .query("reports")
        .withIndex("by_event", (q) => q.eq("eventId", event._id))
        .collect();

      const finalizedReports = reports.filter((r) => r.status === "finalized");

      for (const report of finalizedReports) {
        let penalty: any = null;
        if (report.appliedPenalty) {
          penalty = await ctx.db.get(report.appliedPenalty as any);
        }

        const points = penalty?.licensePoints ?? 0;
        const driverId =
          report.atFaultDriverId?.toString() ||
          report.reportedDriverId.toString();

        // Verify the driver belongs to this series before accumulating points
        const driver = await ctx.db.get(
          report.atFaultDriverId || report.reportedDriverId,
        );

        // Only accumulate points if the driver's championship matches the current series
        if (driver && driver.championshipId === args.seriesId) {
          if (penaltyAccumulator[driverId]) {
            penaltyAccumulator[driverId] += points;
          } else {
            penaltyAccumulator[driverId] = points;
          }
        }
      }
    }

    const seriesPenalties = await ctx.db
      .query("seriesPenalties")
      .withIndex("by_series", (q) => q.eq("seriesId", args.seriesId))
      .collect();

    const assignedPenalties: any[] = [];
    const existingPenalties: any[] = [];
    const skippedThresholds: any[] = [];
    const missingDriverClass: any[] = [];
    const emptyDriverClassIds: any[] = [];
    const mismatchedDriverClass: any[] = [];

    for (const driver of drivers) {
      const driverId = driver._id.toString();
      const totalPoints = penaltyAccumulator[driverId] ?? 0;
      const driverClassId = driver.driverClassId || null;

      const existingDriverSeriesPenalties = await ctx.db
        .query("driverSeriesPenalties")
        .withIndex("by_driver_and_series", (q) =>
          q.eq("driverId", driver._id).eq("seriesId", args.seriesId),
        )
        .collect();

      const assignedThresholdIds = new Set(
        existingDriverSeriesPenalties.map(
          (dsp) => dsp.seriesPenaltyThresholdId
        )
      );

      for (const seriesPenalty of seriesPenalties) {
        const thresholds = await ctx.db
          .query("seriesPenaltyThresholds")
          .withIndex("by_series_penalty", (q) =>
            q.eq("seriesPenaltyId", seriesPenalty._id),
          )
          .collect();

        for (const threshold of thresholds) {
          const hasDriverClass = !!driverClassId;
          const hasThresholdClasses = threshold.driverClassIds && threshold.driverClassIds.length > 0;
          const matchesDriverClass = hasDriverClass && hasThresholdClasses && threshold.driverClassIds.includes(driverClassId);
          
          let appliesToDriver = false;
          let skipReason = "";

          if (!hasDriverClass) {
            skipReason = "missing_driver_class";
            missingDriverClass.push({
              driverId: driver._id,
              driverName: driver.driverName,
              penaltyName: seriesPenalty.penaltyName,
              threshold: threshold.threshold,
              currentPoints: totalPoints,
            });
          } else if (!hasThresholdClasses) {
            skipReason = "empty_threshold_classes";
            emptyDriverClassIds.push({
              driverId: driver._id,
              driverName: driver.driverName,
              driverClassId,
              penaltyName: seriesPenalty.penaltyName,
              threshold: threshold.threshold,
              currentPoints: totalPoints,
            });
          } else if (!matchesDriverClass) {
            skipReason = "mismatched_driver_class";
            mismatchedDriverClass.push({
              driverId: driver._id,
              driverName: driver.driverName,
              driverClassId,
              penaltyName: seriesPenalty.penaltyName,
              threshold: threshold.threshold,
              currentPoints: totalPoints,
            });
          } else {
            appliesToDriver = true;
          }

          if (appliesToDriver && totalPoints >= threshold.threshold) {
            if (assignedThresholdIds.has(threshold._id)) {
              existingPenalties.push({
                driverId: driver._id,
                driverName: driver.driverName,
                penaltyName: seriesPenalty.penaltyName,
                threshold: threshold.threshold,
                pointsAtAssignment: totalPoints,
              });
            } else {
              const driverSeriesPenaltyId = await ctx.db.insert(
                "driverSeriesPenalties",
                {
                  driverId: driver._id,
                  seriesId: args.seriesId,
                  seriesPenaltyId: seriesPenalty._id,
                  seriesPenaltyThresholdId: threshold._id,
                  isServed: false,
                  requiresReview: threshold.requiresReview ?? false,
                  pointsAtAssignment: totalPoints,
                  assignedAt: Date.now(),
                },
              );

              const driverClass = driverClassId ? await ctx.db.get(driverClassId) : null;
              assignedPenalties.push({
                driverSeriesPenaltyId,
                driverId: driver._id,
                driverName: driver.driverName,
                driverClass: driverClass?.displayName || "",
                penaltyName: seriesPenalty.penaltyName,
                threshold: threshold.threshold,
                pointsAtAssignment: totalPoints,
              });
            }
          } else if (appliesToDriver) {
            skippedThresholds.push({
              driverId: driver._id,
              driverName: driver.driverName,
              penaltyName: seriesPenalty.penaltyName,
              threshold: threshold.threshold,
              currentPoints: totalPoints,
              skipReason: "insufficient_points",
            });
          }
        }
      }
    }

    console.log("[assignPenaltiesForSeries] Assignment complete:", {
      assignedCount: assignedPenalties.length,
      existingCount: existingPenalties.length,
      skippedThresholds: skippedThresholds.length,
      missingDriverClass: missingDriverClass.length,
      emptyDriverClassIds: emptyDriverClassIds.length,
      mismatchedDriverClass: mismatchedDriverClass.length,
    });

    return {
      assignedCount: assignedPenalties.length,
      existingCount: existingPenalties.length,
      assignedPenalties,
      existingPenalties,
      skippedThresholds,
      missingDriverClass,
      emptyDriverClassIds,
      mismatchedDriverClass,
    };
  },
});

export const backfillAtFaultDriverId = internalMutation({
  args: {},
  handler: async (ctx) => {
    const reports = await ctx.db.query("reports").collect();

    let reportsUpdated = 0;
    let reviewsUpdated = 0;

    for (const report of reports) {
      if (report.atFaultDriverId) continue;

      if (report.status === "finalized") {
        await ctx.db.patch(report._id, {
          atFaultDriverId: report.reportedDriverId,
          updatedAt: Date.now(),
        });
        reportsUpdated++;
      } else if (report.status === "reviewed") {
        const reviews = await ctx.db
          .query("reviews")
          .withIndex("by_report", (q) => q.eq("reportId", report._id))
          .collect();

        for (const review of reviews) {
          if (review.atFaultDriverId) continue;

          await ctx.db.patch(review._id, {
            atFaultDriverId: report.reportedDriverId,
            updatedAt: Date.now(),
          });
          reviewsUpdated++;
        }
      }
    }

    return {
      reportsUpdated,
      reviewsUpdated,
    };
  },
});

export const backfillReviewedReports = internalMutation({
  args: {},
  handler: async (ctx) => {
    const reports = await ctx.db.query("reports").collect();

    let updatedCount = 0;
    let skippedNonPending = 0;
    let skippedInsufficientReviews = 0;

    for (const report of reports) {
      if (report.status !== "pending") {
        skippedNonPending++;
        continue;
      }

      const reviews = await ctx.db
        .query("reviews")
        .withIndex("by_report", (q) => q.eq("reportId", report._id))
        .collect();

      if (reviews.length < 2) {
        skippedInsufficientReviews++;
        continue;
      }

      await ctx.db.patch(report._id, {
        status: "reviewed",
        updatedAt: Date.now(),
      });
      updatedCount++;
    }

    return {
      updatedCount,
      skippedNonPending,
      skippedInsufficientReviews,
    };
  },
});

export const migrateLapAndTurnToString = mutation({
  args: {},
  handler: async (ctx) => {
    const reports = await ctx.db.query("reports").collect();

    let migrated = 0;
    for (const report of reports) {
      const reportDoc = report as any;

      if (
        typeof reportDoc.lap === "number" ||
        typeof reportDoc.turn === "number"
      ) {
        await ctx.db.patch(report._id, {
          lap:
            typeof reportDoc.lap === "number"
              ? String(reportDoc.lap)
              : reportDoc.lap,
          turn:
            typeof reportDoc.turn === "number"
              ? String(reportDoc.turn)
              : reportDoc.turn,
        });
        migrated++;
      }
    }

    return { success: true, migrated };
  },
});

/**
 * Cleanup script to remove incorrectly assigned driverSeriesPenalties.
 *
 * This script identifies and removes driverSeriesPenalty entries where:
 * 1. The driver's championshipId doesn't match the seriesId in the penalty entry
 *
 * This situation occurs when the assignPenaltiesForSeries migration was run
 * before driver series validation was added, causing penalties to be assigned
 * to drivers from other series who happened to have reports with penalties.
 *
 * Returns details about what was removed and what would be removed (dry run).
 */
export const cleanupIncorrectDriverSeriesPenalties = internalMutation({
  args: { dryRun: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? false;

    const allDriverSeriesPenalties = await ctx.db
      .query("driverSeriesPenalties")
      .collect();

    const toRemove: any[] = [];
    const kept: any[] = [];
    const errors: any[] = [];

    for (const dsp of allDriverSeriesPenalties) {
      try {
        const driver = await ctx.db.get(dsp.driverId);

        if (!driver) {
          // Driver doesn't exist - mark for removal
          toRemove.push({
            driverSeriesPenaltyId: dsp._id,
            driverId: dsp.driverId,
            seriesId: dsp.seriesId,
            reason: "Driver not found",
          });
          continue;
        }

        // Check if driver belongs to the series
        if (!driver.championshipId || driver.championshipId !== dsp.seriesId) {
          // Driver belongs to a different series or has no championship - mark for removal
          const actualSeries = driver.championshipId
            ? await ctx.db.get(driver.championshipId)
            : null;
          const penaltySeries = await ctx.db.get(dsp.seriesId);

          toRemove.push({
            driverSeriesPenaltyId: dsp._id,
            driverId: dsp.driverId,
            driverName: driver.driverName,
            driverClassId: driver.driverClassId,
            seriesId: dsp.seriesId,
            penaltySeries: penaltySeries
              ? (penaltySeries as any).name || "Unknown"
              : "Unknown",
            driverChampionshipId: driver.championshipId || "None",
            driverSeries: actualSeries
              ? (actualSeries as any).name || "Unknown"
              : "None",
            reason: driver.championshipId
              ? "Driver belongs to a different series"
              : "Driver has no championship assigned",
          });
        } else {
          // Driver belongs to the correct series - keep
          kept.push({
            driverSeriesPenaltyId: dsp._id,
            driverId: dsp.driverId,
            driverName: driver.driverName,
            seriesId: dsp.seriesId,
          });
        }
      } catch (error) {
        errors.push({
          driverSeriesPenaltyId: dsp._id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // Remove the incorrect entries
    let removedCount = 0;
    if (!dryRun && toRemove.length > 0) {
      for (const entry of toRemove) {
        try {
          await ctx.db.delete(entry.driverSeriesPenaltyId);
          removedCount++;
        } catch (error) {
          errors.push({
            driverSeriesPenaltyId: entry.driverSeriesPenaltyId,
            error: error instanceof Error ? error.message : "Failed to delete",
          });
        }
      }
    }

    return {
      dryRun,
      toRemoveCount: toRemove.length,
      removedCount,
      keptCount: kept.length,
      errorCount: errors.length,
      toRemove,
      kept,
      errors,
    };
  },
});
/**
 * Migration to convert driverClass strings to driverClassId references
 * This should be run once after deploying the schema changes
 */
export const migrateDriverClasses = mutation({
  args: {},
  handler: async (ctx) => {
    const results = {
      driverClassesCreated: 0,
      driversUpdated: 0,
      thresholdsUpdated: 0,
      errors: [] as string[],
    };

    try {
      // Step 1: Get all drivers with the old driverClass field
      const allDrivers = await ctx.db.query("drivers").collect();
      
      // Group drivers by (seriesId, driverClass) to create unique driver classes
      const classMap = new Map<string, { seriesId: string; className: string; drivers: any[] }>();
      
      for (const driver of allDrivers) {
        // Skip drivers without championshipId (unassigned drivers)
        if (!driver.championshipId) continue;
        
        // Access the old driverClass field (will be removed after migration)
        const oldClass = (driver as any).driverClass;
        if (!oldClass) continue;
        
        const key = `${driver.championshipId}:${oldClass}`;
        if (!classMap.has(key)) {
          classMap.set(key, {
            seriesId: driver.championshipId,
            className: oldClass,
            drivers: [],
          });
        }
        classMap.get(key)!.drivers.push(driver);
      }

      // Step 2: Create driverClasses for each unique (seriesId, className) combination
      const classIdMap = new Map<string, Id<"driverClasses">>(); // Maps "seriesId:className" to driverClassId
      
      for (const [key, { seriesId, className }] of classMap) {
        try {
          // Check if driver class already exists
          const existing = await ctx.db
            .query("driverClasses")
            .withIndex("by_series_class", (q) =>
              q.eq("seriesId", seriesId as Id<"series">).eq("className", className)
            )
            .first();

          if (existing) {
            classIdMap.set(key, existing._id);
          } else {
            // Create new driver class
            const driverClassId = await ctx.db.insert("driverClasses", {
              seriesId: seriesId as Id<"series">,
              className,
              displayName: className,
              createdAt: Date.now(),
            });
            classIdMap.set(key, driverClassId);
            results.driverClassesCreated++;
          }
        } catch (error) {
          results.errors.push(`Failed to create driver class ${key}: ${error}`);
        }
      }

      // Step 3: Update all drivers to use driverClassId
      for (const [key, { drivers }] of classMap) {
        const driverClassId = classIdMap.get(key);
        if (!driverClassId) {
          results.errors.push(`Missing driverClassId for ${key}`);
          continue;
        }

        for (const driver of drivers) {
          try {
            await ctx.db.patch(driver._id, {
              driverClassId: driverClassId as Id<"driverClasses">,
            });
            results.driversUpdated++;
          } catch (error) {
            results.errors.push(`Failed to update driver ${driver._id}: ${error}`);
          }
        }
      }

      // Step 4: Update seriesPenaltyThresholds to use driverClassIds
      const allThresholds = await ctx.db.query("seriesPenaltyThresholds").collect();

      for (const threshold of allThresholds) {
        try {
          // Check if threshold already has driverClassIds and is valid
          if (threshold.driverClassIds && Array.isArray(threshold.driverClassIds) && threshold.driverClassIds.length > 0) {
            // Threshold already migrated, skip it
            continue;
          }

          // Get the old driverClasses array (strings) - legacy field
          const oldDriverClasses = (threshold as any).driverClasses;
          if (!oldDriverClasses || !Array.isArray(oldDriverClasses)) {
            results.errors.push(`Threshold ${threshold._id} has neither driverClassIds nor driverClasses`);
            continue;
          }

          // Get the seriesId from the parent seriesPenalty
          const seriesPenalty = await ctx.db.get(threshold.seriesPenaltyId);
          if (!seriesPenalty) {
            results.errors.push(`Missing seriesPenalty for threshold ${threshold._id}`);
            continue;
          }

          // Convert class names to driverClassIds
          const newDriverClassIds: Id<"driverClasses">[] = [];
          for (const className of oldDriverClasses) {
            const key = `${seriesPenalty.seriesId}:${className}`;
            const driverClassId = classIdMap.get(key);
            if (driverClassId) {
              newDriverClassIds.push(driverClassId as Id<"driverClasses">);
            } else {
              results.errors.push(`Missing driverClassId for threshold ${threshold._id}, class: ${className}`);
            }
          }

          // Update the threshold
          await ctx.db.patch(threshold._id, {
            driverClassIds: newDriverClassIds,
          });
          results.thresholdsUpdated++;
        } catch (error) {
          results.errors.push(`Failed to update threshold ${threshold._id}: ${error}`);
        }
      }

      return results;
    } catch (error) {
      throw new UserFacingError(`Migration failed: ${error}`);
    }
  },
});

/**
 * Get migration status - shows what would be migrated without making changes
 */
export const getMigrationStatus = mutation({
  args: {},
  handler: async (ctx) => {
    const status = {
      totalDrivers: 0,
      driversNeedingMigration: 0,
      uniqueClassCombinations: 0,
      totalThresholds: 0,
      thresholdsNeedingMigration: 0,
    };

    const allDrivers = await ctx.db.query("drivers").collect();
    status.totalDrivers = allDrivers.length;

    const classSet = new Set<string>();

    for (const driver of allDrivers) {
      const oldClass = (driver as any).driverClass;
      const hasDriverClassId = driver.driverClassId;

      // Driver needs migration if it has old driverClass but no driverClassId
      if (oldClass && !hasDriverClassId && driver.championshipId) {
        status.driversNeedingMigration++;
        classSet.add(`${driver.championshipId}:${oldClass}`);
      }
    }

    status.uniqueClassCombinations = classSet.size;

    const allThresholds = await ctx.db.query("seriesPenaltyThresholds").collect();
    status.totalThresholds = allThresholds.length;

    for (const threshold of allThresholds) {
      // Check if threshold has the old driverClasses field and needs migration
      const oldDriverClasses = (threshold as any).driverClasses;
      // Also check if it has driverClassIds but it's empty
      const hasValidDriverClassIds = threshold.driverClassIds &&
                                      Array.isArray(threshold.driverClassIds) &&
                                      threshold.driverClassIds.length > 0;

      if (oldDriverClasses && Array.isArray(oldDriverClasses) && oldDriverClasses.length > 0 && !hasValidDriverClassIds) {
        status.thresholdsNeedingMigration++;
      }
    }

    return status;
  },
});

/**
 * Remove legacy driverClass string field after migration to driverClassId
 */
export const removeLegacyDriverClassField = mutation({
  args: {},
  handler: async (ctx) => {
    const drivers = await ctx.db.query("drivers").collect();

    let removed = 0;
    for (const driver of drivers) {
      const driverDoc = driver as any;

      // Remove driverClass field if it exists
      if (driverDoc.driverClass !== undefined) {
        await ctx.db.replace(driver._id, {
          driverNumber: driver.driverNumber,
          driverName: driver.driverName,
          officialName: driver.officialName,
          username: driver.username,
          externalId: driver.externalId,
          driverClassId: driver.driverClassId,
          steamId: driver.steamId,
          championshipId: driver.championshipId,
          userId: driver.userId,
          accumulatedLicensePoints: driver.accumulatedLicensePoints,
          isActive: driver.isActive,
          createdAt: driver.createdAt,
        });
        removed++;
      }
    }

    return { removed };
  },
});

/**
 * Remove legacy email and discordGlobalName fields from users
 */
export const removeLegacyUserFields = mutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();

    let removed = 0;
    for (const user of users) {
      const userDoc = user as any;

      if (userDoc.email !== undefined || userDoc.discordGlobalName !== undefined) {
        await ctx.db.replace(user._id, {
          name: user.name,
          avatarUrl: user.avatarUrl,
          roleId: user.roleId,
          discordId: user.discordId,
          discordUsername: user.discordUsername,
          officialName: user.officialName,
          createdAt: user.createdAt,
        });
        removed++;
      }
    }

    return { removed };
  },
});

/**
 * Remove legacy secondStewardId field from reviews
 */
export const removeLegacySecondStewardField = mutation({
  args: {},
  handler: async (ctx) => {
    const reviews = await ctx.db.query("reviews").collect();

    let removed = 0;
    for (const review of reviews) {
      const reviewDoc = review as any;

      if (reviewDoc.secondStewardId !== undefined) {
        await ctx.db.replace(review._id, {
          reviewDate: review.reviewDate,
          userId: review.userId,
          reportId: review.reportId,
          incidentDescription: review.incidentDescription,
          reviewNotes: review.reviewNotes,
          candidateForStandardization: review.candidateForStandardization,
          recommendedPenalty: review.recommendedPenalty,
          atFaultDriverId: review.atFaultDriverId,
          videoTimestamp: review.videoTimestamp,
          linkedReviewId: review.linkedReviewId,
          isSelfReport: review.isSelfReport,
          isAdjusted: review.isAdjusted,
          adjustedReason: review.adjustedReason,
          createdAt: review.createdAt,
          updatedAt: review.updatedAt,
        });
        removed++;
      }
    }

    return { removed };
  },
});

/**
 * Backfill steamUserMappings from existing linked drivers.
 *
 * This ensures each driver with both `steamId` and `userId` has a corresponding
 * steamUserMappings record, and optionally resolves conflicting mappings.
 */
export const backfillSteamUserMappings = mutation({
  args: {
    dryRun: v.optional(v.boolean()),
    resolveConflicts: v.optional(v.boolean()),
    linkUnassignedDrivers: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? true;
    const resolveConflicts = args.resolveConflicts ?? false;
    const linkUnassignedDrivers = args.linkUnassignedDrivers ?? false;

    const [drivers, existingMappings] = await Promise.all([
      ctx.db.query("drivers").collect(),
      ctx.db.query("steamUserMappings").collect(),
    ]);

    const mappingsBySteamId = new Map<string, typeof existingMappings>();
    for (const mapping of existingMappings) {
      const rows = mappingsBySteamId.get(mapping.steamId) ?? [];
      rows.push(mapping);
      mappingsBySteamId.set(mapping.steamId, rows);
    }

    let duplicateMappingsFound = 0;
    let duplicateMappingsDeleted = 0;
    let mappingsCreated = 0;
    let mappingsAlreadyValid = 0;
    let conflictsFound = 0;
    let conflictsResolved = 0;
    let driversLinkedFromMapping = 0;

    const duplicates: Array<{ steamId: string; deletedMappingIds: Id<"steamUserMappings">[] }> = [];
    const conflicts: Array<{
      steamId: string;
      driverId: Id<"drivers">;
      driverUserId: Id<"users">;
      mappedUserId: Id<"users">;
      mappingId: Id<"steamUserMappings">;
    }> = [];

    const canonicalBySteamId = new Map<string, (typeof existingMappings)[number]>();
    for (const [steamId, rows] of mappingsBySteamId.entries()) {
      const sorted = [...rows].sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
      const keeper = sorted[0];
      canonicalBySteamId.set(steamId, keeper);

      if (sorted.length > 1) {
        duplicateMappingsFound += sorted.length - 1;
        const duplicateIds = sorted.slice(1).map((row) => row._id);
        duplicates.push({ steamId, deletedMappingIds: duplicateIds });

        if (!dryRun) {
          for (const row of sorted.slice(1)) {
            await ctx.db.delete(row._id);
            duplicateMappingsDeleted++;
          }
        }
      }
    }

    for (const driver of drivers) {
      const steamId = driver.steamId?.trim();
      if (!steamId) continue;

      const existing = canonicalBySteamId.get(steamId);

      if (!driver.userId) {
        if (linkUnassignedDrivers && existing) {
          if (!dryRun) {
            await ctx.db.patch(driver._id, { userId: existing.userId });
          }
          driversLinkedFromMapping++;
        }
        continue;
      }

      if (!existing) {
        if (!dryRun) {
          const newId = await ctx.db.insert("steamUserMappings", {
            steamId,
            userId: driver.userId,
            isBanned: false,
            createdAt: Date.now(),
          });
          canonicalBySteamId.set(steamId, {
            _id: newId,
            _creationTime: Date.now(),
            steamId,
            userId: driver.userId,
            isBanned: false,
            createdAt: Date.now(),
          } as any);
        }
        mappingsCreated++;
        continue;
      }

      if (existing.userId === driver.userId) {
        mappingsAlreadyValid++;
        continue;
      }

      conflictsFound++;
      conflicts.push({
        steamId,
        driverId: driver._id,
        driverUserId: driver.userId,
        mappedUserId: existing.userId,
        mappingId: existing._id,
      });

      if (resolveConflicts) {
        if (!dryRun) {
          await ctx.db.patch(existing._id, { userId: driver.userId });
        }
        conflictsResolved++;
      }
    }

    return {
      dryRun,
      resolveConflicts,
      linkUnassignedDrivers,
      totalDrivers: drivers.length,
      totalMappings: existingMappings.length,
      duplicateMappingsFound,
      duplicateMappingsDeleted,
      mappingsCreated,
      mappingsAlreadyValid,
      conflictsFound,
      conflictsResolved,
      driversLinkedFromMapping,
      duplicates,
      conflicts,
    };
  },
});

/**
 * Reconciles Drivers 2.0 consistency:
 * - ensures `isActive` is set
 * - recalculates `accumulatedLicensePoints` from finalized reports
 */
export const reconcileDriversV2Consistency = mutation({
  args: {
    dryRun: v.optional(v.boolean()),
    seriesId: v.optional(v.id("series")),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? true;

    let drivers = await ctx.db.query("drivers").collect();
    if (args.seriesId) {
      drivers = drivers.filter((driver) => driver.championshipId === args.seriesId);
    }

    let updatedDrivers = 0;
    let fixedIsActive = 0;
    let fixedPoints = 0;
    const changes: Array<{
      driverId: Id<"drivers">;
      driverNumber: number;
      driverName: string;
      fromPoints: number;
      toPoints: number;
      fromIsActive: boolean | null;
      toIsActive: boolean;
    }> = [];

    for (const driver of drivers) {
      const reports = await ctx.db
        .query("reports")
        .withIndex("by_reported_driver", (q) => q.eq("reportedDriverId", driver._id))
        .collect();

      let expectedPoints = 0;
      for (const report of reports) {
        if (report.status !== "finalized") continue;

        const effectiveAtFaultDriverId = report.atFaultDriverId ?? report.reportedDriverId;
        if (effectiveAtFaultDriverId !== driver._id) continue;
        if (!report.appliedPenalty) continue;

        const penalty = (await ctx.db.get(report.appliedPenalty as any)) as any;
        expectedPoints += penalty?.licensePoints ?? 0;
      }

      const currentPoints = driver.accumulatedLicensePoints ?? 0;
      const currentIsActive = driver.isActive;
      const nextIsActive = currentIsActive ?? true;

      const shouldFixPoints = currentPoints !== expectedPoints;
      const shouldFixIsActive = currentIsActive === undefined;
      if (!shouldFixPoints && !shouldFixIsActive) continue;

      changes.push({
        driverId: driver._id,
        driverNumber: driver.driverNumber,
        driverName: driver.driverName,
        fromPoints: currentPoints,
        toPoints: expectedPoints,
        fromIsActive: currentIsActive ?? null,
        toIsActive: nextIsActive,
      });

      if (!dryRun) {
        const patch: { accumulatedLicensePoints?: number; isActive?: boolean } = {};
        if (shouldFixPoints) patch.accumulatedLicensePoints = expectedPoints;
        if (shouldFixIsActive) patch.isActive = true;
        await ctx.db.patch(driver._id, patch);
      }

      if (shouldFixIsActive) fixedIsActive++;
      if (shouldFixPoints) fixedPoints++;
      updatedDrivers++;
    }

    return {
      dryRun,
      seriesId: args.seriesId ?? null,
      scannedDrivers: drivers.length,
      updatedDrivers,
      fixedIsActive,
      fixedPoints,
      changes,
    };
  },
});

/**
 * Backfill `races.sessionName` from existing `raceNumber` values.
 *
 * Safe in-place migration:
 * - preserves all existing documents and IDs
 * - only patches rows missing a valid `sessionName`
 */
export const backfillRaceSessions = mutation({
  args: {
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? true;
    const races = await ctx.db.query("races").collect();

    let scanned = 0;
    let wouldUpdate = 0;
    let updated = 0;
    const changes: Array<{
      raceId: Id<"races">;
      fromSessionName: string | null;
      toSessionName: string;
    }> = [];

    for (const race of races) {
      scanned++;

      const currentSessionName =
        typeof race.sessionName === "string" ? race.sessionName.trim() : "";
      if (currentSessionName) {
        continue;
      }

      const toSessionName =
        typeof race.raceNumber === "number" ? `Race ${race.raceNumber}` : "Session";

      wouldUpdate++;
      changes.push({
        raceId: race._id,
        fromSessionName: race.sessionName ?? null,
        toSessionName,
      });

      if (!dryRun) {
        await ctx.db.patch(race._id, { sessionName: toSessionName });
        updated++;
      }
    }

    return {
      dryRun,
      scanned,
      wouldUpdate,
      updated,
      changes,
    };
  },
});
