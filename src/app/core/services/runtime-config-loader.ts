/**
 * Runtime environment configuration loader
 * This reads environment variables from multiple sources:
 * 1. Server-provided runtime config (via endpoint)
 * 2. Browser environment (if available)
 * 3. Default values
 */

export interface RuntimeConfig {
  convexUrl: string;
  enableDevLogin: boolean;
  discordClientId: string;
  discordClientSecret: string;
}

const DEFAULT_CONFIG: RuntimeConfig = {
  convexUrl: 'http://127.0.0.1:3210',
  enableDevLogin: false,
  discordClientId: '',
  discordClientSecret: ''
};

let config: RuntimeConfig | null = null;

export async function loadRuntimeConfig(): Promise<RuntimeConfig | null> {
  if (config) {
    return config;
  }

  try {
    // Try to load from server endpoint
    const response = await fetch('/runtime-config');
    if (response.ok) {
      const serverConfig = await response.json();
      config = { ...DEFAULT_CONFIG, ...serverConfig };
      return config;
    }
  } catch (error) {
    console.warn('Failed to load runtime config from server, using defaults:', error);
  }

  // Fall back to browser environment variables
  config = {
    convexUrl: (typeof process !== 'undefined' && (process.env as any)['PUBLIC_CONVEX_URL']) || DEFAULT_CONFIG.convexUrl,
    enableDevLogin: coerceBoolean((typeof process !== 'undefined' && (process.env as any)['PUBLIC_ENABLE_DEV_LOGIN']) || 'false'),
    discordClientId: (typeof process !== 'undefined' && (process.env as any)['DISCORD_CLIENT_ID']) || DEFAULT_CONFIG.discordClientId,
    discordClientSecret: (typeof process !== 'undefined' && (process.env as any)['DISCORD_CLIENT_SECRET']) || DEFAULT_CONFIG.discordClientSecret
  };

  return config;
}

export function getConfig(): RuntimeConfig {
  if (config) {
    return config;
  }
  return DEFAULT_CONFIG;
}

export function setConfig(newConfig: RuntimeConfig): void {
  config = newConfig;
}

function coerceBoolean(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === 'true';
}
