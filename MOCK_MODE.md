# Mock Mode for StewardSync

This document explains how to use the mock mode for testing the StewardSync UI without setting up a Convex backend.

## Overview

Mock mode allows you to run the StewardSync application with hardcoded data, eliminating the need to:
- Set up a Convex backend
- Configure authentication providers
- Seed initial data

This is perfect for:
- UI/UX testing
- Development without backend dependencies
- Demonstrations
- Quick prototyping

## How to Use Mock Mode

### Running with Mock Mode

Simply run the following command:

```bash
npm run dev:mock
```

This command:
1. Copies the `.env.mock` file to `.env.local`
2. Starts the Next.js development server with mock mode enabled

### What's Included in Mock Mode

#### Hardcoded Users

Mock mode includes three predefined users:

1. **Admin User** (Default logged-in user)
   - Email: `admin@stewardsync.com`
   - Role: Admin
   - Full access to all features

2. **Steward User**
   - Email: `steward@stewardsync.com`
   - Role: Steward
   - Can review and finalize reports

3. **Driver User**
   - Email: `driver@stewardsync.com`
   - Role: Driver
   - Can submit reports

#### Mock Data

The following mock data is included:

- **3 Events**: British Grand Prix, Monaco Grand Prix, Italian Grand Prix
- **5 Drivers**: Including Hamilton, Verstappen, Leclerc, Norris, and Sainz
- **3 Races**: One per event
- **3 Reports**: With various statuses (Pending, Under Review, Finalized)
- **2 Reviews**: Sample reviews for reports

#### Mock API

All Convex queries and mutations are mocked:
- Queries return the hardcoded data
- Mutations log to console instead of persisting
- Authentication bypasses real auth and returns the admin user

## Switching Between Modes

### To use Mock Mode

```bash
npm run dev:mock
```

### To use Real Convex Backend

```bash
npm run dev
```

Make sure you have:
1. A valid `NEXT_PUBLIC_CONVEX_URL` in your `.env.local`
2. Convex development server running (`npm run convex`)

## Customizing Mock Data

You can modify the mock data by editing [`src/lib/mock-data.ts`](src/lib/mock-data.ts):

```typescript
export const mockUsers = [
  // Add or modify users here
];

export const mockDrivers = [
  // Add or modify drivers here
];

export const mockReports = [
  // Add or modify reports here
];
```

## How It Works

### Environment Variable

The mock mode is controlled by the `NEXT_PUBLIC_MOCK_MODE` environment variable:

```env
NEXT_PUBLIC_MOCK_MODE=true
```

### Conditional Logic

The application checks this variable in several places:

1. **Layout** ([`src/app/layout.tsx`](src/app/layout.tsx))
   - Uses `MockConvexProvider` when mock mode is enabled
   - Uses `ConvexProvider` for real Convex

2. **Auth Hook** ([`src/hooks/use-auth.ts`](src/hooks/use-auth.ts))
   - Returns mock admin user when mock mode is enabled
   - Uses real Convex auth otherwise

3. **Mock Provider** ([`src/lib/mock-convex.tsx`](src/lib/mock-convex.tsx))
   - Provides mock implementations of Convex client
   - Simulates Convex API structure

## Limitations

- Data is not persisted (changes are lost on refresh)
- Mutations only log to console
- No real authentication
- Limited to the hardcoded data set

## Files Created for Mock Mode

- [`.env.mock`](.env.mock) - Environment variables for mock mode
- [`src/lib/mock-data.ts`](src/lib/mock-data.ts) - Hardcoded data
- [`src/lib/mock-api.ts`](src/lib/mock-api.ts) - Mock API structure
- [`src/lib/mock-convex.tsx`](src/lib/mock-convex.tsx) - Mock Convex client and provider
- [`src/hooks/use-auth-mock.ts`](src/hooks/use-auth-mock.ts) - Mock auth hook

## Troubleshooting

### Mock mode not working

1. Ensure you're running `npm run dev:mock` not `npm run dev`
2. Check that `.env.local` exists and contains `NEXT_PUBLIC_MOCK_MODE=true`
3. Restart the development server after making changes

### Data not appearing

1. Check the browser console for errors
2. Verify that the mock data files are correctly formatted
3. Ensure the environment variable is set correctly

## Future Enhancements

Potential improvements to mock mode:

- Add ability to switch users dynamically
- Implement local storage persistence
- Add more comprehensive mock data
- Create a mock admin panel for managing mock data
- Add support for file upload mocking
