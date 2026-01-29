# Component: StatisticsDashboardComponent Series Selector for Event Rundown

## Interface

### Template Changes
- Add series selector in Event Rundown tab (before event selector)
- Same UI pattern as existing selectors

### Component State Changes
- Series data already loaded
- Change `eventOptions` from signal to computed property
- Filter event options by selected series
- Add `selectedSeriesForEvent` signal (separate from series overview tab's selectedSeriesId)

### New Signals
```typescript
selectedSeriesForEvent = "";
```

## Test Strategy
- Series selector appears in event rundown tab only
- Event selector updates based on series selection
- Event rundown loads when both series and event are selected
- Event selection resets when series changes
- Series overview tab functionality remains unchanged

## Tasks

### Step 1: Add Series Selector Signal
- [ ] Add `selectedSeriesForEvent = ""` signal (distinct from series overview)
- [ ] Rename existing `selectedSeriesId` to `selectedSeriesForOverview` for clarity

### Step 2: Convert Event Options to Computed
- [ ] Change `eventOptions` from signal to computed property
- [ ] Filter events by `selectedSeriesForEvent`
- [ ] Maintain "Choose an event" placeholder

### Step 3: Add Series Selector UI
- [ ] Add series selector dropdown in Event Rundown tab template
- [ ] Place it before the event selector
- [ ] Bind to `selectedSeriesForEvent` with `(ngModelChange)="loadEventRundown()"`

### Step 4: Update Load Event Rundown Logic
- [ ] Reset `selectedEventId` when series changes
- [ ] Only load event rundown when both series and event are selected
- [ ] Clear event rundown when series changes

### Step 5: Update Query Params
- [ ] Add series param to URL for event rundown tab
- [ ] Apply series param from URL on load
- [ ] Update `selectTab()` to handle series param

### Step 6: Validation
- [ ] Verify series selector appears in event rundown tab
- [ ] Verify event selector updates when series changes
- [ ] Verify event rundown loads with both series and event selected
- [ ] Verify series overview tab still works independently
- [ ] Check URL params update correctly

## Verification
- Series selector appears before event selector in event rundown tab
- Event options filter dynamically based on series selection
- Event rundown loads correctly with series + event combination
- URL params include series for event rundown
- Series overview tab unaffected
- Event selection resets when series changes
