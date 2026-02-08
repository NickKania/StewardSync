import { RuntimeConfigService } from '../services/runtime-config.service';

type LocalRuntimeConfig = {
  convexUrl?: string;
  enableDevLogin?: boolean | string;
};

function coerceBoolean(value: LocalRuntimeConfig["enableDevLogin"]): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }
    if (normalized === "false") {
      return false;
    }
  }

  return undefined;
}

const runtimeConfig = (
  globalThis as typeof globalThis & {
    __STEWARDSYNC_CONFIG__?: {
      convexUrl?: string;
      enableDevLogin?: boolean | string;
      discordClientId?: string;
      discordClientSecret?: string;
    };
  }
).__STEWARDSYNC_CONFIG__;

export const appRuntimeConfig = {
  convexUrl: runtimeConfig?.convexUrl || 'http://127.0.0.1:3210',
  enableDevLogin:
    coerceBoolean(runtimeConfig?.enableDevLogin) || false,
  discordClientId: runtimeConfig?.discordClientId || '',
  discordClientSecret: runtimeConfig?.discordClientSecret || ''
} as const;
