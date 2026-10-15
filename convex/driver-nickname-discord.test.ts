import { describe, expect, it } from "bun:test";
import { resolveNicknameGuild } from "./driverNicknameDiscord";

describe("resolveNicknameGuild", () => {
  it("uses guilds.fetch when a guild id is set and never fetches the channel", async () => {
    const guild = { id: "guild-1" };
    const fetchedGuildIds: string[] = [];
    let channelFetched = false;
    const client = {
      guilds: {
        fetch: async (guildId: string) => {
          fetchedGuildIds.push(guildId);
          return guild;
        },
      },
      channels: {
        fetch: async (_channelId: string) => {
          channelFetched = true;
          return { guild: { id: "channel-guild" } };
        },
      },
    };

    const result = await resolveNicknameGuild(client, "guild-1", () => "channel-1");

    expect(result).toBe(guild as never);
    expect(fetchedGuildIds).toEqual(["guild-1"]);
    expect(channelFetched).toBe(false);
  });

  it("returns the channel guild when no guild id is set", async () => {
    const guild = { id: "channel-guild" };
    const fetchedChannelIds: string[] = [];
    let guildFetched = false;
    const client = {
      guilds: {
        fetch: async (_guildId: string) => {
          guildFetched = true;
          return { id: "guild-1" };
        },
      },
      channels: {
        fetch: async (channelId: string) => {
          fetchedChannelIds.push(channelId);
          return { guild };
        },
      },
    };

    const result = await resolveNicknameGuild(client, undefined, () => "channel-1");

    expect(result).toBe(guild as never);
    expect(fetchedChannelIds).toEqual(["channel-1"]);
    expect(guildFetched).toBe(false);
  });

  it("throws when the channel is null", async () => {
    const client = {
      guilds: { fetch: async (_guildId: string) => ({ id: "guild-1" }) },
      channels: { fetch: async (_channelId: string) => null },
    };

    await expect(resolveNicknameGuild(client, undefined, () => "channel-1"))
      .rejects.toThrow("must belong to a server");
  });

  it("throws when the channel has no guild", async () => {
    const client = {
      guilds: { fetch: async (_guildId: string) => ({ id: "guild-1" }) },
      channels: { fetch: async (_channelId: string) => ({}) },
    };

    await expect(resolveNicknameGuild(client, undefined, () => "channel-1"))
      .rejects.toThrow("must belong to a server");
  });
});
