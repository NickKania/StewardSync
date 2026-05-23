# ACC Times Integration Plan

## Goal

Integrate Assetto Corsa Competizione times with StewardSync so that:

- a series can be configured with an ACC times Discord channel ID
- an external service can send ACC results into the application through an HTTP endpoint
- incoming times are persisted for the appropriate series event
- an external Discord bot can fetch the current leaderboard for the configured channel

## Core Decisions

- Store ACC times configuration on the existing `series` record
- Use an external Discord bot rather than building a new bot runtime in this repo
- Use HTTP endpoints in Convex for both ingestion and bot reads
- Map one Discord channel to one series
- Resolve the active event as the next race in the series that has not already taken place
- Associate incoming results with that active event
- Match drivers primarily by `steamId`, with driver name as a fallback when `steamId` is not present

## High-Level Architecture

### 1. Series Configuration

Extend the existing `series` model and admin UI to support ACC times configuration.

Proposed field:

- `accTimesDiscordChannelId?: string`

Recommended updates:

- `convex/schema.ts`
- `convex/series.ts`
- `src/app/core/models/series.model.ts`
- `src/app/features/admin/series-management/series-management.component.ts`

Recommended schema support:

- store channel IDs as strings
- add an index such as `by_acc_times_channel_id`
- consider enforcing uniqueness for channel IDs across series

### 2. ACC Times Persistence

Persist leaderboard rows against both `seriesId` and `eventId`, not just the series.

Recommended new table:

- `accEventTimes`

Suggested fields:

- `seriesId`
- `eventId`
- `steamId?`
- `driverName`
- `matchedDriverId?`
- `lapTimeMs`
- `split1Ms`
- `split2Ms`
- `split3Ms`
- `lapCount?`
- `carModel?`
- `sourceUpdatedAt?`
- `updatedAt`

Suggested indexes:

- `by_event`
- `by_series_event`

Recommended import audit table:

- `accTimeImports`

Suggested fields:

- `seriesId`
- `eventId`
- `sourceSessionId?`
- `payloadHash`
- `receivedAt`
- `resultCount`

Suggested indexes:

- `by_series`
- `by_event`
- `by_source_session`

Purpose:

- `accEventTimes` serves the live leaderboard
- `accTimeImports` supports dedupe, visibility, and debugging

### 3. Active Event Resolution

Add backend logic to resolve the active event for a series.

Rule:

- the active event is the next `events` row for the series where `eventDate >= now`

Behavior:

- ingestion attaches results to that active event
- bot reads return the leaderboard for that active event
- if no future event exists, return a clear error

Recommended implementation location:

- `convex/accTimes.ts`

### 4. HTTP Ingestion Endpoint

Create a Convex HTTP route for external result submission.

Recommended route:

- `POST /acc-times/:seriesId`

Recommended behavior:

- validate a shared secret header
- validate the incoming payload shape
- resolve the active event for the series
- dedupe by `sourceSessionId` or `payloadHash`
- upsert leaderboard rows into `accEventTimes`

Matching rules:

- primary match: `steamId`
- fallback match: normalized `driverName`
- if no driver matches, persist the row with `matchedDriverId = null`

Recommended new files:

- `convex/http.ts`
- `convex/accTimes.ts`

### 5. Bot Read Endpoint

Expose a read endpoint for the external Discord bot.

Recommended route:

- `GET /acc-times/by-channel/:channelId`

Recommended behavior:

- resolve the series by `accTimesDiscordChannelId`
- resolve the active event for that series
- return the current leaderboard rows sorted by best lap time

Recommended optional query params:

- `limit`
- `format=json`

### 6. Discord Bot Responsibilities

Keep Discord command execution and presentation in the external bot.

Recommended flow:

1. A user runs the command in a configured Discord channel.
2. The bot sends the `channelId` to StewardSync.
3. StewardSync returns the leaderboard JSON for the active event in the mapped series.
4. The bot formats and posts the response.

Recommendation:

- return JSON from the app only in v1
- keep message formatting or image rendering out of StewardSync for now

## Admin UI Changes

Extend the existing series modal in the admin UI.

Recommended updates in `series-management.component.ts`:

- add `accTimesDiscordChannelId` to `seriesForm`
- populate it in `editSeries()`
- save it in `saveSeries()`
- reset it in `closeSeriesModal()`
- add one optional input field in the series modal

Optional future additions:

- show the current active ACC event for the series
- show the most recent ACC import timestamp or status

## Security and Validation

- store Discord channel IDs as strings, not numbers
- trim channel IDs before save
- validate channel IDs as digit strings
- protect the ingestion endpoint with a shared secret
- start with a global env secret; consider per-series secrets later if needed
- reject duplicate channel-to-series mappings if that becomes a hard requirement

## Recommended Files

Likely files involved in implementation:

- `convex/schema.ts`
- `convex/series.ts`
- `convex/http.ts`
- `convex/accTimes.ts`
- `src/app/core/models/series.model.ts`
- `src/app/features/admin/series-management/series-management.component.ts`

## Open Questions

The main remaining implementation blocker is the inbound ACC payload contract.

Before implementation, confirm the exact request shape or provide a sample payload for:

- `driverName`
- `steamId`
- `lapTimeMs`
- sector splits
- `carModel`
- `lapCount`
- `sourceSessionId`
- source timestamp fields

## Suggested Next Steps

1. Finalize the inbound payload contract.
2. Add schema support for series config and ACC times storage.
3. Implement active event resolution and import dedupe logic.
4. Add Convex HTTP routes for ingestion and bot reads.
5. Extend the admin series UI with the Discord channel ID field.
6. Integrate the external Discord bot against the read endpoint.
