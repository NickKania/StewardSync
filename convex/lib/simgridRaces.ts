interface SimGridRace {
  starts_at: string;
  track?: { name?: string } | null;
  display_name?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isRace(value: unknown): value is SimGridRace {
  return isRecord(value) && typeof value['starts_at'] === 'string' &&
    (value['display_name'] === undefined || typeof value['display_name'] === 'string') &&
    (value['track'] === undefined || value['track'] === null ||
      (isRecord(value['track']) &&
        (value['track']['name'] === undefined || typeof value['track']['name'] === 'string')));
}

/** Collect all pages before the importer assigns chronological event numbers. */
export async function fetchSimGridRaces(championshipId: string, apiKey: string): Promise<SimGridRace[]> {
  const races: SimGridRace[] = [];
  let offset = 0;
  let limit: number | undefined;

  while (true) {
    const url = new URL('https://www.thesimgrid.com/api/v1/races');
    url.searchParams.set('championship_id', championshipId);
    if (limit !== undefined) {
      url.searchParams.set('offset', String(offset));
      url.searchParams.set('limit', String(limit));
    }
    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!response.ok) throw new Error(`SimGrid API error: ${response.statusText}`);

    const payload: unknown = await response.json();
    const data: unknown = Array.isArray(payload) ? payload : isRecord(payload) ? payload['data'] : undefined;
    if (!Array.isArray(data) || !data.every(isRace)) {
      throw new Error('SimGrid returned an invalid races response');
    }
    races.push(...data);
    // The previous API returned all races as a single array.
    if (Array.isArray(payload)) return races;

    const pagination = isRecord(payload) ? payload['pagination'] : undefined;
    if (!isRecord(pagination)) throw new Error('SimGrid returned invalid pagination');
    const pageOffset = pagination['offset'];
    const pageLimit = pagination['limit'];
    const total = pagination['total_count'];
    if (typeof pageOffset !== 'number' || !Number.isSafeInteger(pageOffset) || pageOffset !== offset ||
        typeof pageLimit !== 'number' || !Number.isSafeInteger(pageLimit) || pageLimit <= 0 ||
        typeof total !== 'number' || !Number.isSafeInteger(total) || total < 0) {
      throw new Error('SimGrid returned invalid pagination');
    }
    offset = pageOffset + data.length;
    if (offset >= total) return races;
    if (data.length === 0) throw new Error('SimGrid returned an empty page before all races were fetched');
    limit = pageLimit;
  }
}
