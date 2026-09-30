import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { runInNewContext } from "node:vm";
import * as configLoader from "../src/app/core/config/runtime-config-loader";
import * as serviceLoader from "../src/app/core/services/runtime-config-loader";

const root = resolve(import.meta.dir, "..");
const sentinel = "test-only-discord-secret-do-not-publish";
const publicSettings = {
  convexUrl: "https://example.convex.cloud",
  enableDevLogin: false,
  discordClientId: "public-client-id",
};
const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true });
});

function sandbox() {
  const directory = mkdtempSync(join(tmpdir(), "stewardsync-config-"));
  directories.push(directory);
  mkdirSync(join(directory, "src/environments"), { recursive: true });
  return directory;
}

function assertPublicAsset(directory: string) {
  const script = readFileSync(join(directory, "src/runtime-config.js"), "utf8");
  expect(script.includes(sentinel)).toBe(false);
  const context = { window: {} as { __STEWARDSYNC_CONFIG__?: unknown } };
  runInNewContext(script, context);
  expect(context.window.__STEWARDSYNC_CONFIG__).toEqual(publicSettings);
}

describe("public runtime configuration", () => {
  it("local generator ignores even a legacy secret in environment.local.ts", () => {
    const directory = sandbox();
    writeFileSync(join(directory, "src/environments/environment.local.ts"), `
export const environment = {
  convexUrl: '${publicSettings.convexUrl}',
  enableDevLogin: false,
  discordClientId: '${publicSettings.discordClientId}',
  discordClientSecret: '${sentinel}'
};
`);
    execFileSync("bash", [join(root, "scripts/generate-runtime-config-local.sh")], { cwd: directory });
    assertPublicAsset(directory);
  });

  it("staging generator ignores a secret in its process environment", () => {
    const directory = sandbox();
    execFileSync("bash", [join(root, "scripts/generate-env.sh")], {
      cwd: directory,
      env: {
        ...process.env,
        PUBLIC_CONVEX_URL: publicSettings.convexUrl,
        PUBLIC_ENABLE_DEV_LOGIN: "false",
        DISCORD_CLIENT_ID: publicSettings.discordClientId,
        DISCORD_CLIENT_SECRET: sentinel,
      },
    });
    assertPublicAsset(directory);
    const environment = readFileSync(join(directory, "src/environments/environment.staging.ts"), "utf8");
    expect(environment.includes(sentinel)).toBe(false);
    expect(environment.includes("discordClientSecret")).toBe(false);
  });

  for (const script of ["build-prod.sh", "vercel-build.sh"]) {
    it(`${script} renders only public values without invoking builds or Convex`, () => {
      const directory = sandbox();
      const source = readFileSync(join(root, "scripts", script), "utf8");
      // Execute only the output heredocs, never either build/deployment wrapper.
      const renderBlocks = source.match(/^cat > src\/[^\n]+ <<EOF\n[\s\S]*?^EOF$/gm) ?? [];
      expect(renderBlocks).toHaveLength(2);
      execFileSync("bash", ["-c", renderBlocks.join("\n")], {
        cwd: directory,
        env: {
          ...process.env,
          PUBLIC_CONVEX_URL: publicSettings.convexUrl,
          PUBLIC_ENABLE_DEV_LOGIN: "false",
          DISCORD_CLIENT_ID: publicSettings.discordClientId,
          DISCORD_CLIENT_SECRET: sentinel,
        },
      });
      assertPublicAsset(directory);
      const environment = readFileSync(join(directory, "src/environments/environment.prod.ts"), "utf8");
      expect(environment.includes(sentinel)).toBe(false);
      expect(environment.includes("discordClientSecret")).toBe(false);
    });
  }

  for (const [name, loader] of [["config", configLoader], ["service", serviceLoader]] as const) {
    it(`${name} loader strips extra fields from an endpoint response`, async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async () => Response.json({
        ...publicSettings, discordClientSecret: sentinel,
      })) as typeof fetch;
      try {
        expect(await loader.loadRuntimeConfig()).toEqual(publicSettings);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
    it(`${name} loader rejects extra fields from legacy configuration`, () => {
      const legacyConfig = { ...publicSettings, discordClientSecret: sentinel };
      loader.setConfig(legacyConfig);
      expect(loader.getConfig()).toEqual(publicSettings);
    });
  }

  it("both public endpoints exclude server-only credentials", async () => {
    const original = process.env["DISCORD_CLIENT_SECRET"];
    process.env["DISCORD_CLIENT_SECRET"] = sentinel;
    try {
      const first = await import("../src/app/core/server/runtime-config-endpoint");
      const second = await import("../src/app/core/server/runtime-config");
      for (const handler of [first.getRuntimeConfig, second.getRuntimeConfigEndpoint]) {
        let response: Record<string, unknown> = {};
        handler({} as Parameters<typeof handler>[0], {
          json: (value: Record<string, unknown>) => { response = value; },
        } as Parameters<typeof handler>[1]);
        expect(Object.keys(response).sort()).toEqual(Object.keys(publicSettings).sort());
        expect(JSON.stringify(response).includes(sentinel)).toBe(false);
      }
    } finally {
      if (original === undefined) delete process.env["DISCORD_CLIENT_SECRET"];
      else process.env["DISCORD_CLIENT_SECRET"] = original;
    }
  });

  it("no tracked frontend or configuration generator can reference the secret", () => {
    const files = execFileSync("git", ["ls-files", "src", "scripts"], { cwd: root, encoding: "utf8" })
      .trim().split("\n");
    // Report filenames only, never source text that could contain a credential.
    const offenders = files.filter((file) => {
      const content = readFileSync(join(root, file), "utf8");
      return /discordClientSecret|DISCORD_CLIENT_SECRET/.test(content);
    });
    expect(offenders).toEqual([]);
  });
});
