# StewardSync - Getting Started Guide

This guide will help you set up and run the StewardSync application on your local machine.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Bun** (v1.3.0 or higher) - [Install Bun](https://bun.sh)
- **Node.js** (optional, but recommended for some tools) - [Download Node.js](https://nodejs.org)
- **Git** - [Install Git](https://git-scm.com)
- **A Convex account** - [Sign up for free](https://www.convex.dev)

## Initial Setup

### 1. Clone and Install Dependencies

```bash
# Install dependencies using Bun
bun install
```

### 2. Set Up Convex

First, create a free Convex account at [https://www.convex.dev](https://www.convex.dev).

Then, initialize your Convex project:

```bash
# Login to Convex
npx convex dev

# This will open your browser to authenticate and create a new project
```

Follow the prompts to create your Convex project. Once complete, you'll see a Convex deployment URL.

### 3. Configure Environment Variables

Copy the `.env.example` file to `.env`:

```bash
cp .env.example .env
```

Update the `.env` file with your Convex deployment URL:

```env
NEXT_PUBLIC_CONVEX_URL=your-convex-deployment-url-here
```

For OAuth authentication, you'll need to set up OAuth providers:

#### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select an existing one
3. Navigate to APIs & Services > Credentials
4. Create OAuth 2.0 Client ID credentials
5. Add your Convex deployment URL as an authorized redirect URI
6. Copy the Client ID to your `.env` file:

```env
GOOGLE_CLIENT_ID=your-google-client-id-here
```

#### GitHub OAuth Setup

1. Go to GitHub Settings > Developer settings > OAuth Apps
2. Click "New OAuth App"
3. Fill in the application details:
   - Application name: StewardSync
   - Homepage URL: Your Convex deployment URL
   - Authorization callback URL: Your Convex deployment URL
4. Copy the Client ID to your `.env` file:

```env
GITHUB_CLIENT_ID=your-github-client-id-here
```

### 4. Seed Initial Data

Once Convex is set up, run the seed script to populate your database with initial data:

```bash
# This will create default roles, sample drivers, events, and races
npx convex run seed
```

### 5. Start the Development Server

```bash
# Start Next.js development server with Bun
bun run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000)

## Application Features

### Authentication

The application supports OAuth authentication with:
- Google Sign In
- GitHub Sign In

When you first sign in, a user account will be automatically created with the "Driver" role.

### Role-Based Access Control

The application has five user roles with different permissions:

| Role | Can Report | Can Review | Can Finalize | Can Manage Data | Can Manage Users |
|-------|-------------|-------------|----------------|------------------|------------------|
| Driver | ✅ | ❌ | ❌ | ❌ | ❌ |
| Steward | ✅ | ✅ | ❌ | ❌ | ❌ |
| Head Steward | ✅ | ✅ | ✅ | ✅ | ❌ |
| Event Manager | ✅ | ✅ | ✅ | ✅ | ❌ |
| Admin | ✅ | ✅ | ✅ | ✅ | ✅ |

### Main Features

#### 1. Dashboard
- View statistics (total reports, pending reviews, finalized reports)
- See your current role
- Quick access to all features
- View recent reports

#### 2. Report Incidents
- Available to all authenticated users
- Select reporting driver and reported driver
- Choose event and race
- Specify turn number
- Provide detailed incident description

#### 3. Review Reports
- Available to Stewards, Head Stewards, Event Managers, and Admins
- View all pending (unfinalized) reports
- See original incident details
- Provide incident description and review notes
- View other stewards' reviews

#### 4. Finalize Reports
- Available to Head Stewards, Event Managers, and Admins
- Review all details before finalizing
- See all steward reviews
- Mark reports as complete (no further changes allowed)

#### 5. Manage Drivers
- Available to Head Stewards, Event Managers, and Admins
- Add new drivers with:
  - Driver number
  - Driver name
  - External ID
  - Driver class
- View all drivers in the system

#### 6. Manage Events
- Available to Head Stewards, Event Managers, and Admins
- Add new racing events with:
  - Series name
  - Event number
  - Track name
  - Event date
- Add races to events
- View all events in the system

#### 7. Manage Users (Admin Only)
- View all users in the system
- See user roles
- Edit user roles (future enhancement)

## Database Schema

The application uses Convex with the following tables:

### Tables
- **roles** - User roles (Driver, Steward, Head Steward, Event Manager, Admin)
- **users** - User accounts with role assignments
- **drivers** - Racing driver information
- **events** - Racing events
- **races** - Individual races within events
- **reports** - Incident reports
- **reviews** - Steward reviews of reports

## Development Workflow

### Making Changes

1. **Frontend Changes** (Next.js/React)
   - Edit files in `src/app/` for pages
   - Edit files in `src/components/` for components
   - Changes will hot-reload automatically

2. **Backend Changes** (Convex)
   - Edit files in `convex/functions/`
   - Edit `convex/schema.ts` for database changes
   - Changes will be automatically deployed to Convex dev

### Running Convex Development Server

The `bun run dev` command will:
1. Start the Next.js development server on port 3000
2. Start the Convex development server
3. Automatically sync your Convex functions to the cloud

### Viewing Convex Dashboard

Visit your Convex dashboard at [https://dashboard.convex.dev](https://dashboard.convex.dev) to:
- View your database
- Monitor function calls
- Check logs
- Manage your deployment

## Troubleshooting

### Convex Authentication Issues

If you see authentication errors:
1. Ensure your `NEXT_PUBLIC_CONVEX_URL` is correct
2. Check that you're logged into Convex with `npx convex dev`
3. Verify your OAuth client IDs are correct

### Database Seeding Issues

If seeding fails:
1. Ensure you've run `npx convex dev` at least once
2. Check that your Convex deployment is active
3. Review the error message for specific issues

### Build Errors

If you encounter TypeScript errors:
1. Run `npx convex dev` to generate type definitions
2. Restart your development server
3. Clear `.next` folder: `rm -rf .next`

### OAuth Callback Issues

If OAuth redirects fail:
1. Verify your redirect URIs in OAuth provider settings
2. Ensure they match your Convex deployment URL exactly
3. Check that your Convex deployment is accessible

## Production Deployment

### Deploying to Vercel

1. Push your code to GitHub
2. Import your project in Vercel
3. Add environment variables in Vercel:
   - `NEXT_PUBLIC_CONVEX_URL`
   - `GOOGLE_CLIENT_ID`
   - `GITHUB_CLIENT_ID`
4. Deploy!

### Deploying Convex to Production

```bash
# Deploy Convex functions to production
npx convex deploy
```

## Next Steps

After getting started:

1. **Explore the Application**: Sign in and explore all features
2. **Create Test Data**: Add drivers, events, and races
3. **Submit Reports**: Create test incident reports
4. **Review and Finalize**: Use steward and head steward roles to complete the workflow
5. **Customize**: Modify the UI and add features as needed

## Support

- **Convex Documentation**: [https://docs.convex.dev](https://docs.convex.dev)
- **Next.js Documentation**: [https://nextjs.org/docs](https://nextjs.org/docs)
- **Bun Documentation**: [https://bun.sh/docs](https://bun.sh/docs)
- **shadcn/ui**: [https://ui.shadcn.com](https://ui.shadcn.com)

## License

This project is provided as-is for educational and development purposes.
