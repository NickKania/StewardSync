# Implementation Plan: Filter Events by Active Series

## Overview
Update event dropdowns in report-list and statistics-dashboard to only show events for active series.

## Changes Required

### 1. Report List Component (`src/app/features/reports/report-list/report-list.component.ts`)

**Changes:**
- Add signal to store active series
- Load active series using `this.convex.api.series.listActive`
- Extract active series IDs into a computed or signal
- Filter events to only include those with active series IDs
- Update `eventOptions` signal to use filtered events

**Pattern to follow (from driver-list.component.ts):**
```typescript
// Load active series
const activeSeriesQuery = this.convex.createReactiveQuery(
  this.convex.api.series.listActive,
  {}
);
// Extract active series IDs
const activeSeriesIds = computed(() =>
  this.activeSeries().map(s => s._id.toString())
);
// Filter events
const filteredEvents = computed(() =>
  this.events().filter(e =>
    activeSeriesIds().includes(e.seriesId.toString())
  )
);
```

### 2. Statistics Dashboard Component (`src/app/features/statistics/statistics-dashboard/statistics-dashboard.component.ts`)

**Changes:**
- Already loads active series in `loadData()` (line 980-993)
- Add computed property for active series IDs
- Update `eventOptions` computed property to filter events by active series IDs

**Pattern:**
```typescript
activeSeriesIds = computed(() =>
  this.series().map(s => s._id.toString())
);

// Update existing eventOptions computed (line 620-628)
eventOptions = computed(() => {
  const activeIds = this.activeSeriesIds();
  const filteredEvents = this.events().filter(e =>
    activeIds.includes(e.seriesId.toString())
  );
  return [
    { value: "", label: "Choose an event" },
    ...filteredEvents.map((e: any) => ({
      value: e._id,
      label: `${e.trackName} (${e.series.name})`,
    })),
  ];
});
```

## Implementation Steps

### Report List Component
1. Add `activeSeries` signal
2. Add `activeSeriesIds` computed property
3. Load active series in `loadData()` method
4. Update `eventOptions` signal to filter events

### Statistics Dashboard Component
1. Add `activeSeriesIds` computed property
2. Update `eventOptions` computed to filter events

## Verification
- Test report list: event dropdown should only show events from active series
- Test statistics dashboard: event dropdown should only show events from active series
- Verify filtering works correctly when series are marked inactive
