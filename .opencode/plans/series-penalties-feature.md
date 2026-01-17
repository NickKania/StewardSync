# Series Penalties Feature Implementation Plan

## Overview

This feature adds automatic penalty assignments based on accumulated license points within a racing series. Event managers can configure license point thresholds with associated penalties, and the system will automatically track and display these penalties for drivers who exceed the thresholds. Head stewards and event managers can mark penalties as "served".

## Requirements

1. Event managers can add series penalties based on license point thresholds
2. Series management view displays a "series penalties" section
3. Series statistics view shows active series penalties for drivers
4. Head stewards and event managers can mark penalties as "served"
5. Automatic detection when thresholds are exceeded

## Database Schema Changes

### 1. Add `seriesPenalties` table
```typescript
seriesPenalties: defineTable({
  seriesId: v.id("series"),
  threshold: v.number(),  // License point threshold
  penaltyName: v.string(), // Name of penalty (e.g., "Grid Penalty", "Race Ban")
  penaltyDescription: v.optional(v.string()),
  createdAt: v.number(),
}).index("by_series", ["seriesId"]),
```

### 2. Add `driverSeriesPenalties` table
```typescript
driverSeriesPenalties: defineTable({
  driverId: v.id("drivers"),
  seriesId: v.id("series"),
  seriesPenaltyId: v.id("seriesPenalties"),
  isServed: v.boolean(),
  pointsAtAssignment: v.number(),
  assignedAt: v.number(),
  servedAt: v.optional(v.number()),
  servedBy: v.optional(v.id("users")),
}).index("by_driver_and_series", ["driverId", "seriesId"])
  .index("by_series", ["seriesId"]),
```

## Backend Implementation (Convex)

### 1. Create `convex/seriesPenalties.ts`
```typescript
// Queries
export const list = query({...}); // Get all series penalties
export const getBySeries = query({...}); // Get penalties for a series

// Mutations
export const create = mutation({...}); // Create series penalty threshold
export const update = mutation({...}); // Update series penalty threshold
export const remove = mutation({...}); // Delete series penalty threshold
```

### 2. Create `convex/driverSeriesPenalties.ts`
```typescript
// Queries
export const getByDriverAndSeries = query({...}); // Get driver's series penalties
export const getBySeries = query({...}); // Get all series penalties for drivers

// Mutations
export const assignPenalty = mutation({...}); // Assign penalty to driver
export const markAsServed = mutation({...}); // Mark penalty as served
export const checkAndAssignThresholds = mutation({...}); // Auto-assign when threshold reached
```

### 3. Update `convex/statistics.ts`
```typescript
export const getSeriesLicensePointsWithPenalties = query({
  args: { seriesId: v.id("series") },
  handler: async (ctx, args) => {
    // Get all driver license points
    // Get all series penalties
    // Get all driver series penalties
    // Check for unassigned thresholds
    // Return consolidated data with active penalties
  }
});
```

## Frontend Implementation

### 1. Update Models (`src/app/core/models/series.model.ts`)

Add new interfaces:
```typescript
export interface SeriesPenalty {
  _id: Id<'seriesPenalties'>;
  seriesId: Id<'series'>;
  threshold: number;
  penaltyName: string;
  penaltyDescription?: string;
  createdAt: number;
}

export interface DriverSeriesPenalty {
  _id: Id<'driverSeriesPenalties'>;
  driverId: Id<'drivers'>;
  seriesId: Id<'series'>;
  seriesPenaltyId: Id<'seriesPenalties'>;
  isServed: boolean;
  pointsAtAssignment: number;
  assignedAt: number;
  servedAt?: number;
  servedBy?: Id<'users'>;
  driver?: Driver;
  seriesPenalty?: SeriesPenalty;
  servedByUser?: User;
}

export interface SeriesLicensePointsWithPenalties {
  driverId: string;
  driverNumber: number;
  driverName: string;
  totalLicensePoints: number;
  seriesPenalties: DriverSeriesPenalty[];
}
```

### 2. Update Series Management View

**File:** `src/app/features/admin/series-management/series-management.component.ts`

Additions:
- New section for "Series Penalties" alongside "Penalties"
- Modal for creating/editing series penalty thresholds
- Form fields: threshold (number), penalty name (string), penalty description (optional)
- Display list of configured thresholds in a card layout
- Delete functionality for series penalty thresholds

### 3. Update Statistics View

**File:** `src/app/features/statistics/statistics-dashboard/statistics-dashboard.component.ts`

Additions:
- Add "Series Penalties Overview" card
- Show table with columns: Car #, Driver, Total Points, Active Penalties
- Show "Mark as Served" button for head stewards and event managers
- Display badge for penalty status (active/served)

## Detailed Implementation Steps

### Phase 1: Backend (Convex)

1. Update `convex/schema.ts`
   - Add `seriesPenalties` table
   - Add `driverSeriesPenalties` table
   - Run `bunx convex dev` to regenerate types

2. Create `convex/seriesPenalties.ts`
   - Implement `list` query
   - Implement `getBySeries` query
   - Implement `create` mutation
   - Implement `update` mutation
   - Implement `remove` mutation

3. Create `convex/driverSeriesPenalties.ts`
   - Implement `getByDriverAndSeries` query
   - Implement `getBySeries` query
   - Implement `assignPenalty` mutation
   - Implement `markAsServed` mutation
   - Implement `checkAndAssignThresholds` mutation

4. Update `convex/statistics.ts`
   - Implement `getSeriesLicensePointsWithPenalties` query
   - This should automatically call `checkAndAssignThresholds` when data is loaded

### Phase 2: Frontend Models

1. Update `src/app/core/models/series.model.ts`
   - Add `SeriesPenalty` interface
   - Add `DriverSeriesPenalty` interface
   - Add `SeriesLicensePointsWithPenalties` interface

### Phase 3: Series Management View

1. Update `src/app/features/admin/series-management/series-management.component.ts`
   - Add imports for new models
   - Add `seriesPenalties` signal
   - Add loading states and form state variables
   - Add `loadSeriesPenalties()` method
   - Add helper method `getSeriesPenaltiesForSeries(seriesId)`
   - Add `addSeriesPenalty(seriesId)` method
   - Add `editSeriesPenalty(seriesPenalty)` method
   - Add `saveSeriesPenalty()` async method
   - Add `deleteSeriesPenalty(seriesPenaltyId)` async method
   - Add `closeSeriesPenaltyModal()` method

2. Update template in `series-management.component.ts`
   - Add "Series Penalties" section in each series card
   - Add "Add Series Penalty" button
   - Add grid layout for series penalty cards
   - Add series penalty modal with form fields
   - Display threshold, penalty name, and description

### Phase 4: Statistics View

1. Update `src/app/features/statistics/statistics-dashboard/statistics-dashboard.component.ts`
   - Add `seriesPointsWithPenalties` signal
   - Update `loadSeriesPoints()` to use new query
   - Add `canMarkAsServed()` computed property
   - Add `markAsServed(driverSeriesPenaltyId)` async method

2. Update template in `statistics-dashboard.component.ts`
   - Add "Series Penalties Overview" card (visible to head_steward+)
   - Add table columns for driver info and penalties
   - Add expandable rows for penalty details
   - Add "Mark as Served" button (conditional on role and penalty status)
   - Add badges for penalty status

### Phase 5: Testing

1. Backend Testing
   - Test creating series penalty thresholds
   - Test updating thresholds
   - Test deleting thresholds
   - Test automatic penalty assignment when threshold reached
   - Test marking penalties as served
   - Test that penalties aren't reassigned after being served

2. Frontend Testing
   - Test series management UI for creating/editing/deleting series penalties
   - Test statistics view displays correct driver penalties
   - Test role-based access control for viewing series penalties
   - Test role-based access control for marking penalties as served
   - Test data updates in real-time (reactive queries)

## UI Mockups

### Series Management - Series Card with Series Penalties Section

```
┌─────────────────────────────────────────────────────────┐
│ F1 2024                                [Edit] [Delete]  │
│ Description text...                                         │
│ [View on SimGrid]                                         │
├─────────────────────────────────────────────────────────┤
│ Penalties                              [+ Add Penalty]  │
│ ┌──────────────────┐  ┌──────────────────┐              │
│ │ Track Limits     │  │ Avoidable Contact│              │
│ │ Time: 5s         │  │ Time: 10s        │              │
│ │ SR: 3s           │  │ SR: 7s           │              │
│ │ Points: 2        │  │ Points: 5        │              │
│ └──────────────────┘  └──────────────────┘              │
├─────────────────────────────────────────────────────────┤
│ Series Penalties                    [+ Add Threshold]   │
│ ┌──────────────────┐  ┌──────────────────┐              │
│ │ 10 Points        │  │ 20 Points        │              │
│ │ Grid Penalty     │  │ Race Ban        │              │
│ │ Back 5 positions │  │ 1 race ban      │              │
│ └──────────────────┘  └──────────────────┘              │
└─────────────────────────────────────────────────────────┘
```

### Statistics View - Series Penalties Overview

```
┌─────────────────────────────────────────────────────────┐
│ Series Penalties Overview                [Export Image]  │
│ F1 2024                                                   │
├─────────────────────────────────────────────────────────┤
│ Car #  │ Driver      │ Points │ Active Penalties        │
├─────────────────────────────────────────────────────────┤
│ 44     │ Lewis H.    │ 12     │ Grid Penalty [Served]   │
│ └─────────────────────────────────────────────────────────┤
│ 77     │ Valtteri B. │ 8      │ -                       │
├─────────────────────────────────────────────────────────┤
│ 3      │ Daniel R.   │ 23     │ Grid Penalty [Served]   │
│ │                              │ Race Ban [Active]      │
│ │                              │ [Mark Served]           │
└─────────────────────────────────────────────────────────┘
```

## Authorization Matrix

| Action                    | Driver | Steward | Head Steward | Event Manager |
|---------------------------|--------|---------|--------------|---------------|
| View series penalties     | ❌     | ❌      | ✅           | ✅            |
| Configure thresholds      | ❌     | ❌      | ❌           | ✅            |
| Mark as served            | ❌     | ❌      | ✅           | ✅            |

## Edge Cases & Considerations

1. **Multiple Thresholds**: A driver could trigger multiple thresholds (e.g., 10, 20, 30 points)
2. **Penalty Already Served**: Don't reassign same threshold after serving
3. **Series Deletion**: Handle cleanup of related records
4. **Driver Removal**: Keep penalty records for historical accuracy
5. **Threshold Updates**: How to handle if threshold changes after penalties assigned
6. **Order of Penalties**: Display penalties in order of assignment (oldest first)
7. **No Thresholds Configured**: Gracefully handle series without thresholds
8. **Real-time Updates**: Statistics should update automatically when new penalties are assigned

## Success Criteria

✅ Event managers can create/edit/delete series penalty thresholds
✅ Statistics view displays drivers with active series penalties
✅ Head stewards and event managers can mark penalties as served
✅ Penalties are automatically assigned when license point thresholds are reached
✅ UI follows existing design patterns
✅ Authorization rules are enforced
✅ Real-time updates work correctly
