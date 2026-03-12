/**
 * Shared type definitions for route data and navigation.
 *
 * These interfaces define the contract between route configuration
 * and components that consume route data.
 */

/**
 * Route data for tabs that identify their content type.
 * Used by components like ReportListComponent and StatisticsDashboardComponent
 * to determine which tab/content to display.
 */
export interface RouteWithTabData {
  /** Identifier for the tab/content */
  tabId: string;
}

/**
 * Route data for redirect routes that forward to other locations.
 * Used by RouteRedirectComponent to handle backwards compatibility.
 */
export interface RouteWithRedirectData {
  /** Navigation commands for the default redirect target */
  redirectCommands: readonly string[];
  /** Optional mapping of legacy tab query params to new route commands */
  legacyTabMap?: Readonly<Record<string, readonly string[]>>;
}

/**
 * Route data for protected routes that need a fallback redirect on auth failure.
 * Used by roleGuard to determine where to redirect unauthorized users.
 */
export interface RouteWithFallbackData {
  /** Navigation commands for the fallback route when auth fails */
  fallbackCommands?: readonly string[];
}

/**
 * Tab ID constants for Reports feature.
 * Provides type safety and eliminates magic strings.
 */
export const REPORT_TABS = {
  /** User's own reports */
  MY: "my_reports",
  /** All finalized reports */
  FINALIZED: "finalized_reports",
  /** All reports (admin/head steward only) */
  ALL: "all_reports",
} as const;

export type ReportTabId = (typeof REPORT_TABS)[keyof typeof REPORT_TABS];

/**
 * Tab ID constants for Reviews feature.
 */
export const REVIEW_TABS = {
  /** Queue of pending reviews */
  QUEUE: "queue",
  /** Current user's submitted reviews */
  MY_REVIEWS: "my-reviews",
  /** Review search (head steward/league manager only) */
  SEARCH: "search",
  /** Finalization queue (head steward/league manager only) */
  FINALIZATION: "finalization",
} as const;

export type ReviewTabId = (typeof REVIEW_TABS)[keyof typeof REVIEW_TABS];

/**
 * Tab ID constants for Statistics feature.
 */
export const STATISTICS_TABS = {
  /** Event rundown view */
  EVENT_RUNDOWN: "event_rundown",
  /** Series overview/points (head steward/event manager/league manager only) */
  SERIES_OVERVIEW: "series_overview",
  /** Time penalty summary */
  TIME_PENALTY_SUMMARY: "time_penalty_summary",
} as const;

export type StatisticsTabId =
  (typeof STATISTICS_TABS)[keyof typeof STATISTICS_TABS];

/**
 * Helper type for route data that can include any of the above.
 */
export type NavigationRouteData = RouteWithTabData &
  RouteWithRedirectData &
  RouteWithFallbackData;
