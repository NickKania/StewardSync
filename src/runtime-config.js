window.__STEWARDSYNC_CONFIG__ = ${JSON.stringify({
  convexUrl: typeof process !== 'undefined' && process.env?.PUBLIC_CONVEX_URL || 'http://127.0.0.1:3210',
  enableDevLogin: typeof process !== 'undefined' && process.env?.PUBLIC_ENABLE_DEV_LOGIN === 'true' || false,
  discordClientId: typeof process !== 'undefined' && process.env?.DISCORD_CLIENT_ID || '',
  discordClientSecret: typeof process !== 'undefined' && process.env?.DISCORD_CLIENT_SECRET || ''
})};
