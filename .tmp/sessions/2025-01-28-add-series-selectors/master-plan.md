# Master Plan: Add Series Selectors

## Overview
Add series filtering capability to two components:
1. **Report List Component** - Add series selector to filter reports by series
2. **Statistics Dashboard Component** - Add series selector to event rundown tab for filtering events

## Architecture

### Data Flow
```
Report List:
[Series Data] → [Series Selector] → [Filter Reports]
                                   ↓
                           [Event Options Filtered by Series]

Statistics Dashboard (Event Rundown Tab):
[Series Data] → [Series Selector] → [Filter Events] → [Event Selector] → [Load Event Rundown]
```

### Components

#### 1. ReportListComponent (Enhancement)
- **Input**: Reports, Events, Series data
- **Output**: Filtered reports list
- **Dependencies**: ConvexService, AuthService

#### 2. StatisticsDashboardComponent (Enhancement)
- **Input**: Events, Series data
- **Output**: Filtered event options, Event rundown data
- **Dependencies**: ConvexService, AuthService

## Component Order

1. ✅ **ReportListComponent** - Add series selector (no backend changes needed) ✓ COMPLETED
2. ✅ **StatisticsDashboardComponent** - Add series selector to event rundown tab (no backend changes needed) ✓ COMPLETED

## Global Standards/Decisions

- Use client-side filtering for events by series (no new Convex queries needed)
- Series data already loaded in StatisticsDashboard, add loading to ReportList
- Filter event options dynamically based on selected series
- When series changes, reset event selection
- Follow existing patterns for SelectComponent and filtering logic
- Use signal-based reactive approach with computed properties

## Notes
- Both components already load events data with series populated
- ReportListComponent currently loads events via `convex.api.events.list`
- StatisticsDashboardComponent currently loads series via `convex.api.series.listActive`
- Need to add series loading to ReportListComponent
- Event options should be computed based on selected series
