import { afterEach, describe, expect, it } from "bun:test";
import before from "../docs/sample_requests/before.json";
import current from "../docs/sample_requests/current.json";
import { importFromSimGrid } from "./events";

interface ImportedEvent {
  seriesId: string;
  eventNumber: number;
  trackName: string;
  eventDate: number;
}

const originalFetch = globalThis.fetch;
const originalApiKey = process.env['SIMGRID_API_KEY'];
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalApiKey === undefined) delete process.env['SIMGRID_API_KEY'];
  else process.env['SIMGRID_API_KEY'] = originalApiKey;
});

async function runImport(pages: unknown[]) {
  process.env['SIMGRID_API_KEY'] = 'test-key';
  const requests: string[] = [];
  const events: ImportedEvent[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    requests.push(String(input));
    if (requests.length > pages.length) throw new Error('Unexpected extra page request');
    return Response.json(pages[requests.length - 1]);
  }) as typeof fetch;
  const ctx = {
    runQuery: async () => ({ simgridLink: 'https://www.thesimgrid.com/championship/26032' }),
    runMutation: async (_reference: unknown, args: ImportedEvent) => {
      events.push(args);
      return { action: events.length === 1 ? 'created' : 'updated', eventId: 'event-id' };
    },
  };
  const action = importFromSimGrid as unknown as {
    _handler: (context: typeof ctx, args: { seriesId: string }) => Promise<unknown>;
  };
  const result = await action._handler(ctx, { seriesId: 'series-1' });
  return { events, requests, result };
}

describe('SimGrid event imports', () => {
  for (const [name, fixture] of [['legacy', before], ['current', current]] as const) {
    it(`imports the ${name} sample in chronological order`, async () => {
      const { events, requests, result } = await runImport([fixture]);
      expect(events).toHaveLength(6);
      expect(events.map(event => event.eventNumber)).toEqual([1, 2, 3, 4, 5, 6]);
      expect(events[0].eventDate).toBe(Date.parse('2026-08-12T00:00:00.000Z'));
      expect(events[5].eventDate).toBe(Date.parse('2026-09-16T00:00:00.000Z'));
      expect(requests).toHaveLength(1);
      expect(result).toEqual({ created: 1, skipped: 5 });
    });
  }

  it('fetches every page before numbering events', async () => {
    const { events, requests } = await runImport([
      { data: current.data.slice(0, 2), pagination: { limit: 2, offset: 0, total_count: 6 } },
      { data: current.data.slice(2, 4), pagination: { limit: 2, offset: 2, total_count: 6 } },
      { data: current.data.slice(4), pagination: { limit: 2, offset: 4, total_count: 6 } },
    ]);
    expect(events).toHaveLength(6);
    expect(events[0].eventDate).toBe(Date.parse('2026-08-12T00:00:00.000Z'));
    expect(new URL(requests[1]).searchParams.get('offset')).toBe('2');
    expect(new URL(requests[2]).searchParams.get('offset')).toBe('4');
  });
  it('accepts an empty championship', async () => {
    const { events, result } = await runImport([
      { data: [], pagination: { limit: 10, offset: 0, total_count: 0 } },
    ]);
    expect(events).toEqual([]);
    expect(result).toEqual({ created: 0, skipped: 0 });
  });

  it('rejects malformed responses', async () => {
    await expect(runImport([{ error: 'Invalid championship' }])).rejects.toThrow(
      'SimGrid returned an invalid races response',
    );
  });

  it('rejects a stalled page instead of importing a partial championship', async () => {
    await expect(runImport([
      { data: current.data.slice(0, 2), pagination: { limit: 2, offset: 0, total_count: 6 } },
      { data: [], pagination: { limit: 2, offset: 2, total_count: 6 } },
    ])).rejects.toThrow('SimGrid returned an empty page');
  });

  it('rejects pagination that does not advance', async () => {
    await expect(runImport([
      { data: current.data.slice(0, 2), pagination: { limit: 2, offset: 0, total_count: 6 } },
      { data: current.data.slice(0, 2), pagination: { limit: 2, offset: 0, total_count: 6 } },
    ])).rejects.toThrow('SimGrid returned invalid pagination');
  });

});
