/**
 * Server-side runtime configuration endpoint for Angular
 * This provides environment variables to the client at runtime
 */

import { Application } from 'express';
import { getRuntimeConfig } from './runtime-config';

export function setupRuntimeConfigEndpoint(app: Application): void {
  app.get('/runtime-config', getRuntimeConfig);
}
