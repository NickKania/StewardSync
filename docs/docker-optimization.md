# Docker Build Optimization Guide

## Current Optimizations

### 1. **Base Image**
- Switched from Alpine to Debian-based Bun image for better filesystem performance
- Alpine Linux can be significantly slower for certain workloads

### 2. **BuildKit Cache Mounts**
```dockerfile
RUN --mount=type=cache,target=/root/.bun/install/cache,sharing=locked \
    --mount=type=cache,target=/root/.cache,sharing=locked \
    --mount=type=cache,target=/app/.angular/cache,sharing=locked
```
- `sharing=locked`: Ensures cache consistency across builds
- Three separate caches: bun install cache, general cache, and Angular cache

### 3. **Environment Variables**
```dockerfile
ENV NODE_ENV=production \
    NODE_OPTIONS=--max-old-space-size=4096 \
    NG_BUILD_MAX_WORKERS=1 \
    BUN_INSTALL_CACHE_DIR=/root/.bun/install/cache \
    BUN_INSTALL_GLOBAL_DIR=/root/.bun/install/global
```
- Increased Node.js memory limit
- Limited Angular build workers to prevent resource contention
- Explicit cache directory configuration

### 4. **Layer Caching**
- Dependencies installed before source code copying
- Less frequently changed files copied first
- Configuration files copied separately from source code

### 5. **BuildKit Inline Cache**
```bash
--cache-from=${DOCKER_USERNAME}/stewardsync:frontend-latest --cache-to=type=inline
```
- Caches build layers for reuse
- Significantly speeds up subsequent builds

## Build Commands

### Local Build (Fastest)
```bash
# Build without Docker (uses native filesystem)
bun run build
# Takes ~4-5 seconds on this project
```

### Docker Build with BuildKit (Recommended)
```bash
# Enable BuildKit and build
DOCKER_BUILDKIT=1 docker build -t stewardsync:test .

# With cache
DOCKER_BUILDKIT=1 \
  docker build \
  --cache-from=stewardsync:frontend-latest \
  --cache-to=type=inline \
  -t stewardsync:test \
  .
```

### Docker Compose
```bash
# Ensure BuildKit is enabled
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

# Build and run
docker compose up --build frontend

# Or use the provided script
bun run docker:build:local
```

## Troubleshooting Slow Builds

### 1. Check BuildKit is Enabled
```bash
docker version | grep BuildKit
# Should show: BuildKit: (enabled)
```

### 2. Verify Cache is Working
```bash
# First build - expect ~5-10 minutes (cold cache)
docker build -t stewardsync:test .

# Second build - expect ~30-60 seconds (warm cache)
docker build -t stewardsync:test .
```

### 3. Clear Cache if Needed
```bash
# Clear Docker build cache
docker builder prune -a

# Clear BuildKit cache
rm -rf ~/.cache/buildkit
```

### 4. Check Disk Performance
```bash
# On macOS: Check Docker Desktop settings
# - Open Docker Desktop
# - Go to Settings > Resources > Disk image size
# - Ensure adequate space is allocated
```

### 5. Monitor Build Progress
```bash
# Build with detailed output
DOCKER_BUILDKIT=1 docker build --progress=plain -t stewardsync:test .
```

## Expected Build Times

| Build Type | First Build | Cached Build |
|------------|-------------|--------------|
| Local (bun) | ~5 seconds | ~5 seconds |
| Docker (Cold Cache) | 5-10 minutes | 30-60 seconds |
| Docker (Warm Cache) | N/A | 30-60 seconds |

If your Docker builds are taking longer than 10 minutes even with cache, check:

1. **Docker Desktop Settings**
   - Increase CPU and memory allocation
   - Check disk image size

2. **Filesystem Performance**
   - Docker Desktop on macOS uses a Linux VM
   - Large projects can be slow due to filesystem overhead
   - Consider using Docker on Linux or WSL2 for better performance

3. **Network Issues**
   - Ensure dependencies can be downloaded quickly
   - Check if npm registry is accessible

4. **Cache Not Working**
   - Verify BuildKit is enabled
   - Check cache mount paths are correct
   - Ensure `sharing=locked` is set

## Additional Optimizations (Not Currently Applied)

### Multi-stage with Dependency Pre-fetching
Could pre-fetch dependencies in a separate layer to improve cache hits.

### Parallel Build Stages
Build frontend and backend in parallel using BuildKit's parallel builds.

### Layer Squashing
Use `docker build --squash` to reduce final image size (may reduce cache effectiveness).

### CI/CD Optimizations
In CI/CD:
- Use persistent cache storage
- Push cache to registry
- Use Docker Buildx for cross-platform builds

## Monitoring

### Analyze Build Layers
```bash
docker history stewardsync:test
```

### Check Layer Sizes
```bash
docker build --target=builder -t stewardsync:builder .
docker images stewardsync:builder
```

### Profile Build
```bash
DOCKER_BUILDKIT=1 \
  docker build \
  --progress=plain \
  --file=Dockerfile \
  --target=builder \
  -t stewardsync:test \
  . 2>&1 | tee build.log
```
