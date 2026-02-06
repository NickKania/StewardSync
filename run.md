# Running StewardSync

## Docker-First Workflow (Self-Contained)

1. Copy environment template:
   ```bash
   cp .env.docker.example .env
   ```
2. Generate and set `CONVEX_INSTANCE_SECRET`:
   ```bash
   openssl rand -hex 32
   ```
3. Start full stack:
   ```bash
   docker compose up -d --build
   ```
4. Confirm startup:
   ```bash
   docker compose ps
   docker compose logs --tail=200 convex-keygen convex-deployer backend frontend
   ```

What is automatic:

- Convex backend starts.
- Admin key is generated in `convex-keygen`.
- Convex functions are deployed in `convex-deployer`.
- Frontend receives runtime `PUBLIC_CONVEX_URL` and starts with linked backend URL.

## URLs

- Frontend: `http://localhost:4200`
- Convex API: `http://127.0.0.1:3210`
- Convex Actions: `http://127.0.0.1:3211`
- Convex Dashboard: `http://localhost:6791`

## Admin Key Retrieval

```bash
docker compose exec backend ./generate_admin_key.sh
```

or

```bash
docker compose run --rm --entrypoint /bin/sh convex-keygen -ceu 'cat /convex/shared/admin_key'
```

## Bun Scripts

```bash
bun run docker:up:build
bun run docker:logs
bun run docker:down
bun run convex:local:admin-key
```

## Non-Docker Local Dev

```bash
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && nvm use 20
bun install
bun run dev
```
