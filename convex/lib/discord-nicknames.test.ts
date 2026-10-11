import { describe, expect, it } from "bun:test";
import {
  buildDriverNickname,
  matchesDriverNickname,
  syncDriverNicknames,
  type DriverNicknameTarget,
} from "./discordNicknames";

const target: DriverNicknameTarget = {
  discordId: "discord-1",
  officialName: "Jane Marie Smith",
  driverNumbers: [34, 12, 34],
};

describe("Discord driver nicknames", () => {
  it("formats unique numbers in a stable order", () => {
    expect(buildDriverNickname(target)).toBe("Jane Marie Smith #12/34");
    expect(buildDriverNickname({ ...target, driverNumbers: [0] })).toBe("Jane Marie Smith #0");
    expect(buildDriverNickname({ ...target, driverNumbers: [] })).toBe("Jane Marie Smith");
  });

  it("allows nickname text between name parts, case differences, and either number order", () => {
    expect(matchesDriverNickname('JANE "Speedy" Marie Smith #34/12', target)).toBe(true);
    expect(matchesDriverNickname("Smith Jane Marie #12 #34", target)).toBe(true);
    expect(matchesDriverNickname("Jane Marie Smith 12/34", target)).toBe(true);
  });

  it("requires every official name part and every complete car number", () => {
    expect(matchesDriverNickname("Jane Smith #12/34", target)).toBe(false);
    expect(matchesDriverNickname("Jane Marie Smith #12", target)).toBe(false);
    expect(matchesDriverNickname("Jane Marie Smith #112/345", target)).toBe(false);
    expect(matchesDriverNickname("Jane Marie Smith #12", { ...target, driverNumbers: [1, 2] })).toBe(false);
    expect(matchesDriverNickname(null, target)).toBe(false);
  });

  it("handles numberless drivers and Unicode name parts", () => {
    expect(matchesDriverNickname("María Fast García", {
      ...target, officialName: "Mari\u0301a García", driverNumbers: [],
    })).toBe(true);
    expect(matchesDriverNickname("anything", { ...target, officialName: " " })).toBe(false);
  });

  it("preserves compliant nicknames and sets missing or incorrect nicknames", async () => {
    const updates: Array<{ id: string; nickname: string }> = [];
    const nicknames: Record<string, string | null> = {
      "discord-1": 'Jane "Speedy" Marie Smith #34/12',
      "discord-2": "Jane Smith #12",
      "discord-3": null,
    };
    const result = await syncDriverNicknames({
      members: {
        fetch: async (id) => ({
          nickname: nicknames[id],
          setNickname: async (nickname) => { updates.push({ id, nickname }); },
        }),
      },
    }, {
      targets: [target, { ...target, discordId: "discord-2" }, { ...target, discordId: "discord-3" }],
      skipped: 2,
    });

    expect(updates).toEqual([
      { id: "discord-2", nickname: "Jane Marie Smith #12/34" },
      { id: "discord-3", nickname: "Jane Marie Smith #12/34" },
    ]);
    expect(result).toEqual({ updated: 2, unchanged: 1, skipped: 2, failed: 0, errors: [] });
  });

  it("reports Discord failures and continues to later members", async () => {
    const updated: string[] = [];
    const result = await syncDriverNicknames({
      members: {
        fetch: async (id) => {
          if (id === "missing") throw new Error("Unknown Member");
          return {
            nickname: null,
            setNickname: async () => {
              if (id === "forbidden") throw new Error("Missing Permissions");
              updated.push(id);
            },
          };
        },
      },
    }, {
      targets: ["missing", "forbidden", "allowed"].map((discordId) => ({ ...target, discordId })),
      skipped: 0,
    });

    expect(updated).toEqual(["allowed"]);
    expect(result.failed).toBe(2);
    expect(result.errors).toEqual([
      "Jane Marie Smith (missing): Unknown Member",
      "Jane Marie Smith (forbidden): Missing Permissions",
    ]);
  });

  it("reports overlong names without truncating official name parts or numbers", async () => {
    let updated = false;
    const result = await syncDriverNicknames({
      members: {
        fetch: async () => ({
          nickname: null,
          setNickname: async () => { updated = true; },
        }),
      },
    }, {
      targets: [{ ...target, officialName: "Alexandria Verylongmiddlename Smith" }], skipped: 0,
    });

    expect(updated).toBe(false);
    expect(result.failed).toBe(1);
    expect(result.errors[0]).toContain("32-character nickname limit");
  });
});
