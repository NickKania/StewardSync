# Build stage
FROM oven/bun:1.2.21-alpine AS builder

WORKDIR /app

# Set NODE_ENV early for optimization
ENV NODE_ENV=production

# Copy lockfile first for better dependency caching
COPY bun.lock package.json ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy Angular configuration files (cached if unchanged)
COPY angular.json tsconfig.json tailwind.config.js postcss.config.js ./

# Copy source files in layers for better caching
# Less frequently changed files first
COPY src/environments/ ./src/environments/
COPY src/assets/ ./src/assets/
COPY src/index.html src/main.ts ./src/
COPY src/styles.css ./src/

# More frequently changed files (features, components)
COPY src/app/ ./src/app/

# Build the Angular application with parallel builds
RUN bun run build:docker

# Production stage
FROM nginx:alpine

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

# Start nginx with runtime config injection
ENTRYPOINT ["/entrypoint.sh"]
