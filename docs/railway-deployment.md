# Railway Deployment Guide

Railway automatically handles SSL, domains, and routing. No reverse proxy needed!

## Quick Start

### 1. Install Railway CLI
```bash
npm i -g @railway/cli
railway login
```

### 2. Create a New Project
```bash
railway init
```

### 3. Deploy Services

Railway doesn't support docker-compose directly. You'll need to deploy each service separately:

#### Option A: Using Railway Dashboard (Recommended - Simplest)

1. Go to [railway.app](https://railway.app) and create a new project
2. Add services one by one:

**Service 1: Convex Backend**
- Click "New Service" → "Docker Image"
- Image: `ghcr.io/get-convex/convex-backend:latest`
- Add volume: `/convex/data`
- Set environment variables (see below)
- Railway will give you a domain like: `convex-backend-production.up.railway.app`

**Service 2: Convex Dashboard**
- Click "New Service" → "Docker Image"
- Image: `ghcr.io/get-convex/convex-dashboard:latest`
- Set environment variables (see below)

**Service 3: Frontend**
- Click "New Service" → "GitHub Repo"
- Connect your repository
- Railway auto-detects the Dockerfile
- Set environment variables (see below)

#### Option B: Using Railway CLI

```bash
# Deploy backend
railway up -s convex-backend -d ghcr.io/get-convex/convex-backend:latest

# Deploy dashboard
railway up -s convex-dashboard -d ghcr.io/get-convex/convex-dashboard:latest

# Deploy frontend (from repo)
railway up -s frontend
```

### 4. Configure Environment Variables

For each service in Railway Dashboard:

**Convex Backend Service:**
```
INSTANCE_NAME=stewardsync-prod
INSTANCE_SECRET=<generate with: openssl rand -hex 32>
CONVEX_CLOUD_ORIGIN=https://${{RAILWAY_PUBLIC_DOMAIN}}
CONVEX_SITE_ORIGIN=https://${{RAILWAY_PUBLIC_DOMAIN}}
RUST_LOG=info
DOCUMENT_RETENTION_DELAY=172800
PORT=3210
```

**Convex Dashboard Service:**
```
NEXT_PUBLIC_DEPLOYMENT_URL=https://${{backend.RAILWAY_PUBLIC_DOMAIN}}
PORT=6791
```

**Frontend Service:**
```
PUBLIC_CONVEX_URL=https://${{backend.RAILWAY_PUBLIC_DOMAIN}}
PUBLIC_ENABLE_DEV_LOGIN=false
PORT=80
```

> **Note:** `${{backend.RAILWAY_PUBLIC_DOMAIN}}` is Railway's syntax for referencing another service's domain.

### 5. Generate Admin Key & Deploy Functions

Once the backend is running:

```bash
# Get the backend URL from Railway dashboard
BACKEND_URL=https://convex-backend-production.up.railway.app

# Generate admin key (you'll need to run this in the Railway backend service terminal)
# In Railway Dashboard: Service → Settings → Terminal
./generate_admin_key.sh

# Deploy Convex functions (from your local machine)
npx convex deploy \
  --admin-key "<admin-key-from-above>" \
  --url $BACKEND_URL
```

### 6. Custom Domains (Optional)

In Railway Dashboard, for each service:
1. Go to Settings → Networking
2. Click "Generate Domain" or add a custom domain
3. Update environment variables with the custom domains

Example custom domain setup:
- Frontend: `app.stewardsync.com`
- Backend: `api.stewardsync.com`
- Dashboard: `dash.stewardsync.com`

## Important Railway Notes

✅ **Automatic SSL** - Railway handles this automatically
✅ **No docker-compose** - Deploy services individually
✅ **Private networking** - Services can talk internally via `${{SERVICE_NAME.RAILWAY_PRIVATE_DOMAIN}}`
✅ **Volumes** - Railway supports persistent volumes (already configured)
⚠️ **Costs** - Railway charges per service (~$5/month per service on Hobby plan)

## Troubleshooting

**Services can't communicate:**
- Use Railway's service reference syntax: `${{backend.RAILWAY_PUBLIC_DOMAIN}}`

**Frontend can't reach backend:**
- Check `PUBLIC_CONVEX_URL` matches the backend's public domain
- Verify CORS settings if needed

**Volume data lost:**
- Ensure volumes are properly mounted in Railway service settings
- Check that `/convex/data` is configured as a persistent volume

## Estimated Costs

Railway Hobby Plan (~$5/service/month):
- Backend: $5/month
- Dashboard: $5/month
- Frontend: $5/month
- **Total: ~$15/month**

Railway Pro Plan has better pricing for multiple services.
