import { execFileSync, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import * as net from 'node:net';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';
import ts from 'typescript';

// Use the dotenv parser already installed by dotenv-cli. Parse files without
// merging them into process.env so that one source cannot mask another.
const dotenv = createRequire(import.meta.resolve('dotenv-cli/package.json'))('dotenv') as {
  parse: (content: Buffer) => NodeJS.ProcessEnv;
};

const FORBIDDEN_SELECTORS = [
  'CONVEX_DEPLOY_KEY',
  'CONVEX_DEPLOYMENT_TOKEN',
  'CONVEX_OVERRIDE_ACCESS_TOKEN',
  'CONVEX_SELF_HOSTED_URL',
  'CONVEX_SELF_HOSTED_ADMIN_KEY',
] as const;

const ENV_FILE = '.env.local';
const PROJECT_CONFIG = '.convex/local/default/config.json';
const TEST_MODE_STATE_DIR = '.convex/test-mode';
const TEST_MODE_CONFIG = `${TEST_MODE_STATE_DIR}/config.json`;
const TEST_MODE_PINNED_ENV = `${TEST_MODE_STATE_DIR}/pinned.env`;
const TEST_MODE_RUNTIME_CONFIG = `${TEST_MODE_STATE_DIR}/runtime-config.js`;
const TEST_MODE_LOCK = `${TEST_MODE_STATE_DIR}/launcher.lock`;
const DEFAULT_DEPLOYMENT_NAME = 'anonymous-stewardsync-test-mode';
const DEFAULT_CLOUD_PORT = 3210;
const DEFAULT_SITE_PORT = 3211;
const DEFAULT_FRONTEND_PORT = 4201;
const EGRESS_BLOCK_PROXY = 'http://127.0.0.1:1';
const LOOPBACK_NO_PROXY = '127.0.0.1,localhost,::1';
const NATIVE_WINDOWS_ERROR = 'Local Test Mode requires POSIX process groups for verified shutdown. On Windows, run the launcher in WSL.';

type Env = NodeJS.ProcessEnv;
type Deployment = { name: string; kind: 'anonymous' | 'local' };
type FileSystem = Pick<
  typeof fs,
  'existsSync' | 'readFileSync' | 'writeFileSync' | 'copyFileSync' | 'mkdirSync' | 'readdirSync' | 'chmodSync' | 'rmSync'
>;

export interface RunningCommand {
  result: Promise<{ code: number; stdout: string }>;
  stop: () => Promise<void>;
}

export type CommandRunner = (
  executable: string,
  args: readonly string[],
  options: { cwd: string; env: Env; captureStdout: boolean },
) => RunningCommand;

export interface TestModeBackendConfig {
  deploymentName: string;
  instanceSecret: string;
  adminKey: string;
  preferredPorts: { cloud: number; site: number };
}

export interface StartupDependencies {
  cwd: string;
  homeDir: string;
  env: Env;
  fs: FileSystem;
  commandRunner: CommandRunner;
  fetchFn: typeof fetch;
  log: (message: string) => void;
  platform?: NodeJS.Platform;
  pid?: number;
  isProcessAlive?: (pid: number) => boolean;
  resolveBinary?: () => Promise<string>;
  allocateLoopbackPorts?: (preferred: { cloud: number; site: number }) => Promise<{ cloud: number; site: number }>;
  allocateFrontendPort?: (preferred: number) => Promise<number>;
  verifyLoopbackListeners?: (ports: { cloud: number; site: number }) => Promise<void>;
  inspectListenersCommand?: (file: string, args: readonly string[]) => string;
  readinessTimeoutMs?: number;
  pollIntervalMs?: number;
}

export class ListenerNotReadyError extends Error {}
export class NonLoopbackListenerError extends Error {}
export class CleanupError extends Error {}

function parseDeployment(value: string, source: string): Deployment {
  // Names must also be safe as single directory segments in the legacy lookup.
  const match = /^(anonymous|local):([A-Za-z0-9_-]+)$/.exec(value);
  if (match) {
    const [, prefix, name] = match;
    if (name.startsWith('anonymous-')) return { name, kind: 'anonymous' };
    if (prefix === 'local') return { name, kind: 'local' };
  }
  throw new Error(`${source} CONVEX_DEPLOYMENT must select a local or anonymous deployment`);
}

function loopbackPort(value: string | undefined, source: string): number | undefined {
  if (!value) return undefined;
  const port = Number(/^http:\/\/(?:127\.0\.0\.1|localhost|\[::1\]):([0-9]+)\/?$/.exec(value)?.[1]);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${source} CONVEX_URL must be an HTTP loopback URL with a port`);
  }
  return port;
}

function checkSelectors(env: Env, source: string) {
  for (const key of FORBIDDEN_SELECTORS) {
    if (env[key]) throw new Error(`Remove ${key} from ${source} before starting local test mode`);
  }
  const deployment = env['CONVEX_DEPLOYMENT'];
  return {
    deployment: deployment ? parseDeployment(deployment, source) : undefined,
    port: loopbackPort(env['CONVEX_URL'], source),
  };
}

class ConfigReadError extends Error {}

function readConfig(files: FileSystem, path: string) {
  let config: unknown;
  try {
    config = JSON.parse(files.readFileSync(path, 'utf8'));
  } catch {
    throw new ConfigReadError(`Could not read a valid Convex config at ${path}`);
  }
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error(`Invalid Convex config at ${path}`);
  }
  return config as {
    deploymentName?: unknown;
    instanceSecret?: unknown;
    adminKey?: unknown;
    preferredPorts?: { cloud?: unknown; site?: unknown };
    ports?: { cloud?: unknown; site?: unknown };
  };
}

function checkProjectConfig(deps: StartupDependencies, deployment: Deployment | undefined) {
  const path = join(deps.cwd, PROJECT_CONFIG);
  if (!deps.fs.existsSync(path)) return undefined;
  const config = readConfig(deps.fs, path);
  if (typeof config.deploymentName !== 'string' || !config.deploymentName.trim()) {
    throw new Error(`${PROJECT_CONFIG} requires a non-empty deploymentName`);
  }
  if (config.deploymentName !== deployment?.name) {
    throw new Error(`${PROJECT_CONFIG} deploymentName must match CONVEX_DEPLOYMENT in ${ENV_FILE}`);
  }
  return config;
}

function resolveExistingConvexPort(deps: StartupDependencies, deployment: Deployment): number {
  let config = checkProjectConfig(deps, deployment);
  if (!config) {
    const directory = deployment.kind === 'anonymous'
      ? 'anonymous-convex-backend-state'
      : 'convex-backend-state';
    const path = join(deps.homeDir, '.convex', directory, deployment.name, 'config.json');
    config = readConfig(deps.fs, path);
    if (config.deploymentName !== undefined && config.deploymentName !== deployment.name) {
      throw new Error(`deploymentName in ${path} must match CONVEX_DEPLOYMENT in ${ENV_FILE}`);
    }
  }
  const port = config.ports?.cloud;
  if (typeof port !== 'number' || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Convex config requires a valid ports.cloud number');
  }
  return port;
}

function readTestModeConfig(deps: StartupDependencies): TestModeBackendConfig | undefined {
  const path = join(deps.cwd, TEST_MODE_CONFIG);
  if (!deps.fs.existsSync(path)) return undefined;
  const raw = readConfig(deps.fs, path);
  const rawPorts = raw.preferredPorts ?? raw.ports;
  const cloud = rawPorts?.cloud;
  const site = rawPorts?.site;
  if (
    typeof raw.deploymentName !== 'string' ||
    !raw.deploymentName.startsWith('anonymous-') ||
    typeof raw.instanceSecret !== 'string' ||
    !raw.instanceSecret.trim() ||
    typeof raw.adminKey !== 'string' ||
    !raw.adminKey.trim() ||
    typeof cloud !== 'number' || !Number.isInteger(cloud) || cloud < 1 || cloud > 65535 ||
    typeof site !== 'number' || !Number.isInteger(site) || site < 1 || site > 65535
  ) {
    throw new Error(`Invalid test-mode backend config at ${TEST_MODE_CONFIG}`);
  }
  return {
    deploymentName: raw.deploymentName,
    instanceSecret: raw.instanceSecret,
    adminKey: raw.adminKey,
    preferredPorts: { cloud, site },
  };
}

function writeRestrictedFile(
  files: FileSystem,
  path: string,
  contents: string,
): void {
  files.mkdirSync(dirname(path), { recursive: true });
  files.writeFileSync(path, contents, { mode: 0o600 });
  files.chmodSync(path, 0o600);
}

function writeTestModeConfig(deps: StartupDependencies, config: TestModeBackendConfig) {
  writeRestrictedFile(
    deps.fs,
    join(deps.cwd, TEST_MODE_CONFIG),
    `${JSON.stringify(config, null, 2)}\n`,
  );
}

function writePinnedEnvFile(deps: StartupDependencies, liveUrl: string, adminKey: string): string {
  const path = join(deps.cwd, TEST_MODE_PINNED_ENV);
  writeRestrictedFile(
    deps.fs,
    path,
    `CONVEX_SELF_HOSTED_URL=${liveUrl}\nCONVEX_SELF_HOSTED_ADMIN_KEY=${adminKey}\n`,
  );
  return path;
}

function defaultIsProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

function acquireStateLock(deps: StartupDependencies): () => void {
  const lockPath = join(deps.cwd, TEST_MODE_LOCK);
  const currentPid = deps.pid ?? process.pid;
  const isAlive = deps.isProcessAlive ?? defaultIsProcessAlive;
  const payload = JSON.stringify({ pid: currentPid, startedAt: Date.now() }) + '\n';

  deps.fs.mkdirSync(dirname(lockPath), { recursive: true });

  try {
    deps.fs.writeFileSync(lockPath, payload, { flag: 'wx', mode: 0o600 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    let existingPid: number | undefined;
    try {
      const parsed = JSON.parse(deps.fs.readFileSync(lockPath, 'utf8')) as { pid?: unknown };
      if (typeof parsed.pid === 'number') existingPid = parsed.pid;
    } catch {
      existingPid = undefined;
    }
    if (existingPid !== undefined && isAlive(existingPid)) {
      throw new Error(
        `Another Local Test Mode launcher (PID ${existingPid}) is already using ${TEST_MODE_STATE_DIR}`,
      );
    }
    const detail = existingPid !== undefined ? ` (recorded PID ${existingPid} is not running)` : '';
    throw new Error(
      `Stale lock file ${TEST_MODE_LOCK} found${detail}. Confirm no Local Test Mode backend is running and remove ${TEST_MODE_LOCK} to recover.`,
    );
  }

  return () => {
    if (!deps.fs.existsSync(lockPath)) return;
    if (deps.fs.readFileSync(lockPath, 'utf8') !== payload) {
      throw new Error('Local Test Mode launcher lock ownership changed');
    }
    deps.fs.rmSync(lockPath, { force: true });
  };
}

function writeTestModeRuntimeConfig(deps: StartupDependencies, liveUrl: string) {
  const path = join(deps.cwd, 'src/environments/environment.local.ts');
  if (!deps.fs.existsSync(path)) {
    deps.fs.copyFileSync(join(deps.cwd, 'src/environments/environment.local.example.ts'), path);
  }
  const source = ts.createSourceFile(path, deps.fs.readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
  let enableDevLogin: boolean | undefined;
  let discordClientId: string | undefined;
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const { name, initializer } of statement.declarationList.declarations) {
      if (!ts.isIdentifier(name) || name.text !== 'environment' || !initializer ||
          !ts.isObjectLiteralExpression(initializer)) continue;
      for (const property of initializer.properties) {
        if (!ts.isPropertyAssignment(property) ||
            !(ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))) continue;
        const kind = property.initializer.kind;
        if (property.name.text === 'enableDevLogin' &&
            (kind === ts.SyntaxKind.TrueKeyword || kind === ts.SyntaxKind.FalseKeyword)) {
          enableDevLogin = kind === ts.SyntaxKind.TrueKeyword;
        }
        if (property.name.text === 'discordClientId' && ts.isStringLiteralLike(property.initializer)) {
          discordClientId = property.initializer.text;
        }
      }
    }
  }
  if (enableDevLogin === undefined || discordClientId === undefined) {
    throw new Error('environment.local.ts requires literal enableDevLogin and discordClientId values');
  }
  const outputPath = join(deps.cwd, TEST_MODE_RUNTIME_CONFIG);
  deps.fs.mkdirSync(dirname(outputPath), { recursive: true });
  deps.fs.writeFileSync(outputPath, `window.__STEWARDSYNC_CONFIG__ = {
  convexUrl: '${liveUrl}',
  enableDevLogin: ${enableDevLogin},
  discordClientId: ${JSON.stringify(discordClientId)},
};
`);
}

function backendCacheDir(homeDir: string): string {
  return join(homeDir, '.cache', 'convex', 'binaries');
}

const BACKEND_EXECUTABLE_NAME = 'convex-local-backend';

function backendDownloadArtifact(platform: NodeJS.Platform): string {
  if (platform === 'darwin') {
    if (process.arch === 'arm64') return 'convex-local-backend-aarch64-apple-darwin.zip';
    if (process.arch === 'x64') return 'convex-local-backend-x86_64-apple-darwin.zip';
  }
  if (platform === 'linux') {
    if (process.arch === 'arm64') return 'convex-local-backend-aarch64-unknown-linux-gnu.zip';
    if (process.arch === 'x64') return 'convex-local-backend-x86_64-unknown-linux-gnu.zip';
  }
  throw new Error(`Unsupported platform ${platform}/${process.arch} for local Convex backend`);
}

function findCachedBackendBinary(deps: StartupDependencies): string | undefined {
  const dir = backendCacheDir(deps.homeDir);
  if (!deps.fs.existsSync(dir)) return undefined;
  const versions = deps.fs.readdirSync(dir).sort().reverse();
  for (const version of versions) {
    const candidate = join(dir, version, BACKEND_EXECUTABLE_NAME);
    if (deps.fs.existsSync(candidate)) return candidate;
  }
  return undefined;
}

export function extractZipArchive(archive: Buffer, targetDir: string, files: FileSystem): void {
  // Locate End of Central Directory record (0x06054b50) from the end of the archive.
  let eocdOffset = -1;
  const minOffset = Math.max(0, archive.length - 65557);
  for (let offset = archive.length - 22; offset >= minOffset; offset -= 1) {
    if (archive.readUInt32LE(offset) === 0x06054b50) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset === -1) throw new Error('Invalid ZIP archive: missing End of Central Directory');

  const totalEntries = archive.readUInt16LE(eocdOffset + 10);
  const centralDirOffset = archive.readUInt32LE(eocdOffset + 16);
  const resolvedRoot = resolve(targetDir);
  const rootPrefix = resolvedRoot.endsWith(sep) ? resolvedRoot : `${resolvedRoot}${sep}`;
  files.mkdirSync(resolvedRoot, { recursive: true });

  let cursor = centralDirOffset;
  for (let i = 0; i < totalEntries; i += 1) {
    if (archive.readUInt32LE(cursor) !== 0x02014b50) {
      throw new Error('Invalid ZIP archive: malformed Central Directory header');
    }
    const method = archive.readUInt16LE(cursor + 10);
    const compressedSize = archive.readUInt32LE(cursor + 20);
    const fileNameLen = archive.readUInt16LE(cursor + 28);
    const extraLen = archive.readUInt16LE(cursor + 30);
    const commentLen = archive.readUInt16LE(cursor + 32);
    const localHeaderOffset = archive.readUInt32LE(cursor + 42);
    const entryName = archive.subarray(cursor + 46, cursor + 46 + fileNameLen).toString('utf8');
    cursor += 46 + fileNameLen + extraLen + commentLen;

    if (entryName.endsWith('/')) continue;
    const outputPath = resolve(resolvedRoot, entryName);
    if (!outputPath.startsWith(rootPrefix) && outputPath !== resolvedRoot) {
      throw new Error(`Refusing to extract unsafe ZIP entry "${entryName}"`);
    }
    if (archive.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
      throw new Error('Invalid ZIP archive: malformed local file header');
    }
    const localNameLen = archive.readUInt16LE(localHeaderOffset + 26);
    const localExtraLen = archive.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    const compressed = archive.subarray(dataStart, dataStart + compressedSize);
    const data = method === 0
      ? compressed
      : method === 8
        ? inflateRawSync(compressed)
        : (() => { throw new Error(`Unsupported ZIP compression method ${method}`); })();
    files.mkdirSync(dirname(outputPath), { recursive: true });
    files.writeFileSync(outputPath, data);
  }
}

async function defaultResolveBinary(deps: StartupDependencies): Promise<string> {
  const platform = deps.platform ?? process.platform;
  const cached = findCachedBackendBinary(deps);
  if (cached) return cached;

  const versionResponse = await deps.fetchFn('https://version.convex.dev/v1/local_backend_version');
  if (!versionResponse.ok) {
    throw new Error(`Failed to resolve Convex local backend version (${versionResponse.status})`);
  }
  const { version } = await versionResponse.json() as { version?: unknown };
  if (typeof version !== 'string' || version === '.' || !/^[A-Za-z0-9._-]+$/.test(version) || version.includes('..')) {
    throw new Error('Invalid response from version.convex.dev');
  }

  const versionDir = join(backendCacheDir(deps.homeDir), version);
  const target = join(versionDir, BACKEND_EXECUTABLE_NAME);
  if (deps.fs.existsSync(target)) return target;

  const artifact = backendDownloadArtifact(platform);
  const downloadUrl = `https://github.com/get-convex/convex-backend/releases/download/${version}/${artifact}`;
  const archiveResponse = await deps.fetchFn(downloadUrl);
  if (!archiveResponse.ok) {
    throw new Error(`Failed to download Convex local backend from ${downloadUrl} (${archiveResponse.status})`);
  }
  extractZipArchive(Buffer.from(await archiveResponse.arrayBuffer()), versionDir, deps.fs);
  deps.fs.chmodSync(target, 0o755);
  return target;
}

function tryListenLoopback(port: number): Promise<number | null> {
  return new Promise((resolvePort) => {
    const server = net.createServer();
    server.unref();
    server.once('error', () => resolvePort(null));
    server.listen(port, '127.0.0.1', () => {
      const address = server.address();
      const boundPort = typeof address === 'object' && address ? address.port : null;
      server.close(() => resolvePort(boundPort));
    });
  });
}

async function defaultAllocateLoopbackPorts(
  preferred: { cloud: number; site: number },
): Promise<{ cloud: number; site: number }> {
  const cloud = (await tryListenLoopback(preferred.cloud)) ?? (await tryListenLoopback(0));
  if (!cloud) throw new Error('Unable to allocate a free loopback port for Convex cloud API');
  const preferredSite = preferred.site === cloud || preferred.site < 1 || preferred.site > 65535
    ? 0
    : preferred.site;
  let site = (await tryListenLoopback(preferredSite)) ?? (await tryListenLoopback(0));
  if (site === cloud) site = await tryListenLoopback(0);
  if (!site) throw new Error('Unable to allocate a free loopback port for Convex site proxy');
  return { cloud, site };
}

async function defaultAllocateFrontendPort(preferred = DEFAULT_FRONTEND_PORT): Promise<number> {
  const port = (await tryListenLoopback(preferred)) ?? (await tryListenLoopback(0));
  if (!port) throw new Error('Unable to allocate a free loopback port for Local Test Mode frontend');
  return port;
}

function assertBindMapLoopbackOnly(
  byPort: ReadonlyMap<number, readonly string[]>,
  requiredPorts: readonly number[],
): void {
  for (const port of requiredPorts) {
    const entries = byPort.get(port) ?? [];
    if (entries.length === 0) {
      throw new ListenerNotReadyError(`Expected loopback listener on port ${port}, but no listener was found`);
    }
    const exposed = entries.find((entry) => entry !== 'loopback');
    if (exposed) {
      throw new NonLoopbackListenerError(
        `Port ${port} is exposed on a non-loopback interface (${exposed}); refusing to enable test mode`,
      );
    }
  }
}

/**
 * Parse Linux /proc/net/tcp and /proc/net/tcp6 LISTEN entries and assert that every
 * specified port is listening ONLY on loopback (127.0.0.1 or ::1).
 */
export function assertProcNetLoopbackOnly(
  procNetTcp: string,
  procNetTcp6: string | null,
  requiredPorts: readonly number[],
): void {
  const byPort = new Map<number, string[]>();
  const record = (content: string | null, isIpv6: boolean) => {
    if (!content) return;
    for (const line of content.split('\n').slice(1)) {
      const columns = line.trim().split(/\s+/);
      if (columns.length < 4 || columns[3] !== '0A') continue; // 0A = TCP_LISTEN
      const [addrHex, portHex] = columns[1].split(':');
      if (!addrHex || !portHex) continue;
      const port = Number.parseInt(portHex, 16);
      if (!requiredPorts.includes(port)) continue;
      const isLoopback = isIpv6
        ? addrHex.toUpperCase() === '00000000000000000000000001000000'
        : addrHex.toUpperCase() === '0100007F';
      const list = byPort.get(port) ?? [];
      list.push(isLoopback ? 'loopback' : `non-loopback(${addrHex})`);
      byPort.set(port, list);
    }
  };
  record(procNetTcp, false);
  record(procNetTcp6, true);
  assertBindMapLoopbackOnly(byPort, requiredPorts);
}

/**
 * Parse macOS `lsof -nP -iTCP -sTCP:LISTEN` output and assert every required port
 * listens ONLY on 127.0.0.1 or [::1].
 */
export function assertLsofLoopbackOnly(output: string, requiredPorts: readonly number[]): void {
  const byPort = new Map<number, string[]>();
  for (const line of output.split('\n')) {
    const match = /\bTCP\s+(\S+):(\d+)\s+\(LISTEN\)/.exec(line);
    if (!match) continue;
    const [, host, portStr] = match;
    const port = Number(portStr);
    if (!requiredPorts.includes(port)) continue;
    const isLoopback = host === '127.0.0.1' || host === '[::1]';
    const list = byPort.get(port) ?? [];
    list.push(isLoopback ? 'loopback' : `non-loopback(${host})`);
    byPort.set(port, list);
  }
  assertBindMapLoopbackOnly(byPort, requiredPorts);
}

export async function defaultVerifyLoopbackListeners(
  deps: Pick<StartupDependencies, 'fs' | 'platform' | 'inspectListenersCommand'>,
  ports: { cloud: number; site: number },
): Promise<void> {
  const platform = deps.platform ?? process.platform;
  const required = [ports.cloud, ports.site];
  const inspect = deps.inspectListenersCommand
    ?? ((file: string, args: readonly string[]) => execFileSync(file, args, { encoding: 'utf8' }));

  if (platform === 'linux') {
    if (!deps.fs.existsSync('/proc/net/tcp')) {
      throw new NonLoopbackListenerError(
        'Cannot positively verify loopback-only listeners (/proc/net/tcp unavailable); refusing to enable test mode',
      );
    }
    const tcp = deps.fs.readFileSync('/proc/net/tcp', 'utf8');
    const tcp6 = deps.fs.existsSync('/proc/net/tcp6') ? deps.fs.readFileSync('/proc/net/tcp6', 'utf8') : null;
    assertProcNetLoopbackOnly(tcp, tcp6, required);
    return;
  }

  if (platform === 'darwin') {
    let output: string;
    try {
      output = inspect('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN']);
    } catch {
      throw new NonLoopbackListenerError(
        'Cannot positively verify loopback-only listeners (lsof unavailable); refusing to enable test mode',
      );
    }
    assertLsofLoopbackOnly(output, required);
    return;
  }

  throw new NonLoopbackListenerError(
    `Cannot positively verify loopback-only listeners on unsupported platform "${platform}"; refusing to enable test mode`,
  );
}

async function instanceMatches(
  fetchFn: typeof fetch, url: string, deploymentName: string, signal: AbortSignal,
): Promise<boolean> {
  try {
    const response = await fetchFn(`${url}/instance_name`, { redirect: 'error', signal });
    return response.ok && (await response.text()) === deploymentName;
  } catch {
    return false;
  }
}

async function testModeIsReady(
  fetchFn: typeof fetch, url: string, deploymentName: string, signal: AbortSignal,
): Promise<boolean> {
  try {
    if (!(await instanceMatches(fetchFn, url, deploymentName, signal))) return false;
    const response = await fetchFn(`${url}/api/query`, {
      redirect: 'error',
      signal,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: 'testMode:getStatus', args: {} }),
    });
    if (!response.ok) return false;
    const body = await response.json() as { status?: unknown; value?: { enabled?: unknown } } | null;
    return body?.status === 'success' && body.value?.enabled === true;
  } catch {
    return false;
  }
}

export async function startTestMode(
  deps: StartupDependencies, backendOnly: boolean, signal = new AbortController().signal,
): Promise<number> {
  if ((deps.platform ?? process.platform) === 'win32') throw new Error(NATIVE_WINDOWS_ERROR);
  signal.throwIfAborted();

  const readEnvFile = (name: string): Env => {
    const path = join(deps.cwd, name);
    return deps.fs.existsSync(path) ? dotenv.parse(deps.fs.readFileSync(path)) : {};
  };

  // 1. Preflight selector & config validation (ZERO CLI or backend processes launched before passing!)
  const inherited = checkSelectors(deps.env, 'the inherited environment');
  const dotEnv = checkSelectors(readEnvFile('.env'), '.env');
  const local = checkSelectors(readEnvFile(ENV_FILE), ENV_FILE);
  if (dotEnv.deployment) throw new Error(`Keep CONVEX_DEPLOYMENT in ${ENV_FILE}, and remove it from .env`);
  if (inherited.deployment &&
      (inherited.deployment.name !== local.deployment?.name || inherited.deployment.kind !== local.deployment?.kind)) {
    throw new Error(`Inherited CONVEX_DEPLOYMENT conflicts with ${ENV_FILE}`);
  }
  const explicitPorts = [inherited.port, dotEnv.port, local.port].filter((port): port is number => port !== undefined);
  if (new Set(explicitPorts).size > 1) {
    throw new Error('CONVEX_URL ports conflict across the environment files or inherited environment');
  }
  const explicitPort = explicitPorts[0];
  checkProjectConfig(deps, local.deployment);

  if (local.deployment && explicitPort !== undefined) {
    const existingConvexPort = resolveExistingConvexPort(deps, local.deployment);
    if (explicitPort !== existingConvexPort) {
      throw new Error(`CONVEX_URL specifies port ${explicitPort}, but Convex config specifies ${existingConvexPort}`);
    }
  }

  // Acquire an exclusive lock on .convex/test-mode/ for the full launch lifetime so a second
  // concurrent launcher cannot overwrite config/pinned.env or race SQLite access.
  const releaseLock = acquireStateLock(deps);

  // Build sanitized environments: strip all Convex selectors so CLI calls use ONLY our pinned env file.
  const cliEnv: Env = { ...deps.env, CONVEX_AGENT_MODE: 'anonymous' };
  for (const key of [...FORBIDDEN_SELECTORS, 'CONVEX_DEPLOYMENT', 'CONVEX_URL']) delete cliEnv[key];

  // Belt-and-braces proxy env vars (combined with --convex-http-proxy for Actions fetches).
  const backendEnv: Env = {
    ...cliEnv,
    HTTP_PROXY: EGRESS_BLOCK_PROXY,
    HTTPS_PROXY: EGRESS_BLOCK_PROXY,
    ALL_PROXY: EGRESS_BLOCK_PROXY,
    http_proxy: EGRESS_BLOCK_PROXY,
    https_proxy: EGRESS_BLOCK_PROXY,
    all_proxy: EGRESS_BLOCK_PROXY,
    NO_PROXY: LOOPBACK_NO_PROXY,
    no_proxy: LOOPBACK_NO_PROXY,
  };

  const commands = new Set<RunningCommand>();
  let onAbortListener: (() => void) | undefined;
  const aborted = new Promise<never>((_, reject) => {
    const rejectAbort = () => reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
    if (signal.aborted) {
      rejectAbort();
      return;
    }
    onAbortListener = rejectAbort;
    signal.addEventListener('abort', rejectAbort, { once: true });
  });
  aborted.catch(() => {});

  const launch = (executable: string, args: readonly string[], env: Env, captureStdout = false) => {
    signal.throwIfAborted();
    const command = deps.commandRunner(executable, args, { cwd: deps.cwd, env, captureStdout });
    commands.add(command);
    return command;
  };
  const runCommand = async (executable: string, args: readonly string[], env: Env, captureStdout = false) => {
    const command = launch(executable, args, env, captureStdout);
    const { code, stdout } = await Promise.race([command.result, aborted]);
    signal.throwIfAborted();
    if (code !== 0) throw new Error(`${executable} ${args.join(' ')} exited with code ${code}`);
    await command.stop();
    commands.delete(command);
    return stdout;
  };

  const stateDir = join(deps.cwd, TEST_MODE_STATE_DIR);
  const storageDir = join(stateDir, 'convex_local_storage');
  const sqlitePath = join(stateDir, 'convex_local_backend.sqlite3');
  const pinnedPath = join(deps.cwd, TEST_MODE_PINNED_ENV);
  const runtimeConfigPath = backendOnly ? undefined : join(deps.cwd, TEST_MODE_RUNTIME_CONFIG);
  const wipeLaunchState = () => {
    deps.fs.rmSync(storageDir, { recursive: true, force: true });
    for (const suffix of ['', '-wal', '-shm', '-journal']) {
      deps.fs.rmSync(`${sqlitePath}${suffix}`, { force: true });
    }
    deps.fs.rmSync(pinnedPath, { force: true });
    if (runtimeConfigPath) {
      deps.fs.rmSync(runtimeConfigPath, { force: true });
    }
  };

  let startupError = '';
  try {
    // 2. Resolve local backend binary & start from a clean ephemeral SQLite DB per launch so a
    // crash or restart can NEVER carry STEWARDSYNC_TEST_MODE=true or deployed endpoints past bind verification.
    const binaryPath = await (deps.resolveBinary ? deps.resolveBinary() : defaultResolveBinary(deps));
    wipeLaunchState();
    deps.fs.mkdirSync(storageDir, { recursive: true });

    let config = readTestModeConfig(deps);
    if (!config) {
      const deploymentName = DEFAULT_DEPLOYMENT_NAME;
      const instanceSecret = randomBytes(32).toString('hex');
      const adminKey = (await runCommand(
        binaryPath,
        ['keygen', 'admin-key', '--instance-name', deploymentName, '--instance-secret', instanceSecret],
        cliEnv,
        true,
      )).trim();
      if (!adminKey) throw new Error('Failed to generate local test-mode admin key');
      const preferredCloud = explicitPort ?? DEFAULT_CLOUD_PORT;
      const preferredSite = preferredCloud < 65535 ? preferredCloud + 1 : 0;
      config = {
        deploymentName,
        instanceSecret,
        adminKey,
        preferredPorts: {
          cloud: preferredCloud,
          site: preferredSite === 0 ? DEFAULT_SITE_PORT : preferredSite,
        },
      };
      writeTestModeConfig(deps, config);
    }

    // Keep saved preferredPorts distinct from ephemeral livePorts so a port fallback never bricks restart.
    const allocatePorts = deps.allocateLoopbackPorts ?? defaultAllocateLoopbackPorts;
    const preferredCloud = explicitPort ?? config.preferredPorts.cloud;
    const preferredSite = explicitPort !== undefined
      ? (explicitPort < 65535 ? explicitPort + 1 : 0)
      : config.preferredPorts.site;
    const livePorts = await allocatePorts({ cloud: preferredCloud, site: preferredSite });

    // 3. Launch convex-local-backend directly with --interface 127.0.0.1 and --convex-http-proxy egress block.
    const backendArgs = [
      '--interface', '127.0.0.1',
      '--port', String(livePorts.cloud),
      '--site-proxy-port', String(livePorts.site),
      '--convex-http-proxy', EGRESS_BLOCK_PROXY,
      '--disable-beacon',
      '--instance-name', config.deploymentName,
      '--instance-secret', config.instanceSecret,
      '--local-storage', storageDir,
      sqlitePath,
    ];
    const backend = launch(binaryPath, backendArgs, backendEnv);
    const liveUrl = `http://127.0.0.1:${livePorts.cloud}`;
    const verifyListeners = deps.verifyLoopbackListeners
      ?? ((ports: { cloud: number; site: number }) => defaultVerifyLoopbackListeners(deps, ports));

    // Wait for loopback backend to boot and positively verify BOTH cloud and site listeners are loopback-only.
    const bootController = new AbortController();
    const bootDeadline = AbortSignal.any([
      signal, bootController.signal, AbortSignal.timeout(deps.readinessTimeoutMs ?? 60_000),
    ]);
    try {
      await Promise.race([
        (async () => {
          while (!bootDeadline.aborted) {
            const probeSignal = AbortSignal.any([bootDeadline, AbortSignal.timeout(1_500)]);
            if (await instanceMatches(deps.fetchFn, liveUrl, config.deploymentName, probeSignal)) {
              try {
                await verifyListeners(livePorts);
                return;
              } catch (error) {
                if (!(error instanceof ListenerNotReadyError)) throw error;
              }
            }
            await delay(deps.pollIntervalMs ?? 100, undefined, { signal: bootDeadline });
          }
          bootDeadline.throwIfAborted();
        })(),
        backend.result.then(({ code }) => {
          throw new Error(`Local Convex backend exited with code ${code} before becoming reachable`);
        }),
      ]);
    } catch (error) {
      signal.throwIfAborted();
      if (!bootDeadline.aborted) throw error;
      throw new Error('Timed out waiting for local loopback Convex backend to start');
    } finally {
      bootController.abort();
    }

    // 4. Write launcher-owned pinned env file (mode 0600) so NO Convex CLI command reads or writes .env.local.
    const pinnedEnvPath = writePinnedEnvFile(deps, liveUrl, config.adminKey);
    const pinnedArgs = ['--env-file', pinnedEnvPath];

    // 5. Verify no Discord notification credentials exist on the isolated test backend before push/enable.
    const names = await runCommand('bun', ['x', 'convex', 'env', 'list', ...pinnedArgs, '--names-only'], cliEnv, true);
    const discordVar = names.split(/\s+/).find(name =>
      name === 'DISCORD_BOT_TOKEN' || name === 'DISCORD_RACE_REVIEW_CHANNEL_ID');
    if (discordVar) {
      throw new Error(`Remove ${discordVar} from the local Convex deployment before starting test mode`);
    }

    // 6. Push functions & sharded-counter via `convex deploy` (never `convex dev`, which mutates .env.local!).
    await runCommand('bun', ['x', 'convex', 'deploy', ...pinnedArgs, '--yes'], cliEnv);
    await verifyListeners(livePorts);
    await runCommand('bun', ['x', 'convex', 'env', 'set', ...pinnedArgs, 'STEWARDSYNC_TEST_MODE', 'true'], cliEnv);

    // 7. Verify testMode:getStatus over the verified loopback URL before writing Angular runtime config.
    const readyController = new AbortController();
    const readyDeadline = AbortSignal.any([
      signal, readyController.signal, AbortSignal.timeout(deps.readinessTimeoutMs ?? 60_000),
    ]);
    try {
      await Promise.race([
        (async () => {
          while (!readyDeadline.aborted) {
            const probeSignal = AbortSignal.any([readyDeadline, AbortSignal.timeout(1_500)]);
            if (await testModeIsReady(deps.fetchFn, liveUrl, config.deploymentName, probeSignal)) {
              await verifyListeners(livePorts);
              return;
            }
            await delay(deps.pollIntervalMs ?? 100, undefined, { signal: readyDeadline });
          }
          readyDeadline.throwIfAborted();
        })(),
        backend.result.then(({ code }) => {
          throw new Error(`Local Convex backend exited with code ${code} before test mode became ready`);
        }),
      ]);
    } catch (error) {
      signal.throwIfAborted();
      if (!readyDeadline.aborted) throw error;
      throw new Error('Timed out waiting for testMode:getStatus on the local Convex backend');
    } finally {
      readyController.abort();
    }

    signal.throwIfAborted();
    deps.log(`Local Test Mode backend ready at ${liveUrl} (CLI: --env-file ${TEST_MODE_PINNED_ENV})`);
    if (backendOnly) {
      return (await Promise.race([backend.result, aborted])).code;
    }
    writeTestModeRuntimeConfig(deps, liveUrl);
    const allocateFrontendPort = deps.allocateFrontendPort ?? defaultAllocateFrontendPort;
    const frontendPort = await allocateFrontendPort(DEFAULT_FRONTEND_PORT);
    deps.log(`Local Test Mode UI starting at http://127.0.0.1:${frontendPort}/test-mode`);
    const frontend = launch(
      'bun',
      ['x', 'ng', 'serve', '--configuration', 'test-mode', '--host', '127.0.0.1', '--port', String(frontendPort)],
      cliEnv,
    );
    return (await Promise.race([backend.result, frontend.result, aborted])).code;
  } catch (error) {
    if (!signal.aborted) {
      startupError = ` Startup also failed: ${error instanceof Error ? error.message : String(error)}`;
    }
    throw error;
  } finally {
    if (onAbortListener) signal.removeEventListener('abort', onAbortListener);
    const stopResults = await Promise.allSettled([...commands].map(command => command.stop()));
    const stopFailures = stopResults
      .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
      .map((result) => (result.reason instanceof Error ? result.reason.message : String(result.reason)));
    if (stopFailures.length > 0) {
      throw new CleanupError(
        `Failed to verify child process shutdown (retaining ${TEST_MODE_LOCK}): ${stopFailures.join('; ')}.${startupError}`,
      );
    }
    try {
      wipeLaunchState();
      releaseLock();
    } catch (error) {
      throw new CleanupError(
        `Could not clean up ${TEST_MODE_STATE_DIR}: ${error instanceof Error ? error.message : String(error)}.${startupError}`,
      );
    }
  }
}

export function isProcessGroupAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(-pid, 0);
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'EPERM') return true;
    if (code === 'ESRCH') return false;
    throw error;
  }
}

function signalProcessGroup(pid: number, signal: NodeJS.Signals): void {
  try {
    process.kill(-pid, signal);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
  }
}

export interface CliCommandRunnerOptions {
  processGroups?: Set<number>;
  gracefulTimeoutMs?: number;
  killTimeoutMs?: number;
  pollIntervalMs?: number;
  isGroupAlive?: (pid: number) => boolean;
  sendGroupSignal?: (pid: number, sig: NodeJS.Signals) => void;
}

export function createCliCommandRunner(runnerOptions: CliCommandRunnerOptions = {}): CommandRunner {
  const processGroups = runnerOptions.processGroups ?? new Set<number>();
  const gracefulTimeoutMs = runnerOptions.gracefulTimeoutMs ?? 3_000;
  const killTimeoutMs = runnerOptions.killTimeoutMs ?? 2_000;
  const pollIntervalMs = runnerOptions.pollIntervalMs ?? 25;
  const checkGroupAlive = runnerOptions.isGroupAlive ?? isProcessGroupAlive;
  const sendGroupSignal = runnerOptions.sendGroupSignal ?? signalProcessGroup;

  return function cliCommandRunner(executable, args, { captureStdout, ...options }) {
    const child = spawn(executable, args, {
      ...options,
      detached: true,
      stdio: ['inherit', captureStdout ? 'pipe' : 'inherit', 'inherit'],
    });
    const pid = child.pid;
    if (pid) processGroups.add(pid);
    let directChildClosed = false;
    let stdout = '';
    child.stdout?.setEncoding('utf8').on('data', chunk => { stdout += chunk; });
    const result = new Promise<{ code: number; stdout: string }>((resolveResult, reject) => {
      child.once('error', (error) => {
        directChildClosed = true;
        reject(error);
      });
      child.once('close', (code, sig) => {
        directChildClosed = true;
        resolveResult({ code: code ?? (sig === 'SIGINT' ? 130 : 1), stdout });
      });
    });

    let stopping: Promise<void> | undefined;
    return {
      result,
      stop() {
        if (!pid) return Promise.resolve();
        return stopping ??= (async () => {
          const waitUntilGroupGone = async (timeoutMs: number): Promise<boolean> => {
            if (directChildClosed && !checkGroupAlive(pid)) return true;
            const deadline = Date.now() + timeoutMs;
            while (Date.now() < deadline) {
              const remaining = Math.min(pollIntervalMs, Math.max(1, deadline - Date.now()));
              if (!directChildClosed) {
                await Promise.race([result.catch(() => {}), delay(remaining)]);
              } else {
                await delay(remaining);
              }
              if (directChildClosed && !checkGroupAlive(pid)) return true;
            }
            return directChildClosed && !checkGroupAlive(pid);
          };

          if (directChildClosed && !checkGroupAlive(pid)) {
            processGroups.delete(pid);
            return;
          }

          sendGroupSignal(pid, 'SIGINT');
          if (await waitUntilGroupGone(gracefulTimeoutMs)) {
            processGroups.delete(pid);
            return;
          }

          sendGroupSignal(pid, 'SIGKILL');
          if (await waitUntilGroupGone(killTimeoutMs)) {
            processGroups.delete(pid);
            return;
          }

          throw new Error(`Process group ${pid} still has live processes after SIGKILL`);
        })();
      },
    };
  };
}

function runCli(backendOnly: boolean): Promise<number> {
  const controller = new AbortController();
  const processGroups = new Set<number>();
  const onExit = () => {
    for (const pid of processGroups) {
      try {
        signalProcessGroup(pid, 'SIGKILL');
      } catch {
        // Cleanup already reported the failure and left the launcher lock in place.
      }
    }
  };
  let signalExitCode: number | undefined;
  const onInterrupt = () => {
    signalExitCode ??= 130;
    controller.abort();
  };
  const onTerminate = () => {
    signalExitCode ??= 143;
    controller.abort();
  };
  process.on('SIGINT', onInterrupt);
  process.on('SIGTERM', onTerminate);
  process.once('exit', onExit);

  return startTestMode({
    cwd: process.cwd(),
    homeDir: homedir(),
    fs,
    env: process.env,
    fetchFn: fetch,
    log: console.log,
    commandRunner: createCliCommandRunner({ processGroups }),
  }, backendOnly, controller.signal).then(
    code => signalExitCode ?? code,
    error => {
      if (error instanceof CleanupError) {
        try {
          fs.writeSync(process.stderr.fd, `Local Test Mode: ${error.message}\n`);
        } finally {
          // Unverified children can still hold the event loop open.
          process.exit(1);
        }
      }
      if (signalExitCode !== undefined) return signalExitCode;
      console.error(`Local Test Mode: ${error instanceof Error ? error.message : error}`);
      return 1;
    },
  ).finally(() => {
    process.removeListener('SIGINT', onInterrupt);
    process.removeListener('SIGTERM', onTerminate);
    process.removeListener('exit', onExit);
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== '--backend-only')) {
    console.error('Usage: bun run test-mode:local or bun run test-mode:backend');
    process.exitCode = 1;
  } else {
    process.exitCode = await runCli(args[0] === '--backend-only');
  }
}
