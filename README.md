# StewardSync

A unified application for reviewing racing steward reports.

## Prerequisites

- Docker Engine + Docker Compose plugin
- `bun`
- Node.js 20 via `nvm` (for non-Docker workflows)

## Self-Contained Docker Stack

The repository now ships with a single `compose.yaml` that brings up:

- `backend` (Convex self-hosted API + HTTP actions)
- `convex-keygen` (one-shot admin key generation)
- `convex-deployer` (one-shot Convex function deployment)
- `dashboard` (Convex dashboard)
- `frontend` (Angular app served by Nginx with runtime config injection)

### First Run

1. Copy the template environment file:
   ```bash
   cp .env.docker.example .env
   ```
2. Set a secure Convex secret:
   ```bash
   openssl rand -hex 32
   ```
   Put that value in `CONVEX_INSTANCE_SECRET` in `.env`.
3. Start the full stack:
   ```bash
   docker compose up -d --build
   ```
4. Verify containers:
   ```bash
   docker compose ps
   ```
5. Open services:
   - App: `http://localhost:4200`
   - Convex API: `http://127.0.0.1:3210`
   - Convex Actions: `http://127.0.0.1:3211`
   - Convex Dashboard: `http://localhost:6791`

### How It Auto-Links

- `convex-keygen` writes an admin key to shared volume path `/convex/shared/admin_key`.
- `convex-deployer` waits for backend health, reads that key, and runs `bun x convex deploy`.
- `frontend` waits for deploy completion and injects runtime flags (including `PUBLIC_CONVEX_URL` and `PUBLIC_ENABLE_DEV_LOGIN`) into `runtime-config.js` at startup.

## Convex Admin Key

You can retrieve the active key any time with either command:

```bash
docker compose exec backend ./generate_admin_key.sh
```

```bash
docker compose run --rm --entrypoint /bin/sh convex-keygen -ceu 'cat /convex/shared/admin_key'
```

In the running stack, the generated key is stored in the shared Docker volume at `/convex/shared/admin_key`.

## Useful Commands

```bash
# Node 20 (for local non-Docker flows)
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && nvm use 20

# Install dependencies
bun install

# Cloud Convex + Angular dev
bun run dev

# Full Docker stack
bun run docker:up:build
bun run docker:logs
bun run docker:down

# Print local Convex admin key
bun run convex:local:admin-key
```

## Fast Docker Build for macOS

Docker builds on macOS can be slow due to filesystem I/O overhead. For faster local development:

```bash
# Fast build (pre-builds Angular locally, then creates Docker image)
bun run docker:build:fast

# Or run the script directly
./scripts/build-docker-fast.sh

# Then start the stack with the fast build
docker compose -f docker-compose.fast.yml up
```

**Why use fast builds?**
- Standard Docker build: 20+ minutes on macOS
- Fast build: ~30 seconds (5 seconds for Angular + 25 seconds for Docker image)

**When to use:**
- Local development on macOS
- Rapid iteration during development
- When you need quick feedback loops

**When NOT to use:**
- CI/CD pipelines (use standard Dockerfile)
- Production builds (use standard Dockerfile)
- When building on Linux/WSL2 (standard build is fast enough)

See [docs/docker-fast-build.md](docs/docker-fast-build.md) for more details and troubleshooting.

## Cloud Vendor Deployment (Docker Compose)

This flow works on any provider where you control a Linux host/VM with Docker.

1. Provision host resources:
   - Linux VM/instance
   - Docker + Compose installed
   - Persistent disk for Docker volumes
2. Configure DNS:
   - `app.<your-domain>` -> frontend
   - `api.<your-domain>` -> Convex API (`3210`)
   - `actions.<your-domain>` -> Convex HTTP actions (`3211`)
   - Optional: `convex-dashboard.<your-domain>` -> dashboard (`6791`)
3. Copy project and environment file:
   ```bash
   cp .env.docker.example .env
   ```
4. Set required `.env` values:
   - `CONVEX_INSTANCE_SECRET`: generate with `openssl rand -hex 32`
   - `CONVEX_INSTANCE_NAME`: stable instance label (for key derivation)
   - `CONVEX_CLOUD_ORIGIN`: public Convex API URL, e.g. `https://api.example.com`
   - `CONVEX_SITE_ORIGIN`: public Convex actions URL, e.g. `https://actions.example.com`
   - `PUBLIC_CONVEX_URL`: browser-visible Convex API URL (usually same as `CONVEX_CLOUD_ORIGIN`)
   - `PUBLIC_ENABLE_DEV_LOGIN`: set to `false` for production deployments
   - `NEXT_PUBLIC_DEPLOYMENT_URL`: dashboard target URL (usually same as `CONVEX_CLOUD_ORIGIN`)
5. Deploy:
   ```bash
   docker compose up -d --build
   ```
6. Validate:
   ```bash
   docker compose ps
   docker compose logs --tail=200 convex-deployer backend frontend
   ```
7. Capture and store admin key in your cloud secret manager:
   ```bash
   docker compose exec backend ./generate_admin_key.sh
   ```
 8. For upgrades:
  ```bash
  git pull
  docker compose up -d --build
  ```

## Container Registry Deployment (Docker Hub)

### Automated CI/CD (Recommended)

1. Configure Docker Hub credentials in GitHub Actions:
   - Go to: **Settings → Secrets and variables → Actions**
   - Add `DOCKER_USERNAME`: Your Docker Hub username
   - Add `DOCKER_PASSWORD`: Docker Hub access token (create at https://hub.docker.com/settings/security)

2. Images build automatically on push to `main` branch
   - View workflow runs: **Actions** tab in GitHub
   - Image tags: `<username>/stewardsync:frontend-<sha7>`, `<username>/stewardsync:deployer-<sha7>`
   - Latest tags: `<username>/stewardsync:frontend-latest`, `<username>/stewardsync:deployer-latest`

3. Update `.env` on your deployment host:
   ```bash
   cp .env.docker.example .env
   # Edit and set:
   # DOCKER_USERNAME=your-dockerhub-username
   ```

4. Deploy:
   ```bash
   docker compose up -d
   ```

### Manual Image Management

Build images locally without pushing:
```bash
# Set your Docker Hub username
export DOCKER_USERNAME=your-username

# Build images
bun run docker:build:local

# Or using script directly
./scripts/build-images.sh
```

Push images to Docker Hub:
```bash
# Push images
./scripts/push-images.sh

# Tag and push as latest (after pushing specific version)
TAG=$(git rev-parse --short HEAD)
./scripts/tag-latest.sh ${TAG}
```

### Image Tags

- `frontend-latest` / `deployer-latest`: Latest stable release from main branch
- `frontend-<sha7>` / `deployer-<sha7>`: Specific commit version (immutable)
- Use commit SHA tags for production deployments for reproducibility

### Rolling Back to a Previous Version

1. Find the commit SHA you want to rollback to:
   ```bash
   git log --oneline
   ```

2. Pull the specific image version:
   ```bash
   docker pull yourusername/stewardsync:frontend-<sha7>
   docker pull yourusername/stewardsync:deployer-<sha7>
   ```

3. Update `compose.yaml` to use specific tags:
   ```yaml
   frontend:
     image: yourusername/stewardsync:frontend-abc1234
   convex-deployer:
     image: yourusername/stewardsync:deployer-abc1234
   ```

4. Restart services:
   ```bash
   docker compose up -d
   ```

## Tech Stack

- Frontend: Angular 17+ (standalone components, signals)
- Backend: Convex (self-hosted or cloud)
- Auth: Convex Auth with Google OAuth 2.0
- Styling: Tailwind CSS
