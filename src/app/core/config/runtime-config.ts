import { environment } from "../../../environments/environment";

type RuntimeConfig = {
  convexUrl?: string;
  enableDevLogin?: boolean | string;
};

function coerceBoolean(value: RuntimeConfig["enableDevLogin"]): boolean | undefined {
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
    __STEWARDSYNC_CONFIG__?: RuntimeConfig;
  }
).__STEWARDSYNC_CONFIG__;

export const appRuntimeConfig = {
  convexUrl: runtimeConfig?.convexUrl ?? environment.convexUrl,
  enableDevLogin:
    coerceBoolean(runtimeConfig?.enableDevLogin) ?? environment.enableDevLogin,
} as const;
