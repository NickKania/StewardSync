import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import {
  closeThread,
  createPrivateThread,
  fetchThreadIfAvailable,
  sendDiscordMessage,
} from "./discord";

const baseUrl = "https://discord.com/api/v10";
const thread = { id: "456", name: "Review", type: 12 };
const originalToken = process.env.DISCORD_BOT_TOKEN;

beforeEach(() => {
  process.env.DISCORD_BOT_TOKEN = "test-token";
});

afterEach(() => {
  if (originalToken === undefined) delete process.env.DISCORD_BOT_TOKEN;
  else process.env.DISCORD_BOT_TOKEN = originalToken;
});

test("creates a private thread and adds each participant", async () => {
  const fetch = spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(Response.json(thread))
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
    .mockResolvedValueOnce(new Response(null, { status: 204 }));
  try {
    expect(await createPrivateThread({
      name: "R".repeat(101),
      parentChannelId: "123",
      participantDiscordIds: ["789", "987"],
      reason: "Meeting scheduled",
    })).toEqual(thread);
    expect(fetch).toHaveBeenNthCalledWith(1, `${baseUrl}/channels/123/threads`, expect.objectContaining({
      method: "POST",
      headers: {
        Authorization: "Bot test-token",
        "Content-Type": "application/json",
        "X-Audit-Log-Reason": "Meeting%20scheduled",
      },
      body: JSON.stringify({
        name: "R".repeat(100),
        type: 12,
        auto_archive_duration: 1440,
        invitable: false,
      }),
      signal: expect.any(AbortSignal),
    }));
    expect(fetch).toHaveBeenNthCalledWith(2, `${baseUrl}/channels/456/thread-members/789`, expect.objectContaining({ method: "PUT" }));
    expect(fetch).toHaveBeenNthCalledWith(3, `${baseUrl}/channels/456/thread-members/987`, expect.objectContaining({ method: "PUT" }));
  } finally {
    fetch.mockRestore();
  }
});

test("sends a message to the channel", async () => {
  const fetch = spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ id: "123" }));
  try {
    await sendDiscordMessage("456", "Meeting scheduled");
    expect(fetch).toHaveBeenCalledWith(`${baseUrl}/channels/456/messages`, expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ content: "Meeting scheduled" }),
    }));
  } finally {
    fetch.mockRestore();
  }
});

test("fetches, archives and locks a thread", async () => {
  const fetch = spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(Response.json(thread))
    .mockResolvedValueOnce(Response.json(thread));
  try {
    expect(await closeThread("456", "Review completed")).toEqual({ closed: true, archived: true, locked: true });
    expect(fetch).toHaveBeenNthCalledWith(1, `${baseUrl}/channels/456`, expect.objectContaining({ method: "GET" }));
    expect(fetch).toHaveBeenNthCalledWith(2, `${baseUrl}/channels/456`, expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ archived: true, locked: true }),
      headers: expect.objectContaining({ "X-Audit-Log-Reason": "Review%20completed" }),
    }));
  } finally {
    fetch.mockRestore();
  }
});

test("handles a missing thread and reports other Discord errors", async () => {
  const fetch = spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(new Response("Unknown Channel", { status: 404 }))
    .mockResolvedValueOnce(new Response("Missing Permissions", { status: 403 }));
  try {
    expect(await fetchThreadIfAvailable("456")).toBeNull();
    await expect(fetchThreadIfAvailable("456")).rejects.toThrow(
      "Discord GET /channels/456 failed (HTTP 403): Missing Permissions",
    );
  } finally {
    fetch.mockRestore();
  }
});
