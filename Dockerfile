# Build stage
FROM oven/bun:1.2.21-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build the Angular application
RUN bun run build

# Production stage
FROM nginx:alpine

RUN apk add --no-cache gettext

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
