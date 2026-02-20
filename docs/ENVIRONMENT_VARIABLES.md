# Environment Variables

The StewardSync application now reads environment variables directly from the system instead of using hardcoded configuration files.

## How It Works

1. **Development Build (`build:local`)**: Reads from `.env` file in the project root
2. **Production Build (`build`)**: Reads from build-time environment variables
3. **Runtime**: Fallback to default values if server endpoint fails

## Environment Variables

### Required

- `PUBLIC_CONVEX_URL`: The URL of your Convex backend (e.g., `http://127.0.0.1:3210` or `https://your-project.convex.cloud`)

### Optional

- `PUBLIC_ENABLE_DEV_LOGIN`: Enable/disable the developer login page (`true`/`false`)
- `DISCORD_CLIENT_ID`: Discord OAuth 2.0 client ID
- `DISCORD_CLIENT_SECRET`: Discord OAuth 2.0 client secret
- `DISCORD_BOT_TOKEN`: Discord bot token used for race ban review meeting notifications
- `DISCORD_RACE_REVIEW_CHANNEL_ID`: Parent Discord **text channel** ID used to create private meeting threads

## Using with Docker

The application automatically injects environment variables when running in Docker containers:

```bash
# Copy the docker example file
cp .env.docker.example .env.docker

# Set your variables
export CONVEX_INSTANCE_SECRET=$(openssl rand -hex 32)
export PUBLIC_CONVEX_URL=http://localhost:3210
export PUBLIC_ENABLE_DEV_LOGIN=false
```

## Local Development

Create a `.env` file in the project root:

```bash
PUBLIC_CONVEX_URL=http://127.0.0.1:3210
PUBLIC_ENABLE_DEV_LOGIN=true
DISCORD_CLIENT_ID=your-discord-client-id
DISCORD_CLIENT_SECRET=your-discord-client-secret
DISCORD_BOT_TOKEN=your-discord-bot-token
DISCORD_RACE_REVIEW_CHANNEL_ID=your-discord-text-channel-id
```

`DISCORD_RACE_REVIEW_CHANNEL_ID` must point to a guild text channel that allows private thread creation. Forum channels are not supported for race ban review notifications.

## Angular Build Configurations

The application supports three build configurations:

### Development (default)
- Uses `environment.ts` with development defaults
- Enables dev login
- Local Convex URL

### Production
- Uses `environment.prod.ts`
- Disables dev login
- Production Convex URL

### Local
- Uses `environment.local.ts`
- Local Convex URL
- Developer Discord credentials

## Runtime Configuration

The application uses a hybrid approach:

1. **Server Endpoint**: On build, the application reads environment variables at build time
2. **Runtime Fallback**: If the server endpoint fails, it uses default values
3. **Server Endpoint**: If running in production, can provide runtime config via `/runtime-config` endpoint

## Troubleshooting

### Build errors related to environment variables

1. Ensure all required variables are set in your `.env` file
2. Check that the file is in the project root (not in src/)
3. Verify the variable names match exactly (case-sensitive)

### Runtime configuration not loading

1. Check browser console for errors
2. Verify the `/runtime-config` endpoint is accessible
3. Check that environment variables are set correctly in your environment

## Security Notes

- Never commit `.env` files to version control
- Use `.env.example` or `.env.docker.example` as templates
- Keep `DISCORD_CLIENT_SECRET` secure
- Keep `DISCORD_BOT_TOKEN` secure
- Rotate secrets regularly
