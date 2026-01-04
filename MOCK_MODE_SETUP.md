# Mock Mode Implementation Summary

## Overview
A mock run profile has been created for StewardSync to allow UI testing without setting up Convex backend.

## Files Created

### Core Mock Files
1. **`.env.mock`** - Environment configuration for mock mode
   - Sets `NEXT_PUBLIC_MOCK_MODE=true`
   - Provides mock Convex URL

2. **`src/lib/mock-data.ts`** - Hardcoded mock data
   - 3 users (Admin, Steward, Driver)
   - 3 roles
   - 5 drivers
   - 3 events
   - 3 races
   - 3 reports
   - 2 reviews
   - Helper functions for data retrieval

3. **`src/lib/mock-convex.tsx`** - Mock Convex client and provider
   - `MockConvexReactClient` class
   - `MockConvexProvider` component
   - Mock hooks (`useMockQuery`, `useMockMutation`)

4. **`src/lib/mock-api.ts`** - Mock API structure
   - Mimics Convex's generated API
   - All queries return mock data
   - All mutations log to console

5. **`src/hooks/use-auth-mock.ts`** - Mock auth hook
   - Returns mock admin user
   - No loading state
   - Always authenticated

6. **`convex/_generated/api.ts`** - Stub API file
   - Prevents import errors when Convex isn't set up
   - Provides minimal API structure
   - Will be overwritten by Convex when running `npx convex dev`

### Supporting Files
7. **`src/lib/convex-client.ts`** - Conditional Convex client
8. **`src/hooks/use-auth-real.ts`** - Real Convex auth implementation
9. **`src/hooks/use-auth-real-impl.ts`** - Alternative real implementation
10. **`src/hooks/use-auth-conditional.ts`** - Conditional auth hook
11. **`src/lib/convex-wrapper.ts`** - Convex wrapper
12. **`src/lib/hooks-wrapper.ts`** - Hooks wrapper
13. **`convex/_generated/api-mock.ts`** - Mock API for generated folder
14. **`convex/_generated/api-wrapper.ts`** - API wrapper

### Documentation
15. **`MOCK_MODE.md`** - Comprehensive mock mode documentation
16. **`README.md`** - Updated with mock mode section

## Modified Files

1. **`src/app/layout.tsx`**
   - Conditionally uses `MockConvexProvider` or `ConvexProvider`
   - Checks `NEXT_PUBLIC_MOCK_MODE` environment variable

2. **`src/hooks/use-auth.ts`**
   - Returns mock user when in mock mode
   - Uses real Convex auth otherwise

3. **`package.json`**
   - Added `dev:mock` script: `cp .env.mock .env.local && next dev`

4. **`.gitignore`**
   - Added `.env.local` to prevent committing local env files

## How to Use

### Running in Mock Mode
```bash
npm run dev:mock
# or
bun run dev:mock
```

### Running with Real Convex
```bash
npm run dev
# or
bun run dev
```

## Current Status

### ✅ Completed
- Mock data infrastructure created
- Mock Convex client and provider implemented
- Mock auth hook created
- Layout updated for conditional provider
- Run script added to package.json
- Comprehensive documentation created
- Stub API file to prevent import errors

### ⚠️ Known Limitations

1. **Import Dependencies**: All files still import from `@/convex/_generated/api`, which means:
   - The stub API file is required even in mock mode
   - TypeScript may show warnings about the stub
   - When you run `npx convex dev`, it will overwrite the stub

2. **Hook Usage**: Pages using `useQuery` and `useMutation` will:
   - Still import from Convex
   - Work in mock mode but won't use mock data
   - Need to be updated to use mock hooks if desired

3. **Build Process**: The build will:
   - Compile successfully with the stub API
   - Work in mock mode
   - Require real Convex setup for production

## Recommended Next Steps

### Option 1: Minimal (Current State)
The current implementation works for basic UI testing:
- Auth works with mock user
- Layout switches between mock and real providers
- No Convex setup required for mock mode

### Option 2: Enhanced (Recommended)
For full mock functionality, update pages to use mock hooks:
1. Create wrapper hooks for `useQuery` and `useMutation`
2. Update all pages to use conditional hooks
3. Implement mock data mutations
4. Add local storage persistence

### Option 3: Production Ready
For production use:
1. Set up real Convex backend
2. Run `npx convex dev` to generate real API
3. Remove mock mode or make it development-only
4. Add proper error handling

## Testing the Setup

To verify mock mode works:

1. Run `npm run dev:mock`
2. Navigate to http://localhost:3000
3. Verify you're logged in as Admin User
4. Check browser console for any errors
5. Test navigation between pages

## Troubleshooting

### Import Errors
If you see "Cannot find module '@/convex/_generated/api'":
- Ensure `convex/_generated/api.ts` exists
- The stub file should be present
- Run `npx convex dev` to generate real API if needed

### Mock Mode Not Working
If mock mode doesn't activate:
- Check that `.env.local` exists and contains `NEXT_PUBLIC_MOCK_MODE=true`
- Restart the development server
- Verify the `dev:mock` script ran successfully

### TypeScript Errors
TypeScript may show warnings about the stub API:
- These are expected in mock mode
- Will be resolved when you run `npx convex dev`
- Can be suppressed with `// @ts-ignore` if needed

## File Structure

```
StewardSync/
├── .env.mock                    # Mock environment variables
├── MOCK_MODE.md                 # Mock mode documentation
├── MOCK_MODE_SETUP.md           # This file
├── package.json                # Updated with dev:mock script
├── src/
│   ├── app/
│   │   └── layout.tsx         # Updated for conditional provider
│   ├── hooks/
│   │   ├── use-auth.ts        # Updated for mock mode
│   │   ├── use-auth-mock.ts   # Mock auth hook
│   │   └── use-auth-real.ts   # Real auth hook
│   └── lib/
│       ├── mock-data.ts        # Hardcoded data
│       ├── mock-convex.tsx    # Mock client/provider
│       ├── mock-api.ts         # Mock API structure
│       └── convex-client.ts   # Conditional client
└── convex/
    └── _generated/
        └── api.ts            # Stub API file
```

## Conclusion

The mock mode infrastructure is in place and ready to use. The implementation provides:
- ✅ No Convex setup required for UI testing
- ✅ Hardcoded users and data
- ✅ Easy switching between mock and real modes
- ✅ Comprehensive documentation

The setup is functional for basic UI testing and can be enhanced as needed for more advanced mock scenarios.
