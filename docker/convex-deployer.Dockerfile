FROM oven/bun:1.2.21-alpine

WORKDIR /app

COPY package.json bun.lock tsconfig.json tsconfig.app.json ./
RUN bun install --frozen-lockfile

COPY convex ./convex
COPY docker/convex-deployer.sh /usr/local/bin/convex-deployer.sh

RUN chmod +x /usr/local/bin/convex-deployer.sh

ENTRYPOINT ["/usr/local/bin/convex-deployer.sh"]
