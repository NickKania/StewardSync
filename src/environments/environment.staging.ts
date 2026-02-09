/**
 * Staging environment configuration
 * Reads environment variables from process.env
 * Used for Cloud Development Convex deployment
 */

interface EnvironmentConfig {
  production: boolean;
  enableDevLogin: boolean;
  convexUrl: string;
  discordClientId: string;
  discordClientSecret: string;
}

function loadEnvConfig(): EnvironmentConfig {
  return {
    production: false,
    enableDevLogin: (process.env as any)['PUBLIC_ENABLE_DEV_LOGIN'] === 'true',
    convexUrl: (process.env as any)['PUBLIC_CONVEX_URL'] || '',
    discordClientId: (process.env as any)['DISCORD_CLIENT_ID'] || '',
    discordClientSecret: (process.env as any)['DISCORD_CLIENT_SECRET'] || ''
  };
}

export const environment = loadEnvConfig();
