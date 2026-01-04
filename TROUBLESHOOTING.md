# Troubleshooting Mock Mode Import Errors

## Problem
You're seeing errors like:
```
Cannot find module '@/convex/_generated/api'
```

## Root Cause
The application is importing from `@/convex/_generated/api` which doesn't exist until you run `npx convex dev` to generate the real Convex API.

## Solutions

### Solution 1: Use the Stub File (Recommended for Mock Mode)

The stub file [`convex/_generated/api.ts`](convex/_generated/api.ts) has been created to prevent these errors. It contains all necessary API functions.

**Verify the stub file exists:**
```bash
ls convex/_generated/api.ts
```

If it doesn't exist, it should have been created. The file contains:
- All auth functions (`getCurrentUser`, `getUserRole`)
- All query functions (`listReports`, `getReport`, `listReviews`, etc.)
- All mutation functions (`createReport`, `updateReport`, `finalizeReport`, etc.)

### Solution 2: Run Convex Dev (For Real Backend)

If you want to use the real Convex backend:

```bash
npx convex dev
```

This will:
1. Generate the real `convex/_generated/api.ts` file
2. Start the Convex development server
3. Allow you to use real authentication and data

**Note:** This will overwrite the stub file with the real generated API.

### Solution 3: Check TypeScript Configuration

Ensure your `tsconfig.json` has the correct path mappings:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@/convex/_generated/*": ["./convex/_generated/*"]
    }
  }
}
```

### Solution 4: Clear Next.js Cache

Sometimes Next.js caches old module resolutions:

```bash
rm -rf .next
# or on Windows
rmdir /s /q .next
```

Then restart the dev server:
```bash
npm run dev:mock
```

## Current Mock Mode Setup

### Files Created for Mock Mode

1. **Stub API**: [`convex/_generated/api.ts`](convex/_generated/api.ts)
   - Prevents import errors
   - Contains all necessary API functions
   - Will be overwritten by `npx convex dev`

2. **Mock Data**: [`src/lib/mock-data.ts`](src/lib/mock-data.ts)
   - Hardcoded users, drivers, events, races, reports, reviews

3. **Mock Provider**: [`src/lib/mock-convex.tsx`](src/lib/mock-convex.tsx)
   - Mock Convex client and provider
   - Used by layout when `NEXT_PUBLIC_MOCK_MODE=true`

4. **Mock Auth**: [`src/hooks/use-auth.ts`](src/hooks/use-auth.ts)
   - Returns mock admin user when in mock mode
   - Uses real Convex auth otherwise

5. **Environment**: [`.env.mock`](.env.mock)
   - Sets `NEXT_PUBLIC_MOCK_MODE=true`

### How It Works

1. **Layout** ([`src/app/layout.tsx`](src/app/layout.tsx)):
   ```typescript
   const isMockMode = process.env.NEXT_PUBLIC_MOCK_MODE === "true";
   
   // Uses MockConvexProvider when mock mode is enabled
   {isMockMode ? (
     <MockConvexProvider client={mockConvexClient}>
       {children}
     </MockConvexProvider>
   ) : (
     <ConvexProvider client={convex}>
       {children}
     </ConvexProvider>
   )}
   ```

2. **Auth Hook** ([`src/hooks/use-auth.ts`](src/hooks/use-auth.ts)):
   ```typescript
   if (isMockMode) {
     // Return mock admin user
     return { user: mockUsers[0], isLoading: false, isAuthenticated: true };
   }
   
   // Use real Convex auth
   const user = useQuery(api.auth.getCurrentUser);
   ```

3. **Stub API** ([`convex/_generated/api.ts`](convex/_generated/api.ts)):
   - Provides all API functions needed by pages
   - Returns null/empty arrays (prevents runtime errors)
   - Allows imports to succeed at build time

## Testing the Setup

### Step 1: Verify Files Exist
```bash
# Check stub API exists
ls convex/_generated/api.ts

# Check mock data exists
ls src/lib/mock-data.ts

# Check mock provider exists
ls src/lib/mock-convex.tsx
```

### Step 2: Run Mock Mode
```bash
npm run dev:mock
```

This copies `.env.mock` to `.env.local` and starts the server.

### Step 3: Check Environment
```bash
# Verify .env.local was created
cat .env.local

# Should contain:
# NEXT_PUBLIC_MOCK_MODE=true
```

### Step 4: Test in Browser
Navigate to http://localhost:3000 and verify:
- No import errors in console
- You're logged in as Admin User
- Dashboard loads with mock data

## Common Issues and Fixes

### Issue: "Cannot find module '@/convex/_generated/api'"

**Fix 1**: Verify stub file exists
```bash
cat convex/_generated/api.ts
```

**Fix 2**: Check TypeScript paths in `tsconfig.json`
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

**Fix 3**: Clear cache and rebuild
```bash
rm -rf .next node_modules
npm install
npm run dev:mock
```

### Issue: Mock mode not activating

**Fix 1**: Check `.env.local` exists
```bash
ls .env.local
```

**Fix 2**: Verify environment variable
```bash
cat .env.local | grep MOCK_MODE
# Should show: NEXT_PUBLIC_MOCK_MODE=true
```

**Fix 3**: Restart dev server
```bash
# Stop current server (Ctrl+C)
npm run dev:mock
```

### Issue: Pages still use real Convex

**Problem**: Pages import from `@/convex/_generated/api` directly, not using mock hooks.

**Current Behavior**: This is expected. The stub API allows imports to succeed, but the data comes from:
- Mock mode: [`src/hooks/use-auth.ts`](src/hooks/use-auth.ts) returns mock user
- Real mode: Uses actual Convex queries

**Future Enhancement**: To use mock data in queries/mutations, you would need to:
1. Update all pages to use wrapper hooks
2. Implement mock query/mutation logic
3. Add conditional imports based on mode

## Recommended Workflow

### For UI Development (Mock Mode)
```bash
npm run dev:mock
```
- No Convex setup needed
- Auth works with mock admin user
- Pages compile and load
- Queries return empty/null (stub behavior)

### For Full Development (Real Convex)
```bash
# Terminal 1: Start Convex
npx convex dev

# Terminal 2: Start Next.js
npm run dev
```
- Real authentication
- Real data persistence
- All features work as intended

## Summary

The mock mode implementation provides:
✅ **Compilation**: Stub API prevents import errors
✅ **Auth**: Mock auth hook returns admin user
✅ **Provider**: Mock Convex provider for layout
✅ **Data**: Hardcoded data available in [`src/lib/mock-data.ts`](src/lib/mock-data.ts)
✅ **Easy switching**: `dev:mock` vs `dev` scripts

**Current Limitation**: Pages still use real Convex hooks (`useQuery`, `useMutation`) which return empty/null from stub API. For full mock functionality, pages would need to be updated to use mock hooks.

## Next Steps

If you want to proceed with mock mode as-is:
1. Run `npm run dev:mock`
2. Test UI and navigation
3. Verify auth works with mock user
4. Accept that queries return empty data (stub behavior)

If you want full mock data functionality:
1. Update pages to use wrapper hooks from [`src/lib/convex-wrapper-hooks.ts`](src/lib/convex-wrapper-hooks.ts)
2. Implement mock query/mutation logic
3. Test with full mock data

If you want to use real Convex:
1. Run `npx convex dev` to generate real API
2. Run `npm run dev` (not `dev:mock`)
3. Set up authentication providers
4. Seed initial data with `npx convex seed`
