import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { getFunctionName, type FunctionReference } from "convex/server";
import { correct, correctVerified } from "./reviews";
import { updateFinalizedDetails, updateFinalizedDetailsVerified } from "./reports";
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
  const ctx = {
    db: {
      get: async (id: string) => documents.get(id) ?? null,
      patch: async (id: string, updates: Record<string, unknown>) => { writes.push(id); Object.assign(documents.get(id)!, updates); },
      insert: async (_table: string, data: Record<string, unknown>) => { audit.push(data); return "audit"; },
    },
  } as unknown as MutationCtx;
  const runQuery = spyOn({
    query: async (_ref: unknown, args: { discordId: string }) => {
      if (args.discordId === "111") return documents.get("manager");
      if (args.discordId === "222") return documents.get("attacker");
      return null;
    },
  }, "query");
  const actionCtx = {
    runQuery,
    runMutation: async (ref: FunctionReference<"mutation", "internal">, args: Record<string, unknown>) => {
      if (getFunctionName(ref) === "reviews:correctVerified") {
        return correctVerified._handler(ctx, args as Parameters<typeof correctVerified._handler>[1]);
      }
      if (getFunctionName(ref) === "reports:updateFinalizedDetailsVerified") {
        return updateFinalizedDetailsVerified._handler(ctx, args as Parameters<typeof updateFinalizedDetailsVerified._handler>[1]);
      }
      throw new Error("Expected an internal correction mutation");
    },
  } as unknown as ActionCtx;
  return { actionCtx, documents, writes, audit, runQuery };
}

const fetchMock = () => spyOn(globalThis, "fetch");
afterEach(() => { fetchMock().mockRestore(); });

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
  });
}
