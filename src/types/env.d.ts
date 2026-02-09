export interface ProcessEnv {
  NODE_ENV?: string;
  PUBLIC_ENABLE_DEV_LOGIN?: string;
  PUBLIC_CONVEX_URL?: string;
  CONVEX_URL?: string;
  DISCORD_CLIENT_ID?: string;
  DISCORD_CLIENT_SECRET?: string;
  CONVEX_SELF_HOSTED_URL?: string;
  CONVEX_SELF_HOSTED_ADMIN_KEY?: string;
}

export interface Window {
  __STEWARDSYNC_CONFIG__?: {
    convexUrl?: string;
    enableDevLogin?: boolean | string;
    discordClientId?: string;
    discordClientSecret?: string;
  };
}
