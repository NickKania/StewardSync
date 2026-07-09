import { describe, expect, it } from "bun:test";

import {
  allMessagesLackVisibleContent,
  extractDiscordMentionIds,
  filterDriverMessagesForWindow,
  formatDiscordMentions,
  getOldestMessageInPage,
  normalizeDiscordChannelId,
  shouldStopDiscordPagination,
} from "./discordEvidence";

describe("normalizeDiscordChannelId", () => {
  it("accepts a raw channel ID", () => {
    expect(normalizeDiscordChannelId("123456789012345678")).toBe(
      "123456789012345678",
    );
  });

  it("extracts a channel ID from a Discord channel URL", () => {
    expect(
      normalizeDiscordChannelId(
        "https://discord.com/channels/111111111111111111/222222222222222222",
      ),
    ).toBe("222222222222222222");
  });

  it("rejects invalid channel input", () => {
    expect(() => normalizeDiscordChannelId("not-a-channel")).toThrow(
      "Discord incident channel must be a channel ID or Discord channel link",
    );
  });
});

describe("Discord mention formatting", () => {
  it("extracts unique user mention IDs from message content", () => {
    expect(
      extractDiscordMentionIds(
        "Drivers <@123456789012345678> and <@!210583494592561154> plus <@123456789012345678>",
      ),
    ).toEqual(["123456789012345678", "210583494592561154"]);
  });

  it("replaces known user mentions with display names", () => {
    expect(
      formatDiscordMentions(
        "Your Name: <@374147012599218176>\nOther Driver: <@!808129507948101653>",
        {
          "374147012599218176": 'Adam "Nerd" Turaj #6',
          "808129507948101653": "J. Schaefbauer",
        },
      ),
    ).toBe(
      'Your Name: @Adam "Nerd" Turaj #6\nOther Driver: @J. Schaefbauer',
    );
  });

  it("leaves unresolved mentions unchanged", () => {
    expect(formatDiscordMentions("Other Driver: <@808129507948101653>", {})).toBe(
      "Other Driver: <@808129507948101653>",
    );
  });
});

describe("filterDriverMessagesForWindow", () => {
  const messages = [
    {
      id: "before",
      authorId: "driver",
      authorName: "Driver",
      content: "too early",
      timestamp: 99,
      jumpUrl: "",
      attachmentUrls: [],
    },
    {
      id: "match",
      authorId: "driver",
      authorName: "Driver",
      content: "self report",
      timestamp: 150,
      jumpUrl: "",
      attachmentUrls: [],
    },
    {
      id: "other-author",
      authorId: "other",
      authorName: "Other",
      content: "context",
      timestamp: 150,
      jumpUrl: "",
      attachmentUrls: [],
    },
    {
      id: "after",
      authorId: "driver",
      authorName: "Driver",
      content: "too late",
      timestamp: 201,
      jumpUrl: "",
      attachmentUrls: [],
    },
  ];

  it("includes only the selected author inside the requested window", () => {
    expect(filterDriverMessagesForWindow(messages, "driver", 100, 200)).toEqual([
      messages[1],
    ]);
  });
});

describe("shouldStopDiscordPagination", () => {
  it("stops after messages older than the event date", () => {
    expect(shouldStopDiscordPagination(99, 100)).toBe(true);
  });

  it("continues while the oldest message is still inside the event window", () => {
    expect(shouldStopDiscordPagination(100, 100)).toBe(false);
  });
});

describe("getOldestMessageInPage", () => {
  it("returns null for an empty page", () => {
    expect(getOldestMessageInPage([])).toBeNull();
  });

  it("picks the oldest timestamp regardless of array order", () => {
    expect(
      getOldestMessageInPage([
        { id: "new", timestamp: 300 },
        { id: "old", timestamp: 100 },
        { id: "mid", timestamp: 200 },
      ]),
    ).toEqual({ id: "old", timestamp: 100 });
  });

  it("breaks timestamp ties with lower snowflake id", () => {
    expect(
      getOldestMessageInPage([
        { id: "222", timestamp: 100 },
        { id: "111", timestamp: 100 },
      ]),
    ).toEqual({ id: "111", timestamp: 100 });
  });
});

describe("allMessagesLackVisibleContent", () => {
  it("is false for an empty list", () => {
    expect(allMessagesLackVisibleContent([])).toBe(false);
  });

  it("is true when every message has blank content and no attachments", () => {
    expect(
      allMessagesLackVisibleContent([
        { content: "  ", attachmentUrls: [] },
        { content: "", attachmentUrls: [] },
      ]),
    ).toBe(true);
  });

  it("is false when any message has text or an attachment", () => {
    expect(
      allMessagesLackVisibleContent([
        { content: "", attachmentUrls: [] },
        { content: "hello", attachmentUrls: [] },
      ]),
    ).toBe(false);
    expect(
      allMessagesLackVisibleContent([
        { content: "", attachmentUrls: ["https://cdn.example/a.png"] },
      ]),
    ).toBe(false);
  });
});
