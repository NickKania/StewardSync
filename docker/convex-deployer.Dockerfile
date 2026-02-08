FROM oven/bun:1.2.21

# Metadata labels (these will be overridden by buildx)
ARG BUILD_DATE
ARG VCS_REF
ARG VERSION

LABEL org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.title="StewardSync Convex Deployer" \
      org.opencontainers.image.description="Convex function deployer for StewardSync"

WORKDIR /app

ENV NODE_ENV=production \
    BUN_INSTALL_CACHE_DIR=/root/.bun/install/cache \
    BUN_INSTALL_GLOBAL_DIR=/root/.bun/install/global

COPY package.json bun.lock tsconfig.json tsconfig.app.json ./

RUN --mount=type=cache,target=/root/.bun/install/cache,sharing=locked \
    --mount=type=cache,target=/root/.cache,sharing=locked \
    bun install --frozen-lockfile

COPY convex ./convex
COPY docker/convex-deployer.sh /usr/local/bin/convex-deployer.sh

RUN chmod +x /usr/local/bin/convex-deployer.sh

ENTRYPOINT ["/usr/local/bin/convex-deployer.sh"]
