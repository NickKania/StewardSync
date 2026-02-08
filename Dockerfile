# Build stage - use Debian-based image for better performance
FROM oven/bun:1.2.21 AS builder

# Metadata labels (these will be overridden by buildx)
ARG BUILD_DATE
ARG VCS_REF
ARG VERSION

LABEL org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.version="${VERSION}"

WORKDIR /app

# Set NODE_ENV early for optimization
ENV NODE_ENV=production \
    NODE_OPTIONS=--max-old-space-size=4096 \
    NG_BUILD_MAX_WORKERS=1 \
    BUN_INSTALL_CACHE_DIR=/root/.bun/install/cache \
    BUN_INSTALL_GLOBAL_DIR=/root/.bun/install/global \
    CI=true \
    NG_CLI_ANALYTICS=false

# Copy lockfile first for better dependency caching
COPY bun.lock package.json ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy Angular configuration files (cached if unchanged)
COPY angular.json tsconfig.json tsconfig.app.json tailwind.config.js postcss.config.js ./

# Copy source files in layers for better caching
# Less frequently changed files first
COPY src/environments/ ./src/environments/
COPY src/assets/ ./src/assets/
COPY src/index.html src/main.ts ./src/
COPY src/styles.css ./src/

# More frequently changed files (features, components)
COPY src/app/ ./src/app/

# Build the Angular application with optimized settings
RUN bun run build --configuration=production --progress=false --verbose=false

# Production stage
FROM nginx:alpine

# Metadata labels (these will be overridden by buildx)
ARG BUILD_DATE
ARG VCS_REF
ARG VERSION

LABEL org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.title="StewardSync Frontend" \
      org.opencontainers.image.description="Angular frontend for StewardSync racing steward reports application"

RUN apk add --no-cache gettext

ENV PUBLIC_ENABLE_DEV_LOGIN=false

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built application from builder stage
COPY --from=builder /app/dist/steward-sync/browser /usr/share/nginx/html
COPY docker/frontend/runtime-config.template.js /usr/share/nginx/html/runtime-config.template.js
COPY docker/frontend/entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh

# Expose port 80
EXPOSE 80

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

# Start nginx with runtime config injection
ENTRYPOINT ["/entrypoint.sh"]
