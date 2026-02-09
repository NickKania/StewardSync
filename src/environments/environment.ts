/**
 * Angular production build with environment variable support
 * Build configuration that reads environment variables from process.env
 */

interface EnvironmentConfig {
  production: boolean;
  enableDevLogin: boolean;
  convexUrl: string;
  discordClientId: string;
  discordClientSecret: string;
}

function loadEnvConfig(): EnvironmentConfig {
  const env = process.env as any;
  
  if (env.NODE_ENV === 'production') {
    return {
      production: true,
      enableDevLogin: env.PUBLIC_ENABLE_DEV_LOGIN === 'true',
      convexUrl: env.PUBLIC_CONVEX_URL || 'https://your-convex-deployment.convex.cloud',
      discordClientId: env.DISCORD_CLIENT_ID || '',
      discordClientSecret: env.DISCORD_CLIENT_SECRET || ''
    };
  } else {
    return {
      production: false,
      enableDevLogin: env.PUBLIC_ENABLE_DEV_LOGIN !== 'false',
      convexUrl: env.PUBLIC_CONVEX_URL || 'http://127.0.0.1:3210',
      discordClientId: env.DISCORD_CLIENT_ID || '1462225909867221227',
      discordClientSecret: env.DISCORD_CLIENT_SECRET || '_eHd2NggNcZuGNy9YUSQ3_YVCGbbW3gh'
    };
  }
}

export const environment = loadEnvConfig();
