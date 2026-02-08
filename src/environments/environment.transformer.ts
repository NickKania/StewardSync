/**
 * Environment variable injector for Angular build
 * This reads environment variables from process.env and injects them into the built code
 */

export function environmentTransformer(env: any) {
  return {
    file: 'src/environments/environment.ts',
    content: env.content
      .replace(
        /convexUrl: typeof process !== 'undefined' && process.env\?\.PUBLIC_CONVEX_URL \|\| '([^']+)'/,
        `convexUrl: typeof process !== 'undefined' && process.env?.PUBLIC_CONVEX_URL || '${env.rawVariables.PUBLIC_CONVEX_URL || env.production ? 'https://your-convex-deployment.convex.cloud' : 'http://127.0.0.1:3210'}'`
      )
      .replace(
        /enableDevLogin: typeof process !== 'undefined' && process.env\?\.PUBLIC_ENABLE_DEV_LOGIN \|\| ([^,;]+)/,
        `enableDevLogin: coerceBoolean(typeof process !== 'undefined' && process.env?.PUBLIC_ENABLE_DEV_LOGIN) || ${env.rawVariables.PUBLIC_ENABLE_DEV_LOGIN === 'true' ? 'true' : 'false'}`
      )
      .replace(
        /discordClientId: typeof process !== 'undefined' && process.env\?\.DISCORD_CLIENT_ID \|\| '([^']+)'/,
        `discordClientId: typeof process !== 'undefined' && process.env?.DISCORD_CLIENT_ID || '${env.rawVariables.DISCORD_CLIENT_ID || ''}'`
      )
      .replace(
        /discordClientSecret: typeof process !== 'undefined' && process.env\?\.DISCORD_CLIENT_SECRET \|\| '([^']+)'/,
        `discordClientSecret: typeof process !== 'undefined' && process.env?.DISCORD_CLIENT_SECRET || '${env.rawVariables.DISCORD_CLIENT_SECRET || ''}'`
      ),
  };
}

function coerceBoolean(value: string | undefined): boolean | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  return normalized === 'true';
}
