# Railway Deployment - Pre-Built Image Strategy

This approach avoids Railway build timeouts by building the Docker image in GitHub Actions and having Railway pull the pre-built image.

## How It Works

1. **GitHub Actions** builds the Angular app and Docker image (no timeout limits)
2. **Image is pushed** to GitHub Container Registry (GHCR)
3. **Railway pulls** the pre-built image (fast, no build needed)

## Setup Steps

### 1. Push Code to Trigger Build

```bash
git add .
git commit -m "Setup Railway deployment"
git push origin master  # or main
```

This triggers the GitHub Action which will:
- Build the Docker image (~5-10 minutes)
- Push to `ghcr.io/YOUR_USERNAME/stewardsync:latest`

**Check build progress:** Go to your GitHub repo → "Actions" tab

### 2. Make Package Public

After the first build completes:

1. Go to your GitHub repository page
2. Click "Packages" on the right sidebar
3. Click on the `stewardsync` package
4. Click "Package settings" (⚙️)
5. Scroll to "Danger Zone"
6. Click "Change visibility" → Select "Public" → Confirm

**Why?** Railway needs public access to pull the image (unless you configure private registry authentication).

### 3. Deploy to Railway

#### Option A: Using Railway Dashboard (Recommended)

1. Go to [railway.app](https://railway.app)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your `StewardSync` repository
5. Railway will detect `railway.json` automatically

**Set these environment variables in Railway:**
```
PUBLIC_CONVEX_URL=https://your-project.convex.cloud
PUBLIC_ENABLE_DEV_LOGIN=false
PORT=80
RAILWAY_GH_REPO=YOUR_GITHUB_USERNAME/stewardsync
```

**Important:** Replace `YOUR_GITHUB_USERNAME/stewardsync` with your actual path.
- Example: `nkania/StewardSync` (case-sensitive!)

6. Click "Deploy"

Railway will pull the pre-built image (takes ~30 seconds) and deploy it.

#### Option B: Using Railway CLI

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Set environment variables
railway variables set PUBLIC_CONVEX_URL=https://your-project.convex.cloud
railway variables set PUBLIC_ENABLE_DEV_LOGIN=false
railway variables set PORT=80
railway variables set RAILWAY_GH_REPO=YOUR_GITHUB_USERNAME/stewardsync

# Deploy
railway up
```

### 4. Get Your App URL

After deployment:
1. Railway Dashboard → Your service
2. Copy the generated URL (e.g., `https://stewardsync-production.up.railway.app`)
3. Visit the URL to see your app!

### 5. Configure Convex CORS (If Needed)

If you get CORS errors:
1. Go to [dashboard.convex.dev](https://dashboard.convex.dev)
2. Select your project
3. Settings → Allowed Origins
4. Add your Railway URL

## Automatic Updates

Every time you push to `master`/`main`:
1. ✅ GitHub Actions builds new image automatically
2. ✅ Pushes to GHCR with `:latest` tag
3. ⚠️ Railway does NOT auto-redeploy (you need to trigger manually)

**To redeploy after pushing code:**
1. Railway Dashboard → Your service
2. Click latest deployment → "Redeploy"

Or use CLI:
```bash
railway redeploy
```

## Benefits

✅ **No build timeouts** - GitHub Actions has generous build time limits
✅ **Faster Railway deploys** - Just pulls image (~30 seconds vs 10+ minutes)
✅ **Free GitHub Actions** - 2000 minutes/month on free tier
✅ **Build caching** - GitHub Actions caches Docker layers
✅ **No Railway compute wasted on builds** - Only pay for runtime

## Local Testing

Test the same image locally before deploying:

```bash
# Pull the image
docker pull ghcr.io/YOUR_USERNAME/stewardsync:latest

# Run it
docker run -p 4200:80 \
  -e PUBLIC_CONVEX_URL=https://your-dev.convex.cloud \
  ghcr.io/YOUR_USERNAME/stewardsync:latest
```

Visit `http://localhost:4200`

## Troubleshooting

### "Failed to pull image" or "unauthorized"

**Cause:** Package is private

**Fix:**
1. GitHub → Your repo → Packages
2. Click on `stewardsync` package
3. Package settings → Change visibility → Public

### "Image not found"

**Cause:** GitHub Actions hasn't run yet or failed

**Fix:**
1. Check GitHub Actions tab for build status
2. Verify the image exists at `ghcr.io/YOUR_USERNAME/stewardsync`
3. Make sure `RAILWAY_GH_REPO` variable matches exactly (case-sensitive)

### Environment variables not working

**Cause:** Variables need to be set in Railway, not baked into image

**Fix:**
1. Railway Dashboard → Service → Variables
2. Add `PUBLIC_CONVEX_URL` and other variables
3. Redeploy

### Old version deployed

**Cause:** Railway doesn't auto-pull new images

**Fix:**
1. After pushing code and waiting for GitHub Actions to finish
2. Railway Dashboard → Redeploy
3. Or set up Railway GitHub integration to auto-deploy on push

## Cost Breakdown

- **GitHub Actions**: Free (2000 min/month)
- **GHCR Storage**: Free for public images
- **Railway**: ~$5/month for 1 service

**Total: ~$5/month**

(vs $15+/month self-hosting backend + frontend)

## Alternative: Skip Railway, Use GHCR Directly

You can also run the image on any cloud provider:

```bash
# On any server with Docker
docker run -d -p 80:80 \
  -e PUBLIC_CONVEX_URL=https://your.convex.cloud \
  --restart unless-stopped \
  ghcr.io/YOUR_USERNAME/stewardsync:latest
```

This works on:
- DigitalOcean Droplets
- AWS EC2
- Google Cloud Run
- Azure Container Instances
- Fly.io
- Any Docker host
