import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { getFunctionName, type FunctionReference } from "convex/server";
import { correct, correctVerified } from "./reviews";
import { updateFinalizedDetails, updateFinalizedDetailsVerified } from "./reports";
import { resolveTestSession } from "./testMode";
import type { ActionCtx, MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

const reviewArgs = {
  reviewId: "review" as Id<"reviews">, incidentDescription: "Corrected assessment",
  atFaultDriverId: "driver" as Id<"drivers">, isNoDriverAtFault: false,
};
const reportArgs = {
  reportId: "report" as Id<"reports">, lap: "2", turn: "3",
  description: "Corrected finalized incident description", videoLink: "", videoTimestamp: "",
};

function fixture() {
  const documents = new Map<string, Record<string, unknown>>([
    ["manager", { _id: "manager", roleId: "managerRole" }], ["managerRole", { name: "league_manager" }],
    ["attacker", { _id: "attacker", roleId: "driverRole" }], ["driverRole", { name: "driver" }],
    ["review", { _id: "review", userId: "author", reportId: "report", incidentDescription: "Original assessment" }],
    ["report", { _id: "report", eventId: "event", isFinalized: true, description: "Original incident description", finalDecision: "Original ruling" }],
    ["event", { seriesId: "series" }], ["series", {}], ["driver", { championshipId: "series" }],
  ]);
  const audit: Record<string, unknown>[] = [];
  const writes: string[] = [];
  const owned = new Map<string, Record<string, unknown>>();
  const sessions = new Map<string, Record<string, unknown>>();
  const beforeWrite = { run: () => {} };
  const ctx = {
    db: {
      get: async (id: string) => documents.get(id) ?? null,
      query: (table: string) => ({
        withIndex: (_index: string, filter: (q: unknown) => void) => {
          const fields: Record<string, string> = {};
          const q = { eq: (field: string, value: string) => { fields[field] = value; return q; } };
          filter(q);
          return { unique: async () => table === "testModeSessions"
            ? sessions.get(fields.token) ?? null
            : owned.get(`${fields.entityTable}:${fields.entityId}`) ?? null };
        },
      }),
      patch: async (id: string, updates: Record<string, unknown>) => { writes.push(id); Object.assign(documents.get(id)!, updates); },
      insert: async (_table: string, data: Record<string, unknown>) => { audit.push(data); return "audit"; },
    },
  } as unknown as MutationCtx;
  const runQuery = spyOn({
    query: async (ref: FunctionReference<"query">, args: { discordId?: string; token?: string }) => {
      if (getFunctionName(ref) === "testMode:resolveTestSession") {
        return resolveTestSession._handler(ctx, { token: args.token! });
      }
      if (args.discordId === "111") return documents.get("manager");
      if (args.discordId === "222") return documents.get("attacker");
      return null;
    },
  }, "query");
  const actionCtx = {
    runQuery,
    runMutation: async (ref: FunctionReference<"mutation", "internal">, args: Record<string, unknown>) => {
      beforeWrite.run();
      if (getFunctionName(ref) === "reviews:correctVerified") {
        return correctVerified._handler(ctx, args as Parameters<typeof correctVerified._handler>[1]);
      }
      if (getFunctionName(ref) === "reports:updateFinalizedDetailsVerified") {
        return updateFinalizedDetailsVerified._handler(ctx, args as Parameters<typeof updateFinalizedDetailsVerified._handler>[1]);
      }
      throw new Error("Expected an internal correction mutation");
    },
  } as unknown as ActionCtx;
  return { actionCtx, ctx, documents, writes, audit, runQuery, owned, sessions, beforeWrite };
}

const fetchMock = () => spyOn(globalThis, "fetch");
const originalTestMode = process.env["STEWARDSYNC_TEST_MODE"];
afterEach(() => {
  fetchMock().mockRestore();
  if (originalTestMode === undefined) delete process.env["STEWARDSYNC_TEST_MODE"];
  else process.env["STEWARDSYNC_TEST_MODE"] = originalTestMode;
});

const testSessionToken = "test-mode-session:00000000-0000-4000-8000-00000000000100000000-0000-4000-8000-000000000002";

function testFixture() {
  process.env["STEWARDSYNC_TEST_MODE"] = "true";
  const state = fixture();
  state.owned.set("users:manager", { scenarioId: "__users__" });
  state.owned.set("series:series", { scenarioId: "demo" });
  const session = { userId: "manager", expiresAt: Date.now() + 60_000 };
  state.sessions.set(testSessionToken, session);
  return { ...state, session };
}

it("exposes credential-verifying actions while keeping correction writes internal", () => {
  expect(correct.isAction).toBe(true);
  expect(correct.isPublic).toBe(true);
  expect(updateFinalizedDetails.isAction).toBe(true);
  expect(updateFinalizedDetails.isPublic).toBe(true);
  expect(correctVerified.isInternal).toBe(true);
  expect(updateFinalizedDetailsVerified.isInternal).toBe(true);
});

for (const kind of ["review", "report"] as const) {
  describe(`${kind} correction authentication`, () => {
    const submit = (state: ReturnType<typeof fixture>, discordAccessToken: string, suppliedUserId?: string) => {
      // Extra IDs model an attempted caller override; the public validators also reject these fields.
      const extra = suppliedUserId ? { currentUserId: suppliedUserId } : {};
      return kind === "review"
        ? correct._handler(state.actionCtx, { ...reviewArgs, discordAccessToken, ...extra })
        : updateFinalizedDetails._handler(state.actionCtx, { ...reportArgs, discordAccessToken, ...extra });
    };

    it("rejects a manager ID without a Discord credential before any lookup or write", async () => {
      const state = fixture();
      const fetch = fetchMock();
      await expect(submit(state, "", "manager")).rejects.toThrow("Sign in with Discord again");
      expect(fetch).not.toHaveBeenCalled();
      expect(state.runQuery).not.toHaveBeenCalled();
      expect(state.writes).toHaveLength(0);
    });

    it("rejects expired or revoked tokens even when a manager ID is supplied", async () => {
      const state = fixture();
      fetchMock().mockResolvedValue(new Response(null, { status: 401 }));
      await expect(submit(state, "revoked-token", "manager")).rejects.toThrow("Sign in with Discord again");
      expect(state.runQuery).not.toHaveBeenCalled();
      expect(state.audit).toHaveLength(0);
      expect(state.writes).toHaveLength(0);
    });

    it("checks the verified Discord user's role rather than a spoofed manager ID", async () => {
      const state = fixture();
      fetchMock().mockResolvedValue(Response.json({ id: "222" }));
      await expect(submit(state, "attacker-token", "manager")).rejects.toThrow("Unauthorized");
      expect(state.audit).toHaveLength(0);
      expect(state.writes).toHaveLength(0);
    });

    it("audits the verified manager and ignores a supplied actor override", async () => {
      const state = fixture();
      const fetch = fetchMock().mockResolvedValue(Response.json({ id: "111" }));
      await submit(state, "manager-token", "attacker");
      expect(fetch).toHaveBeenCalledWith("https://discord.com/api/users/@me", {
        headers: { Authorization: "Bearer manager-token" },
        signal: expect.any(AbortSignal),
      });
      expect(state.audit.length).toBeGreaterThan(0);
      expect(state.audit.every(change => change.changedByUserId === "manager")).toBe(true);
      expect(state.documents.get("report")?.finalDecision).toBe("Original ruling");
      expect(state.writes).toEqual([kind]);
    });

    it("fails closed when Discord is unavailable", async () => {
      const state = fixture();
      fetchMock().mockRejectedValue(new Error("Connection failed"));
      await expect(submit(state, "token")).rejects.toThrow("Unable to verify Discord sign-in");
      expect(state.writes).toHaveLength(0);
    });

    it("aborts stalled Discord requests after ten seconds without writing", async () => {
      const state = fixture();
      const timer = spyOn(globalThis, "setTimeout");
      try {
        fetchMock().mockImplementation((_url, init) => new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("Request aborted")));
        }));
        const pending = submit(state, "token");
        const [abort, delay] = timer.mock.calls[0];
        expect(delay).toBe(10_000);
        if (typeof abort === "function") abort();
        await expect(pending).rejects.toThrow("Unable to verify Discord sign-in");
        expect(state.writes).toHaveLength(0);
      } finally {
        timer.mockRestore();
      }
    });

    it("fails closed on rate limits, malformed identities, and unregistered users", async () => {
      for (const response of [new Response(null, { status: 429 }), new Response("not-json"), Response.json({ id: "" }), Response.json({ id: "333" })]) {
        const state = fixture();
        fetchMock().mockResolvedValue(response);
        await expect(submit(state, "token")).rejects.toThrow();
        expect(state.writes).toHaveLength(0);
      }
    });

    it("accepts a valid fixture session on an owned target without a Discord call", async () => {
      const state = testFixture();
      const fetch = fetchMock();
      await submit(state, testSessionToken);
      expect(fetch).not.toHaveBeenCalled();
      expect(state.writes).toEqual([kind]);
      expect(state.audit.every(change => change.changedByUserId === "manager")).toBe(true);
    });

    for (const invalidity of ["disabled", "malformed", "whitespace", "revoked", "expired", "unowned", "deleted user"] as const) {
      it(`rejects a ${invalidity} reserved credential before Discord fetch`, async () => {
        const state = testFixture();
        const fetch = fetchMock();
        let token = testSessionToken;
        if (invalidity === "disabled") process.env["STEWARDSYNC_TEST_MODE"] = "false";
        if (invalidity === "malformed") token = "test-mode-session:broken";
        if (invalidity === "whitespace") token += "\n";
        if (invalidity === "revoked") state.sessions.delete(token);
        if (invalidity === "expired") state.session.expiresAt = Date.now();
        if (invalidity === "unowned") state.owned.delete("users:manager");
        if (invalidity === "deleted user") state.documents.delete("manager");

        await expect(submit(state, token)).rejects.toThrow(/Test mode is disabled|valid test mode session/);
        expect(fetch).not.toHaveBeenCalled();
        expect(state.writes).toHaveLength(0);
        expect(state.audit).toHaveLength(0);
      });
    }

    for (const invalidity of ["revoked", "expired", "disabled", "wrong actor", "lost ownership"] as const) {
      it(`rechecks a session that became ${invalidity} between action and write`, async () => {
        const state = testFixture();
        const fetch = fetchMock();
        state.beforeWrite.run = () => {
          if (invalidity === "revoked") state.sessions.delete(testSessionToken);
          if (invalidity === "expired") state.session.expiresAt = Date.now();
          if (invalidity === "disabled") process.env["STEWARDSYNC_TEST_MODE"] = "false";
          if (invalidity === "wrong actor") state.session.userId = "attacker";
          if (invalidity === "lost ownership") state.owned.delete("users:manager");
        };
        await expect(submit(state, testSessionToken)).rejects.toThrow("valid test mode session");
        expect(state.runQuery).toHaveBeenCalledTimes(1);
        expect(fetch).not.toHaveBeenCalled();
        expect(state.writes).toHaveLength(0);
        expect(state.audit).toHaveLength(0);
      });
    }

    it("requires a session for fixture actors inside the writing mutation", async () => {
      const state = testFixture();
      const currentUserId = "manager" as Id<"users">;
      const perform = kind === "review"
        ? correctVerified._handler(state.ctx, { ...reviewArgs, currentUserId })
        : updateFinalizedDetailsVerified._handler(state.ctx, { ...reportArgs, currentUserId });
      await expect(perform).rejects.toThrow("valid test mode session");
      expect(state.writes).toHaveLength(0);
    });

    it("rejects a test session on an ordinary report", async () => {
      const state = testFixture();
      state.owned.delete("series:series");
      await expect(submit(state, testSessionToken)).rejects.toThrow("only correct fixture reports");
      expect(state.writes).toHaveLength(0);
    });
  });
}

it("requires fixture ownership for both reviews when correcting a directly owned report", async () => {
  const state = testFixture();
  state.owned.delete("series:series");
  state.owned.set("reports:report", { scenarioId: "demo" });
  state.owned.set("reviews:review", { scenarioId: "demo" });
  state.documents.get("review")!.linkedReviewId = "joint";
  state.documents.set("joint", { _id: "joint", reportId: "report", linkedReviewId: "review" });
  const perform = () => correct._handler(state.actionCtx, { ...reviewArgs, discordAccessToken: testSessionToken });
  await expect(perform()).rejects.toThrow("only correct fixture reviews");
  expect(state.writes).toHaveLength(0);
  state.owned.set("reviews:joint", { scenarioId: "demo" });
  await perform();
  expect(state.writes).toEqual(["review", "joint"]);
});
