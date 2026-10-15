import { afterEach, describe, expect, it } from "bun:test";
import { getFunctionName } from "convex/server";
import before from "../docs/sample_requests/before.json";
import current from "../docs/sample_requests/current.json";
import { requireImportPermission } from "./auth";
import { importFromSimGrid, importFromSimGridInternal, importOrUpdateEvent } from "./events";

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
  const action = importFromSimGridInternal as unknown as {
    _handler: (context: typeof ctx, args: { seriesId: string }) => Promise<unknown>;
  };
  const result = await action._handler(ctx, { seriesId: 'series-1' });
  return { events, requests, result };
}

function createEventImportAction(role = 'league_manager', discordAccessToken = 'oauth-token') {
  const actionCalls: Array<{ name: string; args: unknown }> = [];
  globalThis.fetch = (async () => Response.json({ id: 'discord-manager' })) as typeof fetch;
  const db = {
    get: async (id: string) => id === 'manager'
      ? { discordId: 'discord-manager', roleId: 'role' }
      : { name: role },
  };
  const ctx = {
    runQuery: async (_reference: unknown, args: unknown) => {
      const query = requireImportPermission as unknown as {
        _handler: (context: { db: typeof db }, args: unknown) => Promise<null>;
      };
      return query._handler({ db }, args);
    },
    runAction: async (reference: Parameters<typeof getFunctionName>[0], args: unknown) => {
      actionCalls.push({ name: getFunctionName(reference), args });
      return { created: 1, skipped: 0 };
    },
  };
  return {
    actionCalls,
    run: () => {
      const action = importFromSimGrid as unknown as {
        _handler: (context: typeof ctx, args: unknown) => Promise<unknown>;
      };
      return action._handler(ctx, {
        currentUserId: 'manager', discordAccessToken, seriesId: 'series-1',
      });
    },
  };
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

  it('rejects event imports without a Discord credential before delegating', async () => {
    const test = createEventImportAction('league_manager', '');
    await expect(test.run()).rejects.toThrow('sign in with Discord');
    expect(test.actionCalls).toEqual([]);
  });

  it('rejects event imports from head stewards before delegating', async () => {
    const test = createEventImportAction('head_steward');
    await expect(test.run()).rejects.toThrow('Unauthorized');
    expect(test.actionCalls).toEqual([]);
  });

  it('delegates verified event-manager imports to the internal action', async () => {
    const test = createEventImportAction('event_manager');
    const result = await test.run();
    expect(result).toEqual({ created: 1, skipped: 0 });
    expect(test.actionCalls).toEqual([{
      name: 'events:importFromSimGridInternal',
      args: { seriesId: 'series-1' },
    }]);
  });

  it('keeps event roster writes and imports inaccessible to clients', () => {
    for (const registeredFunction of [importOrUpdateEvent, importFromSimGridInternal]) {
      expect((registeredFunction as unknown as { isInternal: boolean }).isInternal).toBe(true);
    }
  });

});
