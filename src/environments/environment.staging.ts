/**
 * Staging environment configuration
 * Loads environment variables from .env.staging file
 * Used for Cloud Development Convex deployment
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
  const envFile = join(__dirname, '../../../.env.staging');

  try {
    const envContent = readFileSync(envFile, 'utf-8');
    const envLines = envContent.split('\n');

    const convexUrl = envLines
      .find(line => line.startsWith('PUBLIC_CONVEX_URL='))
      ?.split('=')[1]
      ?.trim() || '';

    const enableDevLogin = envLines
      .find(line => line.startsWith('PUBLIC_ENABLE_DEV_LOGIN='))
      ?.split('=')[1]
      ?.trim() === 'true';

    const discordClientId = envLines
      .find(line => line.startsWith('DISCORD_CLIENT_ID='))
      ?.split('=')[1]
      ?.trim() || '';

    const discordClientSecret = envLines
      .find(line => line.startsWith('DISCORD_CLIENT_SECRET='))
      ?.split('=')[1]
      ?.trim() || '';

    return {
      production: false,
      enableDevLogin,
      convexUrl,
      discordClientId,
      discordClientSecret
    };
  } catch (error) {
    console.warn('Could not load .env.staging file, using empty values');
    return {
      production: false,
      enableDevLogin: false,
      convexUrl: '',
      discordClientId: '',
      discordClientSecret: ''
    };
  }
}

export const environment = loadEnvConfig();
