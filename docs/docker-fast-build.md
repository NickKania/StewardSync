# Fast Docker Build for macOS

## Problem
Docker builds on macOS are slow due to filesystem I/O overhead when syncing files between macOS and the Docker Linux VM.

## Solutions

### Option 1: Pre-build Locally (Fastest for Development)

```bash
# Build locally first
bun run build

# Then use a Dockerfile that just copies the dist folder
docker build -f Dockerfile.fast -t stewardsync:test .
```

Create `Dockerfile.fast`:
```dockerfile
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY dist/steward-sync/browser /usr/share/nginx/html
COPY docker/frontend/runtime-config.template.js /usr/share/nginx/html/
COPY docker/frontend/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
EXPOSE 80
ENTRYPOINT ["/entrypoint.sh"]
```

**Pros:** Very fast (5 seconds + image build)
**Cons:** Not suitable for CI/CD, requires local build

### Option 2: Use Docker Build Optimizations (Recommended for CI/CD)

```bash
# Use the optimized build script
chmod +x scripts/build-docker-optimized.sh
./scripts/build-docker-optimized.sh
```

This script:
- Enables BuildKit
- Uses inline caching
- Shows detailed build progress
- Provides timing information

### Option 3: Optimize Docker Desktop Settings

1. Open Docker Desktop
2. Go to Settings → Resources → File Sharing
3. Add your project directory if not already there
4. Enable "Use Rosetta for x86/amd64 emulation" if on Apple Silicon
5. Increase resources:
   - CPU: 6+ cores
   - Memory: 8GB+
   - Disk: 64GB+

### Option 4: Use Remote Builder or Buildx

```bash
# Use Docker Buildx with remote cache
docker buildx build \
  --cache-from=type=registry,ref=your-registry/stewardsync:buildcache \
  --cache-to=type=registry,ref=your-registry/stewardsync:buildcache,mode=max \
  --progress=plain \
  -t stewardsync:test \
  .
```

## Current Build Times

| Method | First Build | Cached Build |
|--------|-------------|--------------|
| Local (bun) | 5 seconds | 5 seconds |
| Docker (slow) | 20+ minutes | 5-10 minutes |
| Docker (optimized) | 5-8 minutes | 30-60 seconds |
| Docker (fast - pre-build) | ~30 seconds | ~30 seconds |

## Debugging Slow Builds

### Check Build Progress
```bash
DOCKER_BUILDKIT=1 docker build --progress=plain -t stewardsync:test .
```

### Check Cache Usage
```bash
docker build --progress=plain -t stewardsync:test . 2>&1 | grep -E "CACHED|Step"
```

### Monitor Build Resources
```bash
# In another terminal
docker stats
```

### Check BuildKit Logs
```bash
journalctl -u docker | tail -100
```

## Recommendations

### For Local Development on macOS
Use **Option 1** (pre-build locally) for the fastest builds. The Dockerfile.fast only copies the already-built dist folder.

### For CI/CD or Production
Use **Option 2** with the optimized build script. This ensures consistent builds across environments.

### For Teams with Mixed Environments
- macOS developers: Use Option 1 for local builds
- Linux/WSL2 developers: Can use full Docker builds
- CI/CD: Use Option 2 with remote caching

## Additional Tips

1. **Keep .dockerignore up to date** - Exclude unnecessary files
2. **Use layer caching** - Don't modify frequently changed files early in Dockerfile
3. **Minimize number of layers** - Combine related commands
4. **Use multi-stage builds** - Only copy what's needed
5. **Enable BuildKit** - It's much faster than legacy builder

## Troubleshooting

### Build Still Slow After Optimizations

1. Check Docker Desktop resource allocation
2. Ensure BuildKit is enabled
3. Try building with `--no-cache` to rule out cache corruption
4. Check disk I/O performance: `docker run --rm alpine dd if=/dev/zero of=/dev/null bs=1M count=100`
5. Consider using a Linux VM or WSL2 for better performance

### Cache Not Working

1. Verify cache mount paths are correct
2. Check if `sharing=locked` is set
3. Try `--no-cache` once to clear stale cache
4. Check BuildKit cache: `docker builder prune`

### Filesystem Issues on macOS

Docker Desktop on macOS has known filesystem performance issues. Consider:
- Using Docker Desktop's experimental file sharing optimizations
- Building on a remote Docker host
- Using a pre-build strategy (Option 1)
