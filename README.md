# StewardSync

A unified application for reviewing and reporting sim-racing incidents. Drivers file incident reports, stewards review them, and head stewards/event managers finalize rulings.

## Tech Stack

- **Frontend:** Angular 17+ (standalone components, signals)
- **Backend:** Convex (self-hosted or cloud)
- **Authentication:** Discord OAuth 2.0 (PKCE flow)
- **Styling:** Tailwind CSS 3.x
- **Package Manager:** bun

## Prerequisites

- [bun](https://bun.sh)
- Node.js 20 (via `nvm` or similar)

## Getting Started

### 1. Install dependencies

```bash
nvm use 20
bun install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set:
- `PUBLIC_CONVEX_URL` — Your Convex deployment URL (cloud or self-hosted)
- `PUBLIC_ENABLE_DEV_LOGIN` — Set to `true` for development, `false` for production
- `DISCORD_CLIENT_ID` — Discord application client ID
- `DISCORD_CLIENT_SECRET` — Discord application client secret

### 3. Set up Convex

**Option A: Convex Cloud (recommended for getting started)**

```bash
bun x convex dev
```

This will prompt you to create or link a Convex project.

**Option B: Self-hosted Convex**

Follow the [Convex self-hosting guide](https://docs.convex.dev/self-hosted) to set up your own backend.

### 4. Start development

```bash
bun run dev
```

This starts both the Convex dev server and Angular dev server concurrently.

- App: `http://localhost:4200`
- Convex Dashboard: Available via `bun x convex dashboard`

## Useful Commands

```bash
bun run dev              # Start Convex + Angular dev servers
bun run start            # Start Angular only
bun run start:local      # Start Angular with local Convex config
bun run build            # Production build
bun run test             # Run unit tests
bun run convex:deploy    # Deploy Convex functions
```

## Role-Based Access

| Role | Capabilities |
|------|-------------|
| **Driver** | Submit incident reports, view own reports |
| **Steward** | View all reports, submit reviews, edit incident descriptions |
| **Head Steward** | All steward actions + finalize reports |
| **Event Manager** | All head steward actions + manage series/events |
| **League Manager** | Full administrative access + user/role management |

## Project Structure

```
StewardSync/
├── convex/              # Convex backend
│   ├── schema.ts        # Database schema
│   ├── lib/             # Shared utilities (auth, audit, errors)
│   ├── reports.ts       # Report CRUD + finalization
│   ├── reviews.ts       # Review CRUD
│   └── ...              # Other domain modules
├── src/
│   └── app/
│       ├── core/        # Services, guards, models
│       ├── shared/      # Reusable UI components, directives, pipes
│       ├── features/    # Feature modules (auth, reports, reviews, etc.)
│       └── layout/      # Header, sidebar
├── scripts/             # Build and deployment scripts
└── docs/                # Documentation
```

## Deployment

### Vercel (Frontend)

See [docs/VERCEL_DEPLOYMENT.md](docs/VERCEL_DEPLOYMENT.md) for deploying the Angular frontend to Vercel.

### Convex (Backend)

Deploy to Convex Cloud:

```bash
bun run convex:deploy
```

Or self-host using the [Convex self-hosting documentation](https://docs.convex.dev/self-hosted).

## Contributing

Contributions are welcome! Please ensure you:

1. Follow the existing code patterns and conventions
2. Test your changes thoroughly
3. Keep files under 300 lines when possible

## License

[MIT](LICENSE)
