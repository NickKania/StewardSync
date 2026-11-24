# Local Test Mode

Local Test Mode lets developers and automation switch between fixture users, stage race incident scenarios, and inspect the resulting records and links. The launcher uses a local Convex deployment with the Angular `test-mode` configuration.

## Start from a fresh checkout

Use Node.js 20 on Linux or macOS. On Windows, run these commands in WSL with Node.js and Bun installed in WSL. The launcher requires POSIX process groups to verify that every child process has stopped.

```bash
nvm use 20
bun install
bun run test-mode:local
```

Open the loopback URL printed by the launcher. The default is `http://127.0.0.1:4201/test-mode`, and the launcher allocates a free port if `4201` is busy. The separate browser origin and deployment-scoped session keys keep fixture sessions isolated from the ordinary app on `http://localhost:4200`. The header offers a quick identity switch after sign-in. For terminal automation, run `bun run test-mode:backend` and use the verified Convex URL printed by the launcher. Both commands run in the foreground. Press Ctrl+C to stop the processes.

The launcher provisions a dedicated Convex backend under `.convex/test-mode/` with a fresh SQLite database on every launch. It binds to `127.0.0.1`, blocks outbound action fetches using `--convex-http-proxy http://127.0.0.1:1` and proxy environment variables, and verifies that both Convex listeners are loopback-only across IPv4 and IPv6 before enabling fixture access. It checks for Discord notification credentials and deploys functions using `.convex/test-mode/pinned.env`, which keeps the project's `.env.local` intact. After setting `STEWARDSYNC_TEST_MODE=true`, it waits for `testMode:getStatus` on the loopback endpoint.

The full-stack launcher writes `.convex/test-mode/runtime-config.js` for Angular and removes it on shutdown. It reads the Discord client ID and dev login setting from `src/environments/environment.local.ts`, copying the example if the file is missing. Backend-only launches preserve existing frontend configuration files, including `.convex/test-mode/runtime-config.js`.

## Stage data and switch users

The seven fixture identities are `driver`, `driver_2`, `steward`, `steward_2`, `head_steward`, `event_manager`, and `league_manager`.

| Scenario | Staged data |
| --- | --- |
| `baseline` | GT3 series with classes, drivers, penalties, events, and races |
| `review_workflow` | Baseline plus reports spanning pending, reviewed, ready to finalize, finalized, and rejected states |
| `race_ban_review` | Baseline plus finalized incidents that trigger license point thresholds, a requestable race ban, and an open race ban review |

Use a unique scenario ID for each automation run. IDs may contain up to 64 letters, digits, dots, underscores, or hyphens. `__users__` is reserved. Staging a scenario again with the same ID replaces its data by default. Pass `resetScenario: false` to reject an existing ID. The returned manifest includes entity IDs and deep links annotated with the roles that can use them.

Browser automation can use the bridge from the local app.

```js
const testMode = window.__STEWARDSYNC_TEST_MODE__;
if (await testMode.getReadiness() !== 'ready') throw new Error('Local Test Mode is unavailable');

const manifest = await testMode.stageScenario({
  scenario: 'review_workflow',
  scenarioId: 'agent-review',
  resetScenario: false,
});
await testMode.loginAs('steward');
console.log(manifest.links);
```

For CLI automation, pin commands to the launcher-owned `.convex/test-mode/pinned.env`.

```bash
bun x convex run --env-file .convex/test-mode/pinned.env testMode:stageScenario '{"scenario":"race_ban_review","scenarioId":"agent-race-ban","resetScenario":false}'
bun x convex run --env-file .convex/test-mode/pinned.env testMode:authenticateAs '{"roleOrKey":"league_manager"}'
bun x convex run --env-file .convex/test-mode/pinned.env testMode:getState '{"scenarioId":"agent-race-ban"}'
bun x convex run --env-file .convex/test-mode/pinned.env testMode:reset '{"scenarioId":"agent-race-ban"}'
```

`stageCustom` stages custom records in an owned scenario, with cross-references restricted to that scenario. Use `reset({ scenarioId })` for targeted cleanup. Reset also removes records created inside the owned series and rejects the whole operation if a surviving record references a record slated for removal. Fixture users are shared between scenarios. When no scenarios remain, `includeUsers: true` revokes fixture correction sessions and removes fixture users without surviving references.

The fixture browser identity survives reloads. A separate correction session authorizes fixture corrections, expires after 15 minutes by default, and can be requested for up to one hour. Switch to the fixture identity again to renew it.

## Startup checks

- If the launcher reports a conflicting selector, inspect the current shell, `.env`, and `.env.local`. Remove Convex deploy keys, deployment and access tokens, and self-hosted settings from those sources. Keep the local `CONVEX_DEPLOYMENT` selector in `.env.local` and use matching loopback ports for any `CONVEX_URL` values.
- If the launcher reports a missing or mismatched deployment name, check `.convex/local/default/config.json` against `.env.local`. Use the matching local configuration or a separate fresh checkout.
- If the launcher reports Discord credentials, remove `DISCORD_BOT_TOKEN` and `DISCORD_RACE_REVIEW_CHANNEL_ID` from the local Convex deployment before retrying.
- If the launcher reports a cleanup error, it exits with a nonzero status. The launcher retains `.convex/test-mode/launcher.lock` if it cannot verify that the process groups have stopped. Confirm the prior launcher and its children have stopped before removing a stale lock.
- If the page reports an unreachable, missing, or disabled backend, confirm the launcher printed a verified URL and is still running. A non-loopback target indicates Angular is using a different runtime configuration.

## Access boundary

Anonymous access to `convex/testMode.ts` is an intentional local-only exception gated by `STEWARDSYNC_TEST_MODE=true`. Anyone who can reach an enabled deployment can invoke its test-mode functions. Keep the backend on loopback, avoid exposing it through tunnels or proxies, and never set the flag on staging or production. The Angular test-mode route and browser bridge are available only in the local configurations (`local` and `test-mode`). The existing dev login setting is independent of Local Test Mode.
