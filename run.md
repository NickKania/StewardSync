# Running StewardSync

## Development Modes

StewardSync supports two development modes:

1. **Cloud Mode** - Uses Convex Cloud (default)
2. **Local Mode** - Uses self-hosted convex-backend via Docker

---

## Cloud Development (Default)

Uses Convex Cloud for the backend.

```bash
# Install dependencies
npm install

# Run both Convex dev server and Angular
npm run dev
```

---

## Local Development

Uses a local [convex-backend](https://github.com/get-convex/convex-backend) instance for offline development and testing.

### Prerequisites

- Docker and Docker Compose installed
- Node.js and npm

### First-Time Setup

1. **Start the local Convex backend:**

   ```bash
   npm run convex:local:start
   ```

2. **Generate an admin key:**

   ```bash
   docker compose -f docker-compose.local.yml exec backend ./generate_admin_key.sh
   ```

3. **Save the admin key to `.env.local`:**

   ```bash
   CONVEX_SELF_HOSTED_ADMIN_KEY='<your generated key>'
   ```

4. **Push Convex functions to local backend:**

   ```bash
   npm run convex:local:push
   ```

5. **Seed initial data (optional):**

   ```bash
   CONVEX_SELF_HOSTED_URL=http://127.0.0.1:3210 npx convex run seed:seedRoles --admin-key $CONVEX_SELF_HOSTED_ADMIN_KEY
   CONVEX_SELF_HOSTED_URL=http://127.0.0.1:3210 npx convex run seed:seedSampleData --admin-key $CONVEX_SELF_HOSTED_ADMIN_KEY
   ```

### Running Locally

```bash
# Run everything together (Docker backend + Angular app)
npm run dev:local
```

Or run separately:

```bash
# Terminal 1: Start backend
npm run convex:local:start

# Terminal 2: Start Angular with local config
npm run start:local
```

### Local URLs

| Service | URL |
|---------|-----|
| Angular App | http://localhost:4200 |
| Convex Dashboard | http://localhost:6791 |
| Convex Backend API | http://127.0.0.1:3210 |
| HTTP Actions | http://127.0.0.1:3211 |

### Local Backend Management

```bash
# Start backend (detached)
npm run convex:local:start

# Stop backend
npm run convex:local:stop

# View logs
npm run convex:local:logs

# Push function changes
npm run convex:local:push
```

---

## All Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Cloud: Run Convex dev + Angular |
| `npm run dev:local` | Local: Run Docker backend + Angular |
| `npm run start` | Angular dev server only |
| `npm run start:local` | Angular with local backend config |
| `npm run build` | Production build |
| `npm run build:local` | Build for local backend |
| `npm run convex:dev` | Convex Cloud dev server |
| `npm run convex:deploy` | Deploy to Convex Cloud |
| `npm run convex:local:start` | Start local Docker backend |
| `npm run convex:local:stop` | Stop local Docker backend |
| `npm run convex:local:logs` | View local backend logs |
| `npm run convex:local:push` | Push functions to local backend |

---

## Environment Files

| File | Purpose |
|------|---------|
| `src/environments/environment.ts` | Default dev config (cloud) |
| `src/environments/environment.local.ts` | Local backend config |
| `src/environments/environment.prod.ts` | Production config |
| `.env.local` | Secrets (gitignored) |

---

## Troubleshooting

### Backend won't start

Check if ports are already in use:

```bash
lsof -i :3210
lsof -i :3211
lsof -i :6791
```

### Functions not updating

Re-push functions after changes:

```bash
npm run convex:local:push
```

### Reset local data

```bash
npm run convex:local:stop
docker volume rm stewardsync_convex_data
npm run convex:local:start
```
