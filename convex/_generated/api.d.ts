/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as actions from "../actions.js";
import type * as auth from "../auth.js";
import type * as changeHistory from "../changeHistory.js";
import type * as cleanup from "../cleanup.js";
import type * as debug from "../debug.js";
import type * as discord from "../discord.js";
import type * as driverClasses from "../driverClasses.js";
import type * as driverMeetingDiscord from "../driverMeetingDiscord.js";
import type * as driverMeetingThreads from "../driverMeetingThreads.js";
import type * as driverSeriesPenalties from "../driverSeriesPenalties.js";
import type * as drivers from "../drivers.js";
import type * as events from "../events.js";
import type * as lib_audit from "../lib/audit.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_formatting from "../lib/formatting.js";
import type * as lib_penalties from "../lib/penalties.js";
import type * as lib_reportValidation from "../lib/reportValidation.js";
import type * as lib_reports from "../lib/reports.js";
import type * as lib_result from "../lib/result.js";
import type * as migrations from "../migrations.js";
import type * as migrations_backfillReportIds from "../migrations/backfillReportIds.js";
import type * as penalties from "../penalties.js";
import type * as raceBanReviewDiscord from "../raceBanReviewDiscord.js";
import type * as raceBanReviews from "../raceBanReviews.js";
import type * as races from "../races.js";
import type * as reportCounter from "../reportCounter.js";
import type * as reports from "../reports.js";
import type * as reviews from "../reviews.js";
import type * as scheduledImports from "../scheduledImports.js";
import type * as seed from "../seed.js";
import type * as series from "../series.js";
import type * as seriesCopy from "../seriesCopy.js";
import type * as seriesPenalties from "../seriesPenalties.js";
import type * as seriesPenaltyThresholds from "../seriesPenaltyThresholds.js";
import type * as statistics from "../statistics.js";
import type * as steamUserMappings from "../steamUserMappings.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  actions: typeof actions;
  auth: typeof auth;
  changeHistory: typeof changeHistory;
  cleanup: typeof cleanup;
  debug: typeof debug;
  discord: typeof discord;
  driverClasses: typeof driverClasses;
  driverMeetingDiscord: typeof driverMeetingDiscord;
  driverMeetingThreads: typeof driverMeetingThreads;
  driverSeriesPenalties: typeof driverSeriesPenalties;
  drivers: typeof drivers;
  events: typeof events;
  "lib/audit": typeof lib_audit;
  "lib/auth": typeof lib_auth;
  "lib/errors": typeof lib_errors;
  "lib/formatting": typeof lib_formatting;
  "lib/penalties": typeof lib_penalties;
  "lib/reportValidation": typeof lib_reportValidation;
  "lib/reports": typeof lib_reports;
  "lib/result": typeof lib_result;
  migrations: typeof migrations;
  "migrations/backfillReportIds": typeof migrations_backfillReportIds;
  penalties: typeof penalties;
  raceBanReviewDiscord: typeof raceBanReviewDiscord;
  raceBanReviews: typeof raceBanReviews;
  races: typeof races;
  reportCounter: typeof reportCounter;
  reports: typeof reports;
  reviews: typeof reviews;
  scheduledImports: typeof scheduledImports;
  seed: typeof seed;
  series: typeof series;
  seriesCopy: typeof seriesCopy;
  seriesPenalties: typeof seriesPenalties;
  seriesPenaltyThresholds: typeof seriesPenaltyThresholds;
  statistics: typeof statistics;
  steamUserMappings: typeof steamUserMappings;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  shardedCounter: {
    public: {
      add: FunctionReference<
        "mutation",
        "internal",
        { count: number; name: string; shard?: number; shards?: number },
        number
      >;
      count: FunctionReference<"query", "internal", { name: string }, number>;
      estimateCount: FunctionReference<
        "query",
        "internal",
        { name: string; readFromShards?: number; shards?: number },
        any
      >;
      rebalance: FunctionReference<
        "mutation",
        "internal",
        { name: string; shards?: number },
        any
      >;
      reset: FunctionReference<"mutation", "internal", { name: string }, any>;
    };
  };
};
