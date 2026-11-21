export interface SortableSeriesGroup {
  seriesId: string | null;
  seriesName: string;
  seriesLastEventDate: number | null;
  seriesCreatedAt: number | null;
}

const SEASON_NUMBER_PATTERN = /\b(?:season\s*|s)(\d+)\b/i;

export function getSeriesCreatedTimestamp(
  series: { createdAt?: number; _creationTime?: number } | null | undefined,
): number | null {
  if (!series) {
    return null;
  }

  if (typeof series.createdAt === "number" && Number.isFinite(series.createdAt)) {
    return series.createdAt;
  }

  if (
    typeof series._creationTime === "number" &&
    Number.isFinite(series._creationTime)
  ) {
    return series._creationTime;
  }

  return null;
}

export function getLatestEventDate(
  events: ReadonlyArray<{ eventDate?: number }> | null | undefined,
): number | null {
  if (!events || events.length === 0) {
    return null;
  }

  let latest: number | null = null;
  for (const event of events) {
    if (
      typeof event.eventDate === "number" &&
      Number.isFinite(event.eventDate)
    ) {
      if (latest === null || event.eventDate > latest) {
        latest = event.eventDate;
      }
    }
  }

  return latest;
}

export function extractSeasonNumber(seriesName: string): number | null {
  const match = SEASON_NUMBER_PATTERN.exec(seriesName);
  if (!match) {
    return null;
  }

  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function getSeriesRecencyTimestamp(group: SortableSeriesGroup): number | null {
  // Match drivers.getUserProfile by preferring the latest scheduled event date
  // so backfilled seasons stay in chronological order, and fall back to series
  // creation time for upcoming seasons that do not have events yet.
  if (
    typeof group.seriesLastEventDate === "number" &&
    Number.isFinite(group.seriesLastEventDate)
  ) {
    return group.seriesLastEventDate;
  }

  if (
    typeof group.seriesCreatedAt === "number" &&
    Number.isFinite(group.seriesCreatedAt)
  ) {
    return group.seriesCreatedAt;
  }

  return null;
}

export function sortDriverDashboardSeriesGroups<T extends SortableSeriesGroup>(
  groups: readonly T[],
): T[] {
  return [...groups].sort((a, b) => {
    const aHasSeries = a.seriesId != null;
    const bHasSeries = b.seriesId != null;
    if (aHasSeries !== bHasSeries) {
      return aHasSeries ? -1 : 1;
    }

    const aRecency = getSeriesRecencyTimestamp(a);
    const bRecency = getSeriesRecencyTimestamp(b);
    const aHasRecency = aRecency !== null;
    const bHasRecency = bRecency !== null;
    if (aHasRecency !== bHasRecency) {
      return aHasRecency ? -1 : 1;
    }

    if (aRecency !== null && bRecency !== null && aRecency !== bRecency) {
      return bRecency - aRecency;
    }

    const aSeasonNumber = extractSeasonNumber(a.seriesName);
    const bSeasonNumber = extractSeasonNumber(b.seriesName);
    if (
      aSeasonNumber !== null &&
      bSeasonNumber !== null &&
      aSeasonNumber !== bSeasonNumber
    ) {
      return bSeasonNumber - aSeasonNumber;
    }

    const nameCompare = b.seriesName.localeCompare(a.seriesName, undefined, {
      numeric: true,
      sensitivity: "base",
    });
    if (nameCompare !== 0) {
      return nameCompare;
    }

    return (a.seriesId ?? "").localeCompare(b.seriesId ?? "");
  });
}
