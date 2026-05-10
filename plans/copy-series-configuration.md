# Copy Series Configuration

## Overview

Create a "Copy Series" feature that duplicates penalty configurations (individual penalties, series penalties, thresholds) and session templates from one series to another. Matching is done via text fields rather than IDs since IDs differ between series.

## What Gets Copied

| Entity | Source | Target | Matching Strategy |
|---|---|---|---|
| **Penalties** (individual: time penalty, license points, etc.) | `penalties` by source series | `penalties` under target series | Direct copy by name — create identical entries under target series |
| **Series Penalties** (cumulative: "Race Ban", "Probation", etc.) | `seriesPenalties` by source series | `seriesPenalties` under target series | Direct copy by name under target series |
| **Series Penalty Thresholds** (threshold values + driver class mapping) | `seriesPenaltyThresholds` for each source series penalty | `seriesPenaltyThresholds` under new target series penalties | Match `className` from source driver classes to target driver classes; create threshold with matched class IDs (empty array if no match) |
| **Sessions** (race/session names per event) | `races` grouped by source event number | `races` under matching target events | Match events by `eventNumber`; copy session patterns (name, raceNumber) to matching target events |

## What Does NOT Get Copied

- `driverSeriesPenalties` (assigned penalties — runtime data)
- `raceBanReviews` (runtime data)
- Events themselves (they already exist on the target)
- Drivers or driver classes themselves

## Design Decisions

- **Driver class matching**: By `className` (e.g., "AM", "PRO") — more stable than `displayName`
- **Confirmation flow**: Preview + Confirm — user sees what will be copied before executing
- **Unmatched driver classes**: Create thresholds with empty `driverClassIds` array; include in warnings
- **Individual penalties**: Included in copy scope (not just series penalties)
- **Duplicate detection**: If target already has a penalty/series penalty with the same name, skip it and report in preview

## Architecture

### 1. Convex Backend — `convex/seriesCopy.ts`

#### Query: `seriesCopy:preview`

- **Args:** `{ sourceSeriesId, targetSeriesId, currentUserId }`
- **Permission:** `event_manager` or `league_manager`
- **Logic:**
  1. Validate source and target are different series
  2. Fetch source data:
     - `penalties` for source series
     - `seriesPenalties` for source series, with their `seriesPenaltyThresholds` (populated with driver class objects to get `className`)
     - `races` for source series (grouped by their event's `eventNumber`)
  3. Fetch target data:
     - `driverClasses` for target series (keyed by `className` for lookup)
     - `events` for target series (keyed by `eventNumber` for lookup)
     - Existing `penalties` for target series (to detect name conflicts)
     - Existing `seriesPenalties` for target series (to detect name conflicts)
     - Existing `races` for target events (to detect session name conflicts)
- **Returns:**
  ```typescript
  interface SeriesCopyPreview {
    penalties: {
      toCreate: Array<{ name: string; timePenalty: number; licensePoints: number; /* ... */ }>;
      alreadyExists: string[]; // penalty names that already exist in target
    };
    seriesPenalties: Array<{
      penaltyName: string;
      penaltyDescription?: string;
      thresholds: Array<{
        threshold: number;
        requiresReview: boolean;
        sourceClasses: string[];       // classNames from source
        matchedClassIds: Id<"driverClasses">[]; // matched in target
        unmatchedClasses: string[];    // classNames with no target match
      }>;
    }>;
    sessions: {
      byEvent: Record<number, {
        toCreate: Array<{ raceNumber?: number; sessionName?: string }>;
        alreadyExists: string[]; // session names that already exist
      }>;
      eventsNotFound: number[]; // event numbers in source with no target match
    };
  }
  ```

#### Mutation: `seriesCopy:execute`

- **Args:** `{ sourceSeriesId, targetSeriesId, currentUserId }`
- **Permission:** `event_manager` or `league_manager`
- **Logic:** Same as preview but actually performs inserts:
  1. Create `penalties` that don't already exist in target (by name match)
  2. Create `seriesPenalties` that don't already exist in target (by name match)
  3. For each new series penalty, create its thresholds with matched driver class IDs
  4. For each matched event, create sessions that don't already exist (by session name match within the event)
- **Returns:**
  ```typescript
  interface SeriesCopyResult {
    penaltiesCreated: number;
    penaltiesSkipped: number;
    seriesPenaltiesCreated: number;
    seriesPenaltiesSkipped: number;
    thresholdsCreated: number;
    sessionsCreated: number;
    sessionsSkipped: number;
    warnings: string[];
  }
  ```

#### Text Matching Logic

- **Driver classes:**
  1. For each source threshold, look up its `driverClassIds`
  2. Fetch each source driver class to get `className`
  3. Find target `driverClasses` with matching `className` using the `by_series_class` index
  4. Use matched target class IDs; track unmatched classNames in warnings

- **Sessions:**
  1. Group source `races` by their parent event's `eventNumber`
  2. Find target events with matching `eventNumber` using the `by_series_and_number` index
  3. For each matched event, compare source session names against existing target races
  4. Create only sessions that don't already exist in the target event

### 2. Frontend — `series-management.component.ts`

Add a "Copy from Series" button and modal to the existing series management component.

#### UI Flow

1. **Trigger**: "Copy from Series" button in the series management header area
2. **Modal opens with:**
   - Current series displayed as target (read-only)
   - Dropdown to select **source series** (all series except current)
   - "Preview Copy" button
3. **Preview state** (after clicking Preview):
   - **Penalties section:** List of penalties to create (green) and ones to skip due to duplicates (yellow/warning)
   - **Series Penalties section:** Each series penalty with its thresholds, showing class matching:
     - Matched classes shown in green with target class name
     - Unmatched classes shown in red/warning with source class name
   - **Sessions section:** Per-event breakdown of sessions to create, with warnings for events not found in target
   - Summary counts at the bottom
   - "Execute Copy" and "Cancel" buttons
4. **Result state** (after executing):
   - Success toast with summary (e.g., "Copied 5 penalties, 3 series penalties, 8 thresholds, 12 sessions")
   - Any warnings displayed
   - Modal closes, series management view refreshes

### 3. Models — `src/app/core/models/series.model.ts`

Add TypeScript interfaces for `SeriesCopyPreview` and `SeriesCopyResult`.

## Edge Cases

| Edge Case | Handling |
|---|---|
| Source and target are the same series | Reject with error message |
| Target already has a penalty with the same name | Skip (report in preview/warnings) |
| Target already has a series penalty with the same name | Skip (report in preview/warnings) |
| Driver class has no match in target | Create threshold with empty `driverClassIds`; include in warnings |
| Event number from source has no match in target | Skip all sessions for that event; include in warnings |
| Source series has no penalties/thresholds/sessions | Return empty preview with informational message |
| User lacks permission | Return permission error (handled by `requireRole`) |

## Files to Create/Modify

| File | Action | Description |
|---|---|---|
| `convex/seriesCopy.ts` | Create | Preview query + execute mutation |
| `src/app/features/admin/series-management/series-management.component.ts` | Modify | Add "Copy from Series" button, preview modal, confirm/execute flow |
| `src/app/core/models/series.model.ts` | Modify | Add `SeriesCopyPreview`, `SeriesCopyResult`, and related interfaces |

## Future Considerations

- Could add a "dry run" flag to the execute mutation for extra safety
- Could support partial execution (e.g., copy only penalties, or only sessions)
- Could add undo functionality (track copied IDs and provide a rollback mutation)
