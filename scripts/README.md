# Build Scripts

This directory contains build scripts for different deployment environments.

## Vercel Build

**File:** `vercel-build.sh`

Generates environment files from Vercel environment variables and builds the Angular application for production.

### Usage

This script is automatically called by Vercel during the build process. It requires the following environment variables to be set in Vercel:

- `PUBLIC_CONVEX_URL` (required): Your Convex deployment URL
- `PUBLIC_ENABLE_DEV_LOGIN` (optional, default: `false`): Enable dev login bypass
- `DISCORD_CLIENT_ID` (optional): Discord OAuth client ID
- `DISCORD_CLIENT_SECRET` (optional): Discord OAuth client secret

### What it does

1. Validates that `PUBLIC_CONVEX_URL` is set
2. Generates `src/environments/environment.prod.ts` with environment variables
3. Generates `src/runtime-config.js` for browser-side configuration
4. Runs `bun run build --configuration=production`

### Setting up in Vercel

1. Go to your Vercel project → Settings → Environment Variables
2. Add the required variables:
   - `PUBLIC_CONVEX_URL` = `https://your-deployment.convex.cloud`
   - `PUBLIC_ENABLE_DEV_LOGIN` = `false` (for production)
   - `DISCORD_CLIENT_ID` = your Discord client ID
   - `DISCORD_CLIENT_SECRET` = your Discord client secret
3. Deploy your application

## Production Build

**File:** `build-prod.sh`

Generates environment files from local environment variables and builds for production.

### Usage

```bash
# Build with environment variables
PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud bun run build:prod

# Or source from .env file
source .env && bun run build:prod
```

### Required Environment Variables

- `PUBLIC_CONVEX_URL`: Your Convex deployment URL

### Optional Environment Variables

- `PUBLIC_ENABLE_DEV_LOGIN`: Enable dev login bypass (default: `false`)
- `DISCORD_CLIENT_ID`: Discord OAuth client ID
- `DISCORD_CLIENT_SECRET`: Discord OAuth client secret

## Staging Build

**File:** `generate-env.sh`

Generates environment files for staging from `.env.staging` or environment variables.

### Usage

```bash
# Generate from .env.staging file
bun run build:staging

# Or from environment variables
PUBLIC_CONVEX_URL=https://staging-deployment.convex.cloud bun run build:staging
```

## Docker Build with Environment

**File:** `build-with-env.sh`

Generates runtime-config.js from environment variables before building for Docker.

### Usage

```bash
PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud \
PUBLIC_ENABLE_DEV_LOGIN=false \
bun run build-with-env
```

## Environment Variables Reference

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `PUBLIC_CONVEX_URL` | Convex deployment URL | Yes (production) | `http://127.0.0.1:3210` |
| `PUBLIC_ENABLE_DEV_LOGIN` | Enable dev login bypass | No | `false` |
| `DISCORD_CLIENT_ID` | Discord OAuth client ID | No | (empty) |
| `DISCORD_CLIENT_SECRET` | Discord OAuth client secret | No | (empty) |

## Troubleshooting

### Build fails with "PUBLIC_CONVEX_URL is not set"

Make sure you've set the required environment variables:
- **Vercel**: Add in Vercel dashboard under Settings → Environment Variables
- **Local**: Set in your shell or source from `.env` file

### Discord login times out in production

This usually means `PUBLIC_CONVEX_URL` is not set correctly:
1. Check that `PUBLIC_CONVEX_URL` matches your actual Convex deployment URL
2. Ensure the URL includes `https://` prefix
3. Verify the Convex deployment is active in dashboard.convex.dev

### Runtime config not updating

If `runtime-config.js` is not being generated:
1. Check that the build script has executable permissions
2. Verify the script is being called before the Angular build
3. Check browser console for errors loading `runtime-config.js`
