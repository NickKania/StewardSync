# Component: ReportListComponent Series Selector

## Interface

### New Signals
```typescript
series = signal<any[]>([]);
selectedSeries = "";
seriesOptions = computed<SelectOption[]>(...)
eventOptions = computed<SelectOption[]>(...)  // Changed to computed
```

### Component State Changes
- Load series data on init (alongside events)
- Event options become computed based on selected series
- Filter reports by selected series

## Test Strategy
- Series selector loads and displays series options
- Event selector updates based on series selection
- Reports filter correctly when series is selected
- Reports filter correctly when both series and event are selected
- Event selection resets when series changes

## Tasks

### Step 1: Add Series Data Loading
- [ ] Add `series` signal to component
- [ ] Add series reactive query in `loadData()` using `convex.api.series.listActive`
- [ ] Add `seriesLoaded` signal (or use loading completion logic)

### Step 2: Add Series Options Computed Property
- [ ] Convert `eventOptions` from signal to computed property
- [ ] Add `seriesOptions` computed property with "All series" option
- [ ] Update `eventOptions` to filter events by selected series

### Step 3: Add Series Selector UI
- [ ] Add series selector dropdown in template (before event selector)
- [ ] Use SelectComponent with options binding
- [ ] Bind to `selectedSeries` with `(ngModelChange)="filterReports()"`

### Step 4: Update Filter Logic
- [ ] Add series filtering to `filterReports()` method
- [ ] Reset `selectedEvent` when series changes
- [ ] Ensure filter works with series only, event only, or both

### Step 5: Validation
- [ ] Verify series selector loads and displays options
- [ ] Verify event selector updates when series changes
- [ ] Verify reports filter correctly
- [ ] Check that existing event-only filtering still works

## Verification
- Series dropdown appears before event dropdown
- Series options load from Convex
- Event options update dynamically based on series selection
- Reports filter correctly with series, event, or both
- Event selection resets appropriately when series changes
