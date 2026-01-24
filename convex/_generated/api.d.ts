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
import type * as driverSeriesPenalties from "../driverSeriesPenalties.js";
import type * as drivers from "../drivers.js";
import type * as events from "../events.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_reports from "../lib/reports.js";
import type * as lib_result from "../lib/result.js";
import type * as migrations from "../migrations.js";
import type * as penalties from "../penalties.js";
import type * as races from "../races.js";
import type * as reports from "../reports.js";
import type * as reviews from "../reviews.js";
import type * as seed from "../seed.js";
import type * as series from "../series.js";
import type * as seriesPenalties from "../seriesPenalties.js";
import type * as seriesPenaltyThresholds from "../seriesPenaltyThresholds.js";
import type * as statistics from "../statistics.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  actions: typeof actions;
  auth: typeof auth;
  driverSeriesPenalties: typeof driverSeriesPenalties;
  drivers: typeof drivers;
  events: typeof events;
  "lib/auth": typeof lib_auth;
  "lib/errors": typeof lib_errors;
  "lib/reports": typeof lib_reports;
  "lib/result": typeof lib_result;
  migrations: typeof migrations;
  penalties: typeof penalties;
  races: typeof races;
  reports: typeof reports;
  reviews: typeof reviews;
  seed: typeof seed;
  series: typeof series;
  seriesPenalties: typeof seriesPenalties;
  seriesPenaltyThresholds: typeof seriesPenaltyThresholds;
  statistics: typeof statistics;
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

export declare const components: {};
