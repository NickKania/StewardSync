# StewardSync Deployment Guide

This guide covers deploying StewardSync using Convex Cloud (hosted backend) with Railway (frontend hosting).

## Architecture

- **Backend**: Convex Cloud (fully managed)
- **Frontend**: Railway (containerized Angular app)

## Setup Instructions

### 1. Set Up Convex Cloud

```bash
# Install Convex CLI
npm install -g convex

# Login to Convex
npx convex login

# Initialize your project (if not already done)
npx convex dev

# This will:
# - Create a new project on Convex Cloud
# - Generate a deployment URL
# - Deploy your functions
```

After running `npx convex dev`, you'll get a URL like:
```
https://your-project-name.convex.cloud
```

**Save this URL** - you'll need it for the frontend configuration.

### 2. Deploy to Railway

#### Option 1: Using Railway Dashboard (Easiest)

1. Go to [railway.app](https://railway.app) and create a new project
2. Click "New Service" → "GitHub Repo"
3. Connect your StewardSync repository
4. Railway will auto-detect the Dockerfile

#### Set Environment Variables in Railway:

```bash
PUBLIC_CONVEX_URL=https://your-project-name.convex.cloud
PUBLIC_ENABLE_DEV_LOGIN=false
PORT=80
```

5. Click "Deploy"

#### Option 2: Using Railway CLI

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link to your project (or create new)
railway link

# Set environment variables
railway variables set PUBLIC_CONVEX_URL=https://your-project-name.convex.cloud
railway variables set PUBLIC_ENABLE_DEV_LOGIN=false
railway variables set PORT=80

# Deploy
railway up
```

### 3. Configure Custom Domain (Optional)

**In Railway:**
1. Go to your service → Settings → Networking
2. Add custom domain (e.g., `app.stewardsync.com`)
3. Update your DNS records as instructed

**In Convex Dashboard:**
1. Go to [dashboard.convex.dev](https://dashboard.convex.dev)
2. Select your project → Settings
3. Add your Railway domain to allowed origins for CORS

### 4. Production Deployment

For production, deploy to Convex prod environment:

```bash
# Deploy to production
npx convex deploy --prod

# Get your production URL
# It will be like: https://your-project-name.convex.cloud
```

Update Railway environment variable:
```bash
PUBLIC_CONVEX_URL=https://your-project-name.convex.cloud
```

## Local Development

```bash
# Terminal 1: Run Convex dev server
npx convex dev

# Terminal 2: Run Angular dev server
npm start
```

Or with Docker:

```bash
# Create .env file
cp .env.example .env

# Edit .env and set your Convex dev URL
# PUBLIC_CONVEX_URL=https://your-dev-deployment.convex.cloud

# Run frontend
docker compose up
```

## Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `PUBLIC_CONVEX_URL` | Your Convex deployment URL | `https://happy-animal-123.convex.cloud` |
| `PUBLIC_ENABLE_DEV_LOGIN` | Enable development login bypass | `false` (production), `true` (development) |
| `APP_PORT` | Local frontend port | `4200` (default) |

## Costs

- **Convex Cloud**: Free tier includes 1M function calls/month
- **Railway**: ~$5/month for frontend hosting

**Total: ~$5/month** (vs ~$15/month self-hosting)

## Troubleshooting

### Frontend can't connect to Convex

**Check:**
1. `PUBLIC_CONVEX_URL` is set correctly in Railway
2. URL includes `https://` prefix
3. Convex deployment is active (check dashboard.convex.dev)

### CORS errors

**Solution:**
1. Go to Convex Dashboard → Your Project → Settings
2. Add your Railway domain to allowed origins
3. Redeploy frontend

### Build fails on Railway

**Common fixes:**
- Ensure Dockerfile is in repository root
- Check that `dist/steward-sync/browser` path is correct in Dockerfile
- Verify `bun.lock` and `package.json` are committed

## Monitoring

- **Convex Logs**: [dashboard.convex.dev](https://dashboard.convex.dev) → Your Project → Logs
- **Railway Logs**: Railway Dashboard → Your Service → Deployments → View Logs

## Rollback

**Convex:**
```bash
# View deployments
npx convex deployments list

# Rollback to previous
npx convex deployments rollback <deployment-id>
```

**Railway:**
1. Go to Deployments tab
2. Click on a previous successful deployment
3. Click "Redeploy"
