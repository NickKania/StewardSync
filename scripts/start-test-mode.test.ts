import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import {
  CleanupError,
  ListenerNotReadyError,
  NonLoopbackListenerError,
  assertLsofLoopbackOnly,
  assertProcNetLoopbackOnly,
  createCliCommandRunner,
  defaultVerifyLoopbackListeners,
  isProcessGroupAlive,
  startTestMode,
  type StartupDependencies,
} from './lib/test-mode-startup';

const PROJECT_CONFIG = '.convex/local/default/config.json';
const TEST_MODE_CONFIG = '.convex/test-mode/config.json';
const PINNED_ENV = '.convex/test-mode/pinned.env';
const TEST_MODE_RUNTIME_CONFIG = '.convex/test-mode/runtime-config.js';
const LOCK_FILE = '.convex/test-mode/launcher.lock';
const LOCAL_ENV = 'src/environments/environment.local.ts';
const RUNTIME_CONFIG = 'src/runtime-config.js';
const FAKE_BINARY = '/fake/convex-local-backend';
const EXAMPLE_ENV = `export const environment = {
  enableDevLogin: false,
  discordClientId: '',
};
`;

type Result = Awaited<ReturnType<StartupDependencies['commandRunner']>['result']>;

interface RecordedCall {
  executable: string;
  args: readonly string[];
  env: NodeJS.ProcessEnv;
}

describe('local test mode startup', () => {
  let root: string;
  let deps: StartupDependencies;
  let calls: RecordedCall[];
  let stopped: string[];
  let logs: string[];
  let onCommand: (call: RecordedCall) => string | Promise<Result>;

  function write(path: string, contents: string) {
    const absolute = join(deps.cwd, path);
    fs.mkdirSync(dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, contents);
  }

  function configureProject(port = 3210) {
    write(PROJECT_CONFIG, JSON.stringify({ deploymentName: 'anonymous-a', ports: { cloud: port } }));
    write('.env.local', `CONVEX_DEPLOYMENT=anonymous:anonymous-a # Local\nCONVEX_URL=http://127.0.0.1:${port}\n`);
  }

  function configureTestBackend(cloud = 3210, site = 3211) {
    write(TEST_MODE_CONFIG, JSON.stringify({
      deploymentName: 'anonymous-stewardsync-test-mode',
      instanceSecret: 'a'.repeat(64),
      adminKey: 'anonymous-stewardsync-test-mode|test-admin-key',
      preferredPorts: { cloud, site },
    }));
  }

  async function rejectBeforeCli(message: string) {
    await expect(startTestMode(deps, true)).rejects.toThrow(message);
    expect(calls).toEqual([]);
    expect(fs.existsSync(join(deps.cwd, LOCAL_ENV))).toBe(false);
    expect(fs.existsSync(join(deps.cwd, RUNTIME_CONFIG))).toBe(false);
  }

  function pinnedPath(): string {
    return join(deps.cwd, PINNED_ENV);
  }

  beforeEach(() => {
    root = fs.mkdtempSync(join(tmpdir(), 'stewardsync-test-mode-'));
    calls = [];
    stopped = [];
    logs = [];
    onCommand = ({ executable, args }) => {
      if (executable === FAKE_BINARY && args[0] === 'keygen') {
        return 'anonymous-stewardsync-test-mode|generated-admin-key\n';
      }
      return '';
    };
    deps = {
      cwd: join(root, 'project'),
      homeDir: join(root, 'home'),
      env: {},
      fs,
      platform: 'linux',
      readinessTimeoutMs: 2_000,
      pollIntervalMs: 1,
      log: message => logs.push(message),
      resolveBinary: async () => FAKE_BINARY,
      allocateLoopbackPorts: async (preferred) => ({
        cloud: preferred.cloud,
        site: preferred.site === 0 ? 3211 : preferred.site,
      }),
      allocateFrontendPort: async (preferred) => preferred,
      verifyLoopbackListeners: async () => undefined,
      fetchFn: async () => { throw new Error('Unexpected network request'); },
      commandRunner(executable, args, options) {
        expect(options.cwd).toBe(deps.cwd);
        for (const key of [
          'CONVEX_DEPLOY_KEY', 'CONVEX_DEPLOYMENT_TOKEN', 'CONVEX_OVERRIDE_ACCESS_TOKEN',
          'CONVEX_SELF_HOSTED_URL', 'CONVEX_SELF_HOSTED_ADMIN_KEY', 'CONVEX_DEPLOYMENT', 'CONVEX_URL',
        ]) {
          expect(options.env).not.toHaveProperty(key);
        }
        const call: RecordedCall = { executable, args, env: options.env };
        calls.push(call);
        const outcome = onCommand(call);
        const label = `${executable} ${args.join(' ')}`;
        return {
          result: typeof outcome === 'string' ? Promise.resolve({ code: 0, stdout: outcome }) : outcome,
          stop: async () => { stopped.push(label); },
        };
      },
    };
    write('src/environments/environment.local.example.ts', EXAMPLE_ENV);
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  test.each([false, true])('rejects native Windows before starting commands or touching state (backend-only: %s)', async backendOnly => {
    deps.platform = 'win32';
    deps.resolveBinary = async () => { throw new Error('Unexpected binary lookup'); };

    await expect(startTestMode(deps, backendOnly)).rejects.toThrow('run the launcher in WSL');
    expect(calls).toEqual([]);
    expect(fs.existsSync(join(deps.cwd, '.convex'))).toBe(false);
    expect(fs.existsSync(join(deps.cwd, LOCAL_ENV))).toBe(false);
  });

  test.each([
    'CONVEX_DEPLOY_KEY',
    'CONVEX_DEPLOYMENT_TOKEN',
    'CONVEX_OVERRIDE_ACCESS_TOKEN',
    'CONVEX_SELF_HOSTED_URL',
    'CONVEX_SELF_HOSTED_ADMIN_KEY',
  ])('rejects %s from each selector source before invoking Convex or backend binary', async key => {
    configureProject();
    deps.env[key] = 'secret';
    await rejectBeforeCli(key);
    delete deps.env[key];

    write('.env', `export ${key}="secret" # quoted value\n`);
    await rejectBeforeCli(key);
    write('.env', '');
    fs.appendFileSync(join(deps.cwd, '.env.local'), `${key}=secret\n`);
    await rejectBeforeCli(key);
  });

  test.each([
    ['CONVEX_DEPLOYMENT', 'dev:sandbox', 'must select a local or anonymous deployment'],
    ['CONVEX_DEPLOYMENT', 'anonymous:anonymous-other', 'conflicts with .env.local'],
    ['CONVEX_URL', 'https://sandbox.convex.cloud', 'must be an HTTP loopback URL'],
    ['CONVEX_URL', 'http://localhost:3211', 'ports conflict'],
  ])('rejects inherited %s=%s', async (key, value, error) => {
    configureProject();
    deps.env[key] = value;
    await rejectBeforeCli(error);
  });

  test.each([
    ['CONVEX_DEPLOYMENT=anonymous:anonymous-a', 'remove it from .env'],
    ['CONVEX_DEPLOYMENT=prod:stewardsync', 'must select a local or anonymous deployment'],
    ['CONVEX_URL=http://[::1]:3211/', 'ports conflict'],
  ])('rejects .env with %s', async (setting, error) => {
    configureProject();
    write('.env', setting);
    await rejectBeforeCli(error);
  });

  test('rejects a stale loopback URL in .env.local before launching anything', async () => {
    configureProject();
    write('.env.local', 'CONVEX_DEPLOYMENT=anonymous:anonymous-a\nCONVEX_URL=http://127.0.0.1:3999\n');
    await rejectBeforeCli('specifies port 3999, but Convex config specifies 3210');
  });

  test.each(['inherited', 'dotEnv'] as const)(
    'rejects a stale loopback CONVEX_URL in %s even when .env.local omits CONVEX_URL',
    async (source) => {
      write(PROJECT_CONFIG, JSON.stringify({ deploymentName: 'anonymous-a', ports: { cloud: 3210 } }));
      write('.env.local', 'CONVEX_DEPLOYMENT=anonymous:anonymous-a\n');
      if (source === 'inherited') {
        deps.env.CONVEX_URL = 'http://127.0.0.1:3999';
      } else {
        write('.env', 'CONVEX_URL=http://127.0.0.1:3999\n');
      }
      await rejectBeforeCli('specifies port 3999, but Convex config specifies 3210');
    },
  );

  test.each([3211, 3212])('rejects a mismatched project config even with a legacy config and port %i', async port => {
    write(PROJECT_CONFIG, '{"deploymentName":"anonymous-b","ports":{"cloud":3211}}');
    const legacy = join(deps.homeDir, '.convex/anonymous-convex-backend-state/anonymous-a');
    fs.mkdirSync(legacy, { recursive: true });
    fs.writeFileSync(join(legacy, 'config.json'), '{"deploymentName":"anonymous-a","ports":{"cloud":3212}}');
    write('.env.local', `CONVEX_DEPLOYMENT=anonymous:anonymous-a\nCONVEX_URL=http://127.0.0.1:${port}\n`);
    await rejectBeforeCli('deploymentName must match CONVEX_DEPLOYMENT');
  });

  test.each([
    ['{ "ports": { "cloud": 3210 } }\n', 'non-empty deploymentName'],
    ['{ "deploymentName": "", "ports": { "cloud": 3210 } }\n', 'non-empty deploymentName'],
    ['{ "deploymentName": " ", "ports": { "cloud": 3210 } }\n', 'non-empty deploymentName'],
    ['{ incomplete JSON\n', 'Could not read a valid Convex config'],
  ])('preserves invalid project config %j with or without a selector', async (contents, error) => {
    write(PROJECT_CONFIG, contents);
    await rejectBeforeCli(error);
    expect(fs.readFileSync(join(deps.cwd, PROJECT_CONFIG))).toEqual(Buffer.from(contents));

    write('.env.local', 'CONVEX_DEPLOYMENT=anonymous:anonymous-a\nCONVEX_URL=http://127.0.0.1:3210\n');
    await rejectBeforeCli(error);
    expect(fs.readFileSync(join(deps.cwd, PROJECT_CONFIG))).toEqual(Buffer.from(contents));
  });

  test('never launches when a named project config exists but its selector is missing', async () => {
    const contents = '{"deploymentName":"anonymous-a","ports":{"cloud":3210}}\n';
    write(PROJECT_CONFIG, contents);
    write('.env.local', 'CONVEX_URL=http://localhost:3210/\n');
    await rejectBeforeCli('deploymentName must match CONVEX_DEPLOYMENT');
    expect(fs.readFileSync(join(deps.cwd, PROJECT_CONFIG), 'utf8')).toBe(contents);
  });

  test('enforces --interface 127.0.0.1, passes --convex-http-proxy, uses convex deploy, and pins CLI away from mutable .env.local', async () => {
    configureProject();
    configureTestBackend(3210, 3211);
    let backendExited!: (result: Result) => void;
    onCommand = ({ executable, args, env }) => {
      if (executable === FAKE_BINARY) {
        expect(args).toContain('--interface');
        expect(args[args.indexOf('--interface') + 1]).toBe('127.0.0.1');
        expect(args[args.indexOf('--port') + 1]).toBe('3210');
        expect(args[args.indexOf('--site-proxy-port') + 1]).toBe('3211');
        expect(args).toContain('--convex-http-proxy');
        expect(args[args.indexOf('--convex-http-proxy') + 1]).toBe('http://127.0.0.1:1');
        expect(env['HTTPS_PROXY']).toBe('http://127.0.0.1:1');
        expect(env['HTTP_PROXY']).toBe('http://127.0.0.1:1');
        expect(env['NO_PROXY']).toBe('127.0.0.1,localhost,::1');
        // Mutate .env.local concurrently to point at a cloud deployment after validation!
        write('.env.local', 'CONVEX_DEPLOYMENT=prod:hijacked-cloud\nCONVEX_DEPLOY_KEY=prod:secret\n');
        return new Promise(resolve => { backendExited = resolve; });
      }
      if (executable === 'bun' && args[1] === 'convex') {
        const envFileIndex = args.indexOf('--env-file');
        expect(envFileIndex).toBeGreaterThan(-1);
        expect(args[envFileIndex + 1]).toBe(pinnedPath());
        const pinnedContents = fs.readFileSync(pinnedPath(), 'utf8');
        expect(pinnedContents).toContain('CONVEX_SELF_HOSTED_URL=http://127.0.0.1:3210');
        expect(pinnedContents).toContain('CONVEX_SELF_HOSTED_ADMIN_KEY=anonymous-stewardsync-test-mode|test-admin-key');
      }
      return '';
    };
    deps.fetchFn = async url => String(url).endsWith('/instance_name')
      ? new Response('anonymous-stewardsync-test-mode')
      : Response.json({ status: 'success', value: { enabled: true } });

    const ready = Promise.withResolvers<string>();
    deps.log = ready.resolve;
    const run = startTestMode(deps, true);

    expect(await Promise.race([ready.promise, run])).toContain('http://127.0.0.1:3210');
    backendExited({ code: 0, stdout: '' });
    expect(await run).toBe(0);

    const convexCalls = calls.filter(c => c.executable === 'bun' && c.args[1] === 'convex');
    expect(convexCalls.map(c => c.args.slice(2, 4).join(' '))).toEqual([
      'env list',
      'deploy --env-file',
      'env set',
    ]);
    for (const call of convexCalls) {
      expect(call.args).not.toContain('.env.local');
      expect(call.args).not.toContain('dev');
    }
    expect(fs.existsSync(join(deps.cwd, LOCK_FILE))).toBe(false);
  });

  test('remains restartable with the same .env.local after a port fallback and locks concurrent launches', async () => {
    configureProject(3210);
    let backendExited!: (result: Result) => void;
    let allocatedCount = 0;
    deps.allocateLoopbackPorts = async (preferred) => {
      allocatedCount += 1;
      expect(preferred.cloud).toBe(3210);
      return allocatedCount === 1 ? { cloud: 3215, site: 3216 } : { cloud: 3210, site: 3211 };
    };
    onCommand = ({ executable, args }) => {
      if (executable === FAKE_BINARY && args[0] === 'keygen') {
        return 'anonymous-stewardsync-test-mode|generated-admin-key\n';
      }
      if (executable === FAKE_BINARY) return new Promise(resolve => { backendExited = resolve; });
      return '';
    };
    deps.fetchFn = async url => String(url).endsWith('/instance_name')
      ? new Response('anonymous-stewardsync-test-mode')
      : Response.json({ status: 'success', value: { enabled: true } });

    const firstReady = Promise.withResolvers<string>();
    deps.log = firstReady.resolve;
    const firstRun = startTestMode(deps, true);
    expect(await Promise.race([firstReady.promise, firstRun])).toContain('http://127.0.0.1:3215');

    // A concurrent second launcher MUST be rejected by the state directory lock without overwriting config!
    const concurrentDeps: StartupDependencies = { ...deps, pid: process.pid + 1, isProcessAlive: () => true };
    await expect(startTestMode(concurrentDeps, true)).rejects.toThrow('already using');

    backendExited({ code: 0, stdout: '' });
    expect(await firstRun).toBe(0);

    // Saved preferredPorts remain 3210/3211 (NOT 3215/3216), so Run 2 starts cleanly with the original .env.local!
    const saved = JSON.parse(fs.readFileSync(join(deps.cwd, TEST_MODE_CONFIG), 'utf8'));
    expect(saved.preferredPorts).toEqual({ cloud: 3210, site: 3211 });

    const secondReady = Promise.withResolvers<string>();
    deps.log = secondReady.resolve;
    const secondRun = startTestMode(deps, true);
    expect(await Promise.race([secondReady.promise, secondRun])).toContain('http://127.0.0.1:3210');
    backendExited({ code: 0, stdout: '' });
    expect(await secondRun).toBe(0);
  });

  test('handles explicitPort 65535 without overflowing preferred site port', async () => {
    configureProject(65535);
    let capturedPreferred: { cloud: number; site: number } | undefined;
    deps.allocateLoopbackPorts = async (preferred) => {
      capturedPreferred = preferred;
      return { cloud: 65535, site: 40001 };
    };
    let backendExited!: (result: Result) => void;
    onCommand = ({ executable, args }) => {
      if (executable === FAKE_BINARY && args[0] === 'keygen') return 'anonymous-stewardsync-test-mode|k\n';
      if (executable === FAKE_BINARY) return new Promise(resolve => { backendExited = resolve; });
      return '';
    };
    deps.fetchFn = async url => String(url).endsWith('/instance_name')
      ? new Response('anonymous-stewardsync-test-mode')
      : Response.json({ status: 'success', value: { enabled: true } });

    const ready = Promise.withResolvers<string>();
    deps.log = ready.resolve;
    const run = startTestMode(deps, true);
    expect(await Promise.race([ready.promise, run])).toContain('http://127.0.0.1:65535');
    expect(capturedPreferred).toEqual({ cloud: 65535, site: 0 });
    backendExited({ code: 0, stdout: '' });
    expect(await run).toBe(0);
  });

  test('retries boot when site listener is not ready yet, but fails fast on non-loopback exposure', async () => {
    configureTestBackend(3210, 3211);
    onCommand = ({ executable }) => executable === FAKE_BINARY ? new Promise(() => {}) : '';
    deps.fetchFn = async () => new Response('anonymous-stewardsync-test-mode');

    let attempts = 0;
    deps.verifyLoopbackListeners = async () => {
      attempts += 1;
      if (attempts === 1) throw new ListenerNotReadyError('site port still binding');
      throw new NonLoopbackListenerError('Port 3210 is exposed on a non-loopback interface');
    };

    await expect(startTestMode(deps, true)).rejects.toThrow('non-loopback interface');
    expect(attempts).toBe(2);
    expect(calls.filter(c => c.executable === 'bun')).toEqual([]);
    expect(stopped).toHaveLength(1);
  });

  test.each([
    'DISCORD_BOT_TOKEN',
    'DISCORD_RACE_REVIEW_CHANNEL_ID',
  ])('blocks deploy and enable when the isolated backend lists %s', async name => {
    configureTestBackend(3210, 3211);
    onCommand = ({ executable, args }) => {
      if (executable === FAKE_BINARY) return new Promise(() => {});
      if (args.includes('list')) return `OTHER_KEY\n${name}\n`;
      return '';
    };
    deps.fetchFn = async () => new Response('anonymous-stewardsync-test-mode');

    await expect(startTestMode(deps, true)).rejects.toThrow(name);
    expect(calls.filter(c => c.executable === 'bun').map(c => c.args.join(' '))).toEqual([
      `x convex env list --env-file ${pinnedPath()} --names-only`,
    ]);
    expect(fs.existsSync(join(deps.cwd, RUNTIME_CONFIG))).toBe(false);
  });

  test('uses reassigned loopback ports, dedicated test-mode runtime config, and separate frontend origin without touching src/runtime-config.js', async () => {
    configureTestBackend(3210, 3211);
    const ordinaryRuntimeConfig = "window.__STEWARDSYNC_CONFIG__ = { convexUrl: 'https://ordinary.convex.cloud' };\n";
    write(RUNTIME_CONFIG, ordinaryRuntimeConfig);
    write(LOCAL_ENV, EXAMPLE_ENV.replace('false', 'true').replace("''", '"local-discord-app"'));
    deps.allocateLoopbackPorts = async () => ({ cloud: 3215, site: 3216 });
    deps.allocateFrontendPort = async () => 4205;
    const probes: string[] = [];
    onCommand = ({ executable, args }) => {
      if (executable === FAKE_BINARY) {
        expect(args[args.indexOf('--port') + 1]).toBe('3215');
        expect(args[args.indexOf('--site-proxy-port') + 1]).toBe('3216');
        return new Promise(() => {});
      }
      if (args.includes('ng')) {
        expect(args).toEqual([
          'x', 'ng', 'serve', '--configuration', 'test-mode', '--host', '127.0.0.1', '--port', '4205',
        ]);
        const runtime = fs.readFileSync(join(deps.cwd, TEST_MODE_RUNTIME_CONFIG), 'utf8');
        expect(runtime).toBe(`window.__STEWARDSYNC_CONFIG__ = {
  convexUrl: 'http://127.0.0.1:3215',
  enableDevLogin: true,
  discordClientId: "local-discord-app",
};
`);
        // Ordinary src/runtime-config.js MUST remain untouched!
        expect(fs.readFileSync(join(deps.cwd, RUNTIME_CONFIG), 'utf8')).toBe(ordinaryRuntimeConfig);
      }
      return '';
    };
    deps.fetchFn = async (url, init) => {
      probes.push(String(url));
      expect(fs.existsSync(join(deps.cwd, TEST_MODE_RUNTIME_CONFIG))).toBe(false);
      if (String(url).endsWith('/instance_name')) return new Response('anonymous-stewardsync-test-mode');
      expect(init?.method).toBe('POST');
      expect(JSON.parse(String(init?.body))).toEqual({ path: 'testMode:getStatus', args: {} });
      return Response.json({ status: 'success', value: { enabled: true } });
    };

    expect(await startTestMode(deps, false)).toBe(0);
    expect(probes).toEqual([
      'http://127.0.0.1:3215/instance_name',
      'http://127.0.0.1:3215/instance_name',
      'http://127.0.0.1:3215/api/query',
    ]);
    expect(logs.some((line) => line.includes('http://127.0.0.1:4205/test-mode'))).toBe(true);
    // Dedicated test-mode runtime config is cleaned up on shutdown while ordinary src/runtime-config.js is untouched.
    expect(fs.existsSync(join(deps.cwd, TEST_MODE_RUNTIME_CONFIG))).toBe(false);
    expect(fs.readFileSync(join(deps.cwd, RUNTIME_CONFIG), 'utf8')).toBe(ordinaryRuntimeConfig);
    expect(stopped.filter(s => s.startsWith(FAKE_BINARY) || s.includes('ng serve'))).toHaveLength(2);
  });

  test('provisions a fresh checkout offline via keygen and leaves all frontend config files untouched in backend-only mode', async () => {
    const ordinaryRuntimeConfig = "window.__STEWARDSYNC_CONFIG__ = { convexUrl: 'https://ordinary.convex.cloud' };\n";
    write(RUNTIME_CONFIG, ordinaryRuntimeConfig);
    let backendExit!: (result: Result) => void;
    onCommand = ({ executable, args }) => {
      if (executable === FAKE_BINARY && args[0] === 'keygen') {
        return 'anonymous-stewardsync-test-mode|fresh-key\n';
      }
      if (executable === FAKE_BINARY) return new Promise(resolve => { backendExit = resolve; });
      return '';
    };
    deps.fetchFn = async url => {
      expect(fs.existsSync(join(deps.cwd, LOCAL_ENV))).toBe(false);
      return String(url).endsWith('/instance_name')
        ? new Response('anonymous-stewardsync-test-mode')
        : Response.json({ status: 'success', value: { enabled: true } });
    };
    const ready = Promise.withResolvers<string>();
    deps.log = ready.resolve;
    const run = startTestMode(deps, true);

    expect(await Promise.race([ready.promise, run])).toContain('Local Test Mode backend ready at http://127.0.0.1:3210');
    // Backend-only mode must NEVER create environment.local.ts, overwrite src/runtime-config.js, or write test-mode runtime config!
    expect(fs.existsSync(join(deps.cwd, LOCAL_ENV))).toBe(false);
    expect(fs.existsSync(join(deps.cwd, TEST_MODE_RUNTIME_CONFIG))).toBe(false);
    expect(fs.readFileSync(join(deps.cwd, RUNTIME_CONFIG), 'utf8')).toBe(ordinaryRuntimeConfig);
    expect(calls[0].executable).toBe(FAKE_BINARY);
    expect(calls[0].args[0]).toBe('keygen');
    expect(stopped.filter(s => s.startsWith(`${FAKE_BINARY} --interface`))).toEqual([]);
    backendExit({ code: 7, stdout: '' });
    expect(await run).toBe(7);
    expect(stopped.filter(s => s.startsWith(`${FAKE_BINARY} --interface`))).toHaveLength(1);
    expect(fs.readFileSync(join(deps.cwd, RUNTIME_CONFIG), 'utf8')).toBe(ordinaryRuntimeConfig);
  });

  test('preserves existing frontend configuration throughout a backend-only launch', async () => {
    const configFiles = [LOCAL_ENV, RUNTIME_CONFIG, TEST_MODE_RUNTIME_CONFIG];
    for (const path of configFiles) write(path, `existing ${path}`);
    configureTestBackend();

    let backendExit!: (result: Result) => void;
    onCommand = ({ executable }) => executable === FAKE_BINARY
      ? new Promise(resolve => { backendExit = resolve; })
      : '';
    const expectExistingConfig = () => {
      for (const path of configFiles) {
        expect(fs.readFileSync(join(deps.cwd, path), 'utf8')).toBe(`existing ${path}`);
      }
    };
    deps.fetchFn = async url => {
      expectExistingConfig();
      return String(url).endsWith('/instance_name')
        ? new Response('anonymous-stewardsync-test-mode')
        : Response.json({ status: 'success', value: { enabled: true } });
    };
    deps.log = () => backendExit({ code: 0, stdout: '' });

    expect(await startTestMode(deps, true)).toBe(0);
    expectExistingConfig();
  });

  test('times out without updating any browser config if test mode remains disabled', async () => {
    configureTestBackend(3210, 3211);
    deps.readinessTimeoutMs = 40;
    onCommand = ({ executable }) => executable === FAKE_BINARY ? new Promise(() => {}) : '';
    deps.fetchFn = async url => String(url).endsWith('/instance_name')
      ? new Response('anonymous-stewardsync-test-mode')
      : Response.json({ status: 'success', value: { enabled: false } });

    await expect(startTestMode(deps, false)).rejects.toThrow('Timed out');
    expect(fs.existsSync(join(deps.cwd, LOCAL_ENV))).toBe(false);
    expect(fs.existsSync(join(deps.cwd, RUNTIME_CONFIG))).toBe(false);
    expect(fs.existsSync(join(deps.cwd, TEST_MODE_RUNTIME_CONFIG))).toBe(false);
    expect(logs).toEqual([]);
  });

  test('verifies loopback-only bind addresses on Linux and macOS and fails closed when unavailable', async () => {
    // Linux /proc/net/tcp: 3210 = 0x0C8A, 3211 = 0x0C8B, 127.0.0.1 = 0100007F, 0.0.0.0 = 00000000
    const loopbackProc = [
      '  sl  local_address rem_address   st',
      '   0: 0100007F:0C8A 00000000:0000 0A 00000000:00000000',
      '   1: 0100007F:0C8B 00000000:0000 0A 00000000:00000000',
    ].join('\n');
    expect(() => assertProcNetLoopbackOnly(loopbackProc, null, [3210, 3211])).not.toThrow();

    const exposedProc = [
      '  sl  local_address rem_address   st',
      '   0: 00000000:0C8A 00000000:0000 0A 00000000:00000000',
      '   1: 0100007F:0C8B 00000000:0000 0A 00000000:00000000',
    ].join('\n');
    expect(() => assertProcNetLoopbackOnly(exposedProc, null, [3210, 3211])).toThrow(NonLoopbackListenerError);

    // macOS lsof
    const lsofOk = [
      'COMMAND PID USER FD TYPE DEVICE SIZE/OFF NODE NAME',
      'convex 100 dev 9u IPv4 0x1 0t0 TCP 127.0.0.1:3210 (LISTEN)',
      'convex 100 dev 10u IPv6 0x2 0t0 TCP [::1]:3211 (LISTEN)',
    ].join('\n');
    expect(() => assertLsofLoopbackOnly(lsofOk, [3210, 3211])).not.toThrow();
    const lsofExposed = 'convex 100 dev 9u IPv4 0x1 0t0 TCP *:3210 (LISTEN)\nconvex 100 dev 10u IPv4 0x2 0t0 TCP 127.0.0.1:3211 (LISTEN)';
    expect(() => assertLsofLoopbackOnly(lsofExposed, [3210, 3211])).toThrow(NonLoopbackListenerError);

    // Fail closed when inspection tools or /proc/net/tcp are unavailable or platform unsupported
    const noProcFs = { ...fs, existsSync: () => false };
    await expect(defaultVerifyLoopbackListeners({ fs: noProcFs, platform: 'linux' }, { cloud: 3210, site: 3211 }))
      .rejects.toThrow(NonLoopbackListenerError);
    await expect(defaultVerifyLoopbackListeners({
      fs, platform: 'darwin', inspectListenersCommand: () => { throw new Error('ENOENT'); },
    }, { cloud: 3210, site: 3211 })).rejects.toThrow(NonLoopbackListenerError);
    await expect(defaultVerifyLoopbackListeners({ fs, platform: 'freebsd' }, { cloud: 3210, site: 3211 }))
      .rejects.toThrow(NonLoopbackListenerError);
  });

  test('starts with a clean SQLite DB on restart so crashed state never carries STEWARDSYNC_TEST_MODE before bind verification', async () => {
    configureTestBackend(3210, 3211);
    write('.convex/test-mode/convex_local_backend.sqlite3', 'stale-crashed-db');
    write('.convex/test-mode/convex_local_backend.sqlite3-wal', 'stale-wal');
    write(PINNED_ENV, 'CONVEX_SELF_HOSTED_URL=http://127.0.0.1:3210\n');

    let sawCleanDbAtBackendLaunch = false;
    onCommand = ({ executable }) => {
      if (executable === FAKE_BINARY) {
        sawCleanDbAtBackendLaunch =
          !fs.existsSync(join(deps.cwd, '.convex/test-mode/convex_local_backend.sqlite3')) &&
          !fs.existsSync(join(deps.cwd, '.convex/test-mode/convex_local_backend.sqlite3-wal')) &&
          !fs.existsSync(pinnedPath());
        return new Promise(() => {});
      }
      return '';
    };
    deps.fetchFn = async () => new Response('anonymous-stewardsync-test-mode');
    deps.verifyLoopbackListeners = async () => {
      throw new NonLoopbackListenerError('Port 3210 exposed');
    };

    await expect(startTestMode(deps, true)).rejects.toThrow('Port 3210 exposed');
    expect(sawCleanDbAtBackendLaunch).toBe(true);
    expect(fs.existsSync(pinnedPath())).toBe(false);
  });

  test('fails closed when two contenders encounter a stale lock file and keeps lock if child shutdown fails', async () => {
    configureTestBackend(3210, 3211);
    const stalePayload = JSON.stringify({ pid: 999_999, startedAt: 1 }) + '\n';
    write(LOCK_FILE, stalePayload);

    const contender1: StartupDependencies = { ...deps, pid: 1001, isProcessAlive: () => false };
    const contender2: StartupDependencies = { ...deps, pid: 1002, isProcessAlive: () => false };
    const [r1, r2] = await Promise.allSettled([
      startTestMode(contender1, true),
      startTestMode(contender2, true),
    ]);
    expect(r1.status).toBe('rejected');
    expect(r2.status).toBe('rejected');
    expect(calls).toEqual([]);
    expect(fs.readFileSync(join(deps.cwd, LOCK_FILE), 'utf8')).toBe(stalePayload);

    // Explicit recovery by removing stale lock succeeds; if stop() fails, lock is retained!
    fs.rmSync(join(deps.cwd, LOCK_FILE));
    const failingStopDeps: StartupDependencies = {
      ...deps,
      pid: 1003,
      verifyLoopbackListeners: async () => {
        throw new NonLoopbackListenerError('exposed');
      },
      fetchFn: async () => new Response('anonymous-stewardsync-test-mode'),
      commandRunner(executable, args, options) {
        calls.push({ executable, args, env: options.env });
        return {
          result: new Promise(() => {}),
          stop: async () => { throw new Error('Child refused to exit'); },
        };
      },
    };
    const failedLaunch = startTestMode(failingStopDeps, true);
    await expect(failedLaunch).rejects.toThrow(CleanupError);
    await expect(failedLaunch).rejects.toThrow('Startup also failed: exposed');
    expect(fs.existsSync(join(deps.cwd, LOCK_FILE))).toBe(true);
  });

  test.each(['normal exit', 'abort'])('reports failed cleanup after %s and retains state', async reason => {
    configureTestBackend();
    const abortController = new AbortController();
    const backend = Promise.withResolvers<Result>();
    const unverifiedShutdownDeps: StartupDependencies = {
      ...deps,
      pid: 1004,
      fetchFn: async url => String(url).endsWith('/instance_name')
        ? new Response('anonymous-stewardsync-test-mode')
        : Response.json({ status: 'success', value: { enabled: true } }),
      commandRunner(executable, args, options) {
        calls.push({ executable, args, env: options.env });
        if (executable === FAKE_BINARY) {
          return {
            result: backend.promise,
            stop: async () => { throw new Error('Descendant still alive'); },
          };
        }
        return {
          result: Promise.resolve({ code: 0, stdout: '' }),
          stop: async () => undefined,
        };
      },
      log: () => {
        if (reason === 'abort') abortController.abort();
        else backend.resolve({ code: 0, stdout: '' });
      },
    };
    await expect(startTestMode(unverifiedShutdownDeps, true, abortController.signal)).rejects.toThrow(CleanupError);
    expect(fs.existsSync(join(deps.cwd, LOCK_FILE))).toBe(true);
    expect(fs.existsSync(pinnedPath())).toBe(true);
  });

  test('the CLI exits with status 1 when a shutdown error leaves a child running', async () => {
    if (process.platform !== 'linux' && process.platform !== 'darwin') return;

    configureTestBackend();
    const binary = join(deps.homeDir, '.cache/convex/binaries/test/convex-local-backend');
    fs.mkdirSync(dirname(binary), { recursive: true });
    fs.writeFileSync(binary, '#!/bin/sh\nprintf "%s\\n" "$$" > backend.pid\nexec sleep 60\n', { mode: 0o700 });
    write('preload.ts', `
      const kill = process.kill.bind(process);
      process.kill = (pid, signal) => {
        if (pid < 0 && signal === 'SIGINT') {
          throw Object.assign(new Error('simulated group signal failure'), { code: 'EPERM' });
        }
        return kill(pid, signal);
      };
      globalThis.fetch = async () => new Response(null, { status: 503 });
    `);
    const launcher = Bun.spawn([
      process.execPath, '--no-env-file', '--preload', './preload.ts',
      join(import.meta.dir, 'lib/test-mode-startup.ts'), '--backend-only',
    ], {
      cwd: deps.cwd,
      env: { HOME: deps.homeDir, PATH: process.env.PATH },
      stdout: 'ignore',
      stderr: 'pipe',
    });
    const backendPidFile = join(deps.cwd, 'backend.pid');
    const deadline = Date.now() + 2_000;
    let backendPid: number | undefined;
    try {
      while (!backendPid && Date.now() < deadline) {
        if (fs.existsSync(backendPidFile)) {
          backendPid = Number(fs.readFileSync(backendPidFile, 'utf8').trim());
        }
        if (!backendPid) await Bun.sleep(10);
      }
      expect(backendPid).toBeGreaterThan(0);
      launcher.kill('SIGINT');
      const stopLauncher = setTimeout(() => launcher.kill('SIGKILL'), 1_500);
      try {
        expect(await launcher.exited).toBe(1);
      } finally {
        clearTimeout(stopLauncher);
      }
      expect(await new Response(launcher.stderr).text()).toContain('simulated group signal failure');
      expect(fs.existsSync(join(deps.cwd, LOCK_FILE))).toBe(true);
    } finally {
      if (launcher.exitCode === null) launcher.kill('SIGKILL');
      if (backendPid && isProcessGroupAlive(backendPid)) process.kill(-backendPid, 'SIGKILL');
    }
  });

  test('real POSIX command runner escalates to SIGKILL when wrapper exits on SIGINT leaving a live descendant', async () => {
    if (process.platform === 'win32') return;

    const childPidFile = join(root, 'descendant.pid');
    const processGroups = new Set<number>();
    const runner = createCliCommandRunner({
      processGroups,
      gracefulTimeoutMs: 150,
      killTimeoutMs: 1_500,
      pollIntervalMs: 15,
    });

    // Wrapper traps SIGINT and exits immediately while leaving a long-lived `sleep 60` descendant
    // that ignores SIGINT in the same process group.
    const script = [
      'trap "exit 0" INT',
      `sh -c 'trap "" INT; echo $$ > "${childPidFile}"; exec sleep 60' &`,
      'while [ ! -s "' + childPidFile + '" ]; do sleep 0.01; done',
      'while true; do sleep 0.05; done',
    ].join('\n');
    const cmd = runner('sh', ['-c', script], { cwd: root, env: process.env, captureStdout: false });

    // Wait until the wrapper has spawned its SIGINT-ignoring descendant.
    const deadline = Date.now() + 3_000;
    while ((!fs.existsSync(childPidFile) || !fs.readFileSync(childPidFile, 'utf8').trim()) && Date.now() < deadline) {
      await Bun.sleep(15);
    }
    const descendantPid = Number(fs.readFileSync(childPidFile, 'utf8').trim());
    expect(Number.isInteger(descendantPid) && descendantPid > 0).toBe(true);
    expect(() => process.kill(descendantPid, 0)).not.toThrow();

    // Stop must notice the surviving descendant even after the wrapper closes on SIGINT,
    // escalate to SIGKILL on the process group, and confirm the descendant is dead.
    await cmd.stop();
    expect(processGroups.size).toBe(0);
    expect(() => process.kill(descendantPid, 0)).toThrow();

    // And if group liveness cannot be verified dead, stop() MUST reject and keep the group tracked.
    const stuckGroups = new Set<number>();
    const stuckRunner = createCliCommandRunner({
      processGroups: stuckGroups,
      gracefulTimeoutMs: 30,
      killTimeoutMs: 30,
      pollIntervalMs: 10,
      isGroupAlive: () => true,
    });
    const shortCmd = stuckRunner('sh', ['-c', 'exit 0'], { cwd: root, env: process.env, captureStdout: false });
    await shortCmd.result;
    await expect(shortCmd.stop()).rejects.toThrow('still has live processes');
    expect(stuckGroups.size).toBe(1);
    expect(isProcessGroupAlive(-1)).toBe(false);
  });
});
