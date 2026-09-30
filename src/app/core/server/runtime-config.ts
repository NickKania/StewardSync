/**
 * Server-side runtime configuration endpoint for Angular
 * This provides environment variables to the client at runtime
 */

import type { Application, Request, Response } from 'express';

interface RuntimeConfig {
  convexUrl: string;
  enableDevLogin: boolean;
  discordClientId: string;
}

const DEFAULT_CONFIG: RuntimeConfig = {
  convexUrl: process.env.PUBLIC_CONVEX_URL || 'http://127.0.0.1:3210',
  enableDevLogin: process.env.PUBLIC_ENABLE_DEV_LOGIN === 'true',
  discordClientId: process.env.DISCORD_CLIENT_ID || '',
};

export function getRuntimeConfigEndpoint(req: Request, res: Response): void {
  res.json({
    convexUrl: DEFAULT_CONFIG.convexUrl,
    enableDevLogin: DEFAULT_CONFIG.enableDevLogin,
    discordClientId: DEFAULT_CONFIG.discordClientId,
  });
}

export function setupRuntimeConfigEndpoint(app: Application): void {
  app.get('/runtime-config', getRuntimeConfigEndpoint);
}
