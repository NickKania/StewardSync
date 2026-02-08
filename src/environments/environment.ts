/**
 * Angular production build with environment variable support
 * Build configuration that reads environment variables from process.env
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

interface EnvironmentConfig {
  production: boolean;
  enableDevLogin: boolean;
  convexUrl: string;
  discordClientId: string;
  discordClientSecret: string;
}

function loadEnvConfig(): EnvironmentConfig {
  const envFile = join(__dirname, '.env');

  if (process.env.NODE_ENV === 'production') {
    return {
      production: true,
      enableDevLogin: process.env.PUBLIC_ENABLE_DEV_LOGIN === 'true',
      convexUrl: process.env.PUBLIC_CONVEX_URL || 'https://your-convex-deployment.convex.cloud',
      discordClientId: process.env.DISCORD_CLIENT_ID || '',
      discordClientSecret: process.env.DISCORD_CLIENT_SECRET || ''
    };
  } else if (process.env.NODE_ENV === 'development') {
    return {
      production: false,
      enableDevLogin: process.env.PUBLIC_ENABLE_DEV_LOGIN !== 'false',
      convexUrl: process.env.PUBLIC_CONVEX_URL || 'http://127.0.0.1:3210',
      discordClientId: process.env.DISCORD_CLIENT_ID || '1462225909867221227',
      discordClientSecret: process.env.DISCORD_CLIENT_SECRET || '_eHd2NggNcZuGNy9YUSQ3_YVCGbbW3gh'
    };
  } else {
    // Load from .env.local file if available
    try {
      const envContent = readFileSync(envFile, 'utf-8');
      const envLines = envContent.split('\n');

      const convexUrl = envLines
        .find(line => line.startsWith('PUBLIC_CONVEX_URL='))
        ?.split('=')[1]
        ?.trim() || 'http://127.0.0.1:3210';

      const enableDevLogin = envLines
        .find(line => line.startsWith('PUBLIC_ENABLE_DEV_LOGIN='))
        ?.split('=')[1]
        ?.trim() === 'true';

      const discordClientId = envLines
        .find(line => line.startsWith('DISCORD_CLIENT_ID='))
        ?.split('=')[1]
        ?.trim() || '1462225909867221227';

      const discordClientSecret = envLines
        .find(line => line.startsWith('DISCORD_CLIENT_SECRET='))
        ?.split('=')[1]
        ?.trim() || '_eHd2NggNcZuGNy9YUSQ3_YVCGbbW3gh';

      return {
        production: false,
        enableDevLogin,
        convexUrl,
        discordClientId,
        discordClientSecret
      };
    } catch (error) {
      return {
        production: false,
        enableDevLogin: false,
        convexUrl: 'http://127.0.0.1:3210',
        discordClientId: '',
        discordClientSecret: ''
      };
    }
  }
}

export const environment = loadEnvConfig();
