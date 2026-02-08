# Deploy to Vercel (Recommended)

Vercel is optimized for frontend deployments - builds are fast (~2-5 min) and hosting is free.

## Why Vercel/Netlify over Railway?

✅ **Free** - No cost for hobby projects
✅ **Fast builds** - 2-5 minutes (vs 40+ min)
✅ **Optimized for Angular** - Better caching and build optimization
✅ **Auto deploys** - Every push triggers deployment
✅ **Global CDN** - Fast worldwide
✅ **No Docker needed** - Platform handles everything

## Vercel Deployment

### Option 1: Vercel Dashboard (Easiest)

1. Go to [vercel.com](https://vercel.com)
2. Sign up with GitHub
3. Click "Add New Project"
4. Import your `StewardSync` repository
5. Configure:
   - **Framework Preset**: Angular
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist/steward-sync/browser`
   - **Install Command**: `npm install`

6. Add Environment Variable:
   ```
   PUBLIC_CONVEX_URL=https://your-project.convex.cloud
   ```

7. Click "Deploy"

**Done!** Your app will be live at `https://stewardsync.vercel.app` in ~3-5 minutes.

### Option 2: Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel

# Follow prompts, then set env var:
vercel env add PUBLIC_CONVEX_URL production
# Enter: https://your-project.convex.cloud

# Deploy to production
vercel --prod
```

## Netlify Deployment

### Option 1: Netlify Dashboard

1. Go to [netlify.com](https://netlify.com)
2. Sign up with GitHub
3. Click "Add new site" → "Import an existing project"
4. Choose GitHub and select `StewardSync`
5. Build settings (auto-detected from `netlify.toml`):
   - **Build command**: `npm run build`
   - **Publish directory**: `dist/steward-sync/browser`

6. Add Environment Variable:
   ```
   PUBLIC_CONVEX_URL=https://your-project.convex.cloud
   ```

7. Click "Deploy site"

**Done!** Live at `https://stewardsync.netlify.app` in ~3-5 minutes.

### Option 2: Netlify CLI

```bash
# Install Netlify CLI
npm i -g netlify-cli

# Login
netlify login

# Initialize
netlify init

# Deploy
netlify deploy --prod
```

## Custom Domain

**Vercel:**
1. Project Settings → Domains
2. Add your domain
3. Update DNS records as shown

**Netlify:**
1. Site Settings → Domain management
2. Add custom domain
3. Update DNS records

## Environment Variables for Production

Both platforms support environment variables:

```
PUBLIC_CONVEX_URL=https://your-prod.convex.cloud
PUBLIC_ENABLE_DEV_LOGIN=false
```

## Auto Deployments

Both Vercel and Netlify automatically deploy when you push to:
- **main/master** → Production
- **Other branches** → Preview deployments

Every PR gets a unique preview URL!

## Cost Comparison

| Platform | Cost | Build Time | Features |
|----------|------|------------|----------|
| **Vercel** | Free | ~3-5 min | Auto HTTPS, CDN, Preview URLs |
| **Netlify** | Free | ~3-5 min | Auto HTTPS, CDN, Preview URLs |
| Railway | ~$5/mo | 40+ min (timeout) | Docker support |
| Self-host | ~$15/mo | N/A | Full control |

## Recommendation

Use **Vercel** or **Netlify** for frontend - they're:
- ✅ Free
- ✅ 10x faster builds
- ✅ Easier to set up
- ✅ Better DX (developer experience)

Keep Railway/Docker only if you need:
- Custom Docker images
- Full server control
- Private deployments

## Migration from Railway

If you already set up Railway:
1. Deploy to Vercel/Netlify (takes 5 minutes)
2. Test the new deployment
3. Update your main domain to point to Vercel/Netlify
4. Delete Railway project (save $5/month)
