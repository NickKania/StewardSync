# Vercel Deployment Guide

This guide explains how to deploy StewardSync to Vercel with proper Convex configuration.

## Prerequisites

- A Vercel account
- A Convex Cloud deployment (or self-hosted Convex instance)
- Discord OAuth credentials (optional, for Discord login)

## Setup Steps

### 1. Get Your Convex Deployment URL

Run this command to detect your Convex deployment URL:

```bash
bun run detect:convex-url
```

This will output something like:
```
✅ Detected Convex deployment URL:

   https://your-project-name.convex.cloud

To set this in Vercel:
  1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
  2. Add new variable:
     - Name: PUBLIC_CONVEX_URL
     - Value: https://your-project-name.convex.cloud
     - Environments: Production, Preview, Development (select all that apply)
  3. Click Save
  4. Redeploy your application
```

Alternatively, get your URL from [dashboard.convex.dev](https://dashboard.convex.dev).

### 2. Set Environment Variables in Vercel

Go to Vercel Dashboard → Your Project → Settings → Environment Variables

Add the following variables:

#### Required Variables

| Variable | Value | Example |
|----------|-------|---------|
| `PUBLIC_CONVEX_URL` | Your Convex deployment URL | `https://your-project.convex.cloud` |

#### Optional Variables

| Variable | Value | Description |
|----------|-------|-------------|
| `PUBLIC_ENABLE_DEV_LOGIN` | `false` (recommended) | Enable dev login bypass for testing |
| `DISCORD_CLIENT_ID` | Your Discord application client ID | Required for Discord login |
| `DISCORD_CLIENT_SECRET` | Your Discord application client secret | Required for Discord login |

**Note:** For security, `DISCORD_CLIENT_SECRET` should only be added to Production environment, not Preview/Development.

### 3. Deploy to Vercel

Push your changes to git and Vercel will automatically deploy:

```bash
git add .
git commit -m "Update Vercel build configuration"
git push
```

Or trigger a manual deploy from Vercel Dashboard.

## How It Works

The build process (`scripts/vercel-build.sh`) automatically:

1. **Checks for `PUBLIC_CONVEX_URL` environment variable**
   - If set in Vercel, uses that value
   - If not set, tries to detect from Convex CLI automatically

2. **Generates configuration files**
   - `src/environments/environment.prod.ts` - Angular build configuration
   - `src/runtime-config.js` - Browser-side configuration

3. **Builds the Angular application** with correct configuration

## Troubleshooting

### Build Error: "PUBLIC_CONVEX_URL is not set"

**Cause:** The environment variable is not set in Vercel, and automatic detection failed.

**Solution:**
1. Run `bun run detect:convex-url` locally
2. Copy the output URL
3. Go to Vercel Dashboard → Settings → Environment Variables
4. Add `PUBLIC_CONVEX_URL` with that value
5. Redeploy

### Discord Login Times Out

**Cause:** The app can't connect to Convex backend.

**Solution:**
1. Check `PUBLIC_CONVEX_URL` is set correctly in Vercel
2. Verify Convex deployment is active at [dashboard.convex.dev](https://dashboard.convex.dev)
3. Check browser console for connection errors
4. Verify `runtime-config.js` is loading (check Network tab)

### Build Works But Login Fails

**Cause:** Discord OAuth is not configured.

**Solution:**
1. Create Discord application at [discord.com/developers](https://discord.com/developers)
2. Add redirect URL: `https://your-vercel-domain.com/auth/callback`
3. Copy Client ID and Client Secret
4. Add `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` to Vercel environment variables

### Automatic Detection Fails

**Cause:** Convex CLI is not authenticated or not linked.

**Solution:**
```bash
# Authenticate with Convex
bun x convex login

# Link your project
bun x convex dev

# Try detection again
bun run detect:convex-url
```

## Environment Variables Quick Reference

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `PUBLIC_CONVEX_URL` | Yes | - | Convex deployment URL |
| `PUBLIC_ENABLE_DEV_LOGIN` | No | `false` | Dev login bypass (set to `true` only for testing) |
| `DISCORD_CLIENT_ID` | No | - | Discord OAuth client ID |
| `DISCORD_CLIENT_SECRET` | No | - | Discord OAuth client secret (Production only) |

## Production Best Practices

1. **Set `PUBLIC_ENABLE_DEV_LOGIN` to `false`** in production
2. **Add Discord OAuth credentials** for user authentication
3. **Use separate Discord applications** for staging and production
4. **Monitor Vercel logs** for build issues
5. **Use Convex dashboard** to monitor backend performance

## Related Files

- `vercel.json` - Vercel configuration
- `scripts/vercel-build.sh` - Vercel build script
- `scripts/detect-convex-url.sh` - URL detection script
- `scripts/build-prod.sh` - Local production build script

## Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Convex Documentation](https://docs.convex.dev)
- [Discord OAuth Documentation](https://discord.com/developers/docs/topics/oauth2)
