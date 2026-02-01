# Agent Development Guidelines

## Essential Rules (STRICTLY FOLLOW THESE)

- **Use bun instead of npm for all commands**
- **Use node 20 through node version manager by running `nvm use 20`**
- **Do not run build commands** - I will tell you if there are build issues

---

## Project Overview

StewardSync is a unified application for reviewing racing steward reports. The application enables drivers to file incident reports, stewards to review them, and head stewards/event managers to finalize rulings.

### Technology Stack

- **Frontend:** Angular 17+ (standalone components, signals)
- **Backend:** Convex (real-time backend-as-a-service)
- **Authentication:** Convex Auth with Google OAuth 2.0
- **Styling:** Tailwind CSS 3.x
- **Package Manager:** bun
- **Node Version:** 20 (via nvm)

---

## Project Structure

```
StewardSync/
├── convex/              # Convex backend
│   ├── _generated/      # Auto-generated types
│   ├── schema.ts        # Database schema definition
│   ├── auth.ts          # Authentication configuration
│   ├── users.ts         # User queries/mutations
│   ├── drivers.ts       # Driver queries/mutations
│   ├── events.ts        # Event queries/mutations
│   ├── races.ts         # Race queries/mutations
│   ├── reports.ts       # Report queries/mutations
│   ├── reviews.ts       # Review queries/mutations
│   └── seed.ts          # Data seeding functions
├── src/
│   ├── app/
│   │   ├── core/        # Core services, guards, models
│   │   ├── shared/      # Reusable components, directives, pipes
│   │   ├── features/    # Feature modules (auth, reports, reviews, etc.)
│   │   └── layout/      # Layout components (header, sidebar, footer)
│   ├── environments/    # Environment configs (dev, prod)
│   ├── index.html
│   ├── main.ts
│   └── styles.css       # Global styles
├── angular.json         # Angular CLI configuration
├── tailwind.config.js   # Tailwind CSS configuration
├── tsconfig.json        # TypeScript configuration
└── package.json         # Dependencies and scripts
```

---

## Data Models

### Report
- **Fields:** reportingDriver, reportedDriver, event, race, turn, description, isFinalized
- **Status Flow:** Pending → Reviewed → Finalized
- **Access:** All users can create; Stewards can edit details during review

### Review
- **Fields:** userId, reportId, incidentDescription, reviewNotes
- **Purpose:** Links stewards to reports with their assessments
- **Access:** Steward, Head Steward, Event Manager only

### User
- **Fields:** userName, role
- **Roles:** Driver, Steward, Head Steward, Event Manager

### Driver
- **Fields:** driverNumber, driverName, externalId, driverClass

### Event & Race
- **Event:** series, eventNumber, trackName, eventDate
- **Race:** eventId, raceNumber (each event can have multiple races)

---

## Angular Development Guidelines

### Components
- Use **standalone components** exclusively (no NgModule)
- Implement **signals** for reactive state management
- Follow **one component per file** convention
- Keep components small and focused (single responsibility principle)
- Use proper TypeScript types for all inputs/outputs

```typescript
import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-feature-name',
  standalone: true,
  imports: [CommonModule],
  template: `...`,
  styles: ``,
})
export class FeatureNameComponent {
  // Use signals for inputs
  readonly data = input.required<T>();
  
  // Use outputs for events
  readonly action = output<void>();
}
```

### Services
- Use Angular dependency injection
- Separate business logic from component logic
- Use services for Convex API calls
- Implement proper error handling with try-catch
- Use the `inject()` function from Convex Angular integration

```typescript
import { Injectable } from '@angular/core';
import { InjectedConvexClient } from '@convex-dev/angular';

@Injectable({
  providedIn: 'root',
})
export class FeatureService {
  private readonly convex = inject(InjectedConvexClient);
  
  // Implementation
}
```

### Routing & Guards
- Use `AuthGuard` to protect authenticated routes
- Use `RoleGuard` for role-based access control
- Configure route guards in `app.routes.ts`
- Use lazy loading for feature modules

### TypeScript Best Practices
- Strict mode is enabled (enforced)
- Use interfaces for type definitions in `core/models/`
- Leverage generics where appropriate
- Avoid `any` type - use proper typing or `unknown` when necessary
- Use `readonly` modifier for inputs and immutable data

---

## Convex Backend Guidelines

### Schema Definition
- Define all tables in `convex/schema.ts`
- Use proper index configuration for frequently queried fields
- Define relationships using document references (`v.id("tableName")`) or string IDs
- Use Convex validators (`v.string()`, `v.number()`, `v.optional()`, etc.)

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  reports: defineTable({
    reportingDriver: v.id("drivers"),
    reportedDriver: v.id("drivers"),
    event: v.id("events"),
    race: v.id("races"),
    turn: v.number(),
    description: v.string(),
    isFinalized: v.boolean(),
  }).index("by_event", ["event"]),
});
```

### Queries & Mutations
- Place query functions in appropriate files (e.g., `reports.ts`, `users.ts`)
- Use Convex's type-safe API
- Implement proper validation in mutations
- Use runtime validators for all arguments
- Return proper TypeScript types

```typescript
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getReport = query({
  args: { id: v.id("reports") },
  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.id);
    return report;
  },
});

export const createReport = mutation({
  args: {
    reportingDriver: v.id("drivers"),
    reportedDriver: v.id("drivers"),
    event: v.id("events"),
    race: v.id("races"),
    turn: v.number(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const newReportId = await ctx.db.insert("reports", {
      ...args,
      isFinalized: false,
    });
    return newReportId;
  },
});
```

### Authentication
- Use Convex Auth for authentication
- Handle user creation on first login
- Store user role information in the users table
- Implement proper permission checks in backend functions using `auth.getUserId()`

---

## Tailwind CSS Guidelines

- Use **utility classes** exclusively (avoid custom CSS unless necessary)
- Configure custom theme colors in `tailwind.config.js` (racing theme)
- Follow mobile-first responsive design approach
- Use consistent spacing and typography scales
- Avoid `!important` unless absolutely necessary

---

## Coding Standards

### Naming Conventions
- **Files:** kebab-case (e.g., `report-form.component.ts`)
- **Components:** PascalCase with `.component` suffix (e.g., `ReportFormComponent`)
- **Services:** PascalCase with `.service` suffix (e.g., `AuthService`)
- **Variables/Functions:** camelCase
- **Constants:** UPPER_SNAKE_CASE
- **Interfaces:** PascalCase (e.g., `Report`, not `IReport`)
- **Directives:** PascalCase with `.directive` suffix (e.g., `HasRoleDirective`)

### Code Organization
- Group imports in this order: Angular libraries, external libraries, internal imports
- Place imports at the top, followed by component metadata
- Keep methods in logical order (lifecycle, public, private)
- Add JSDoc comments for complex functions
- Keep files under 300 lines when possible

### Error Handling
- Implement try-catch blocks for async operations
- Use toasts for user-facing error messages
- Log errors to console for debugging
- Provide meaningful error messages
- Return user-friendly messages from Convex functions

---

## Role-Based Access Control

### Driver
- Can submit incident reports
- Can view their own reports
- Cannot access review or finalization features

### Steward
- Can view all reports
- Can submit reviews
- Can edit incident descriptions during review
- Cannot finalize reports

### Head Steward / Event Manager
- Can perform all steward actions
- Can finalize reports
- Can manage users and assign roles
- Full administrative access

---

## Common Development Commands

### Starting Development
```bash
# Use Node 20
nvm use 20

# Install dependencies
bun install

# Start both Angular and Convex dev servers
bun run dev

# Start Angular only (http://localhost:4200)
bun run start

# Start Angular with local configuration
bun run start:local
```

### Convex Operations
```bash
# Start local Convex with Docker
bun run convex:local:start

# Stop local Convex
bun run convex:local:stop

# View logs
bun run convex:local:logs

# Push schema/functions to local instance
bun run convex:local:push

# Deploy to production
bun run convex:deploy
```

### Testing
```bash
# Run unit tests
bun test

# Run tests in watch mode
bun test --watch

# Run tests with coverage
bun test --code-coverage
```

---

## File Creation Templates

### New Component Template
```typescript
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-feature-name',
  standalone: true,
  imports: [CommonModule],
  template: `...`,
  styles: ``,
})
export class FeatureNameComponent {
  // Implementation
}
```

### New Service Template
```typescript
import { Injectable } from '@angular/core';
import { InjectedConvexClient } from '@convex-dev/angular';

@Injectable({
  providedIn: 'root',
})
export class FeatureService {
  private readonly convex = inject(InjectedConvexClient);
  
  // Implementation
}
```

### New Convex Query Template
```typescript
import { query } from './_generated/server';
import { v } from 'convex/values';

export const getFeatureData = query({
  args: { id: v.id("tableName") },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.id);
    return item;
  },
});
```

### New Convex Mutation Template
```typescript
import { mutation } from './_generated/server';
import { v } from 'convex/values';

export const createFeature = mutation({
  args: {
    name: v.string(),
    // Add other fields
  },
  handler: async (ctx, args) => {
    const newId = await ctx.db.insert("tableName", args);
    return newId;
  },
});
```

---

## Best Practices

### Performance
- Use Convex real-time subscriptions efficiently
- Implement pagination for large datasets
- Optimize queries with proper indexes
- Use lazy loading for Angular routes
- Avoid unnecessary re-renders with proper change detection

### Security
- Never expose sensitive data in client-side code
- Validate all inputs on both client and server
- Implement proper authentication checks in Convex functions
- Use environment variables for configuration
- Never commit API keys or secrets

### Accessibility
- Add ARIA labels to interactive elements
- Ensure keyboard navigation support
- Test with screen readers
- Maintain proper color contrast ratios (WCAG 2.1 AA)
- Use semantic HTML elements

### Internationalization
- Store all dates in UTC
- Display dates in user's local timezone
- Use date-fns for date formatting
- Consider future i18n support in design

---

## Important Considerations

### When Making Schema Changes
- After modifying schema, run `bun run convex:local:push` to` update
- Check Convex dashboard for any schema validation errors
- Consider data migration if breaking changes are made

### When Working with Authentication
- Check that Convex Auth is properly configured in `convex/auth.ts`
- Ensure user creation is handled in auth flow
- Test role-based access control thoroughly

### When Implementing Features
- Start with Convex schema and functions, then build UI
- Write queries first, then mutations
- Test with different user roles
- Consider edge cases and error scenarios

---

## Troubleshooting

### Common Issues

#### Convex Schema Changes Not Reflecting
```bash
# Push schema changes
bun run convex:local:push
```

#### Authentication Issues
- Check that Convex Auth is properly configured
- Ensure user creation is handled in auth flow

#### Styling Issues
- Clear Tailwind cache: `rm -rf .angular/cache`
- Verify Tailwind config includes all necessary paths
- Check for CSS specificity conflicts

#### Development Server Issues
- Ensure Node 20 is active: `nvm use 20`
- Verify port 4200 is not in use
- Check that Docker is running for local Convex

#### Convex-Specific Debugging

**Working with Local Convex (Docker Setup)**

When working with the local Convex instance:

1. **Generate Admin Key** (if not already configured):
   ```bash
   docker compose -f docker-compose.local.yml exec backend ./generate_admin_key.sh
   # Copy the generated admin key
   ```

2. **Deploy Functions to Local Convex**:
   ```bash
   # Set environment variables
   CONVEX_SELF_HOSTED_URL=http://127.0.0.1:3210
   CONVEX_SELF_HOSTED_ADMIN_KEY='your-generated-key'

   # Deploy (without running dev server)
   bun x convex deploy

   # Or with specific environment
   CONVEX_SELF_HOSTED_URL=http://127.0.0.1:3210 \
     CONVEX_SELF_HOSTED_ADMIN_KEY='your-key' \
     bun x convex deploy
   ```

3. **Run Queries/Mutations via CLI**:
   ```bash
   # Query function
   CONVEX_SELF_HOSTED_URL=http://127.0.0.1:3210 \
     CONVEX_SELF_HOSTED_ADMIN_KEY='your-key' \
     bun x convex run tableName:functionName

   # Mutation with arguments (JSON)
   CONVEX_SELF_HOSTED_URL=http://127.0.0.1:3210 \
     CONVEX_SELF_HOSTED_ADMIN_KEY='your-key' \
     bun x convex run migrations:getMigrationStatus

   # Function with JSON args
   CONVEX_SELF_HOSTED_URL=http://127.0.0.1:3210 \
     CONVEX_SELF_HOSTED_ADMIN_KEY='your-key' \
     bun x convex run seriesPenaltyThresholds:getById '{"id":"kh7djwzs4hz1tfgfbbgabtrxqh7zc8x0"}'
   ```

4. **Check Convex Data**:
   ```bash
   # View all records in a table
   CONVEX_SELF_HOSTED_URL=http://127.0.0.1:3210 \
     CONVEX_SELF_HOSTED_ADMIN_KEY='your-key' \
     bun x convex data tableName

   # Example: check driver series penalties
   bun x convex data driverSeriesPenalties

   # Example: check thresholds
   bun x convex data seriesPenaltyThresholds
   ```

5. **List Available Functions**:
   ```bash
   bun x convex run migrations:getMigrationStatus 2>&1 | grep "•"
   # Shows all available functions if an invalid function name is used
   ```

**Debugging Data Integrity Issues**

When investigating Convex data issues:

1. **Check Schema vs Data**:
   - Verify schema in `convex/schema.ts` matches data structure
   - Use `bun x convex data tableName` to inspect actual data
   - Look for missing fields or incorrect types

2. **Identify Orphaned Records**:
   - Query for records and check if referenced IDs exist
   - Example: If penalties reference thresholds that don't exist
   - Create cleanup mutation to remove orphaned records

3. **Test Functions Step by Step**:
   - Run queries via CLI to verify data retrieval
   - Run mutations via CLI to test data creation
   - Check function returns match expected TypeScript types

4. **Migration Debugging**:
   - Run `migrations:getMigrationStatus` to see what needs migration
   - Run migrations incrementally, checking results after each step
   - Verify migration completed successfully before proceeding

5. **Common Convex CLI Commands**:
   ```bash
   # Deploy code only (no dev server)
   bun x convex deploy

   # List data from table
   bun x convex data tableName

   # Run query/mutation
   bun x convex run fileName:functionName [args]

   # Check available functions (by running invalid function)
   bun x convex run invalidName

   # View logs
   bun run convex:local:logs
   ```

**Error Handling Pattern**:

When Convex functions fail:

1. Read the error message carefully - it often points to the exact issue
2. Check if function exists and path is correct (use `fileName:functionName` format)
3. Verify arguments are valid JSON format for mutations
4. Check data types match schema expectations
5. Use `bun x convex data tableName` to inspect current data state

---

## Additional Resources

- [Angular Documentation](https://angular.io/docs)
- [Convex Documentation](https://docs.convex.dev/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Project README](./README.md)
- [Implementation Plan](./plan.md)

---

## Notes for Agents

- Always read the full context before making changes
- Ask clarifying questions if requirements are ambiguous
- Test changes thoroughly before considering them complete
- Document any non-obvious decisions in comments
- Keep the codebase clean and maintainable
- Follow the existing patterns in the codebase
- When in doubt, err on the side of clarity and simplicity
