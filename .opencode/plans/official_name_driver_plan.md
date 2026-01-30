# Plan: Add Official Name to Driver Object

## Requirements (Confirmed)
1. **User's officialName takes precedence** over driver officialName when linked
2. **Auto-generated "F. Name" format stored** in driver.officialName on creation/import
3. **Only event staff** (event_manager, league_manager) can edit official names
4. **Migration script** to seed existing drivers with officialName
5. **Driver detail page** for editing, auto-computed during import/creation

---

## Current State
- `officialName` exists on **User** objects (convex/schema.ts)
- Drivers link to Users via `driver.userId` 
- Display logic: `user.officialName ?? driver.driverName`
- Official names are editable by event managers and above

---

## Display Name Priority (Highest to Lowest)
1. **User's officialName** (if driver linked to user)
2. **Driver's officialName** (auto-generated or manually set)
3. **driverName** (raw imported name - fallback)

---

## Implementation Tasks

### Phase 1: Data Model Updates
1. **Update Convex Schema** (convex/schema.ts)
   - Add `officialName: v.optional(v.string())` to drivers table

2. **Update Driver Model** (src/app/core/models/driver.model.ts)
   - Add `officialName?: string` to Driver interface

### Phase 2: Backend Changes
1. **Create Name Formatting Helper** (convex/lib/formatting.ts)
   ```typescript
   formatDriverName(driverName: string): string
   // "John Smith" → "J. Smith"
   // "Jane Doe" → "J. Doe"
   ```

2. **Update Driver Import/Create Functions** (convex/drivers.ts)
   - Auto-compute officialName using formatDriverName() on driver creation
   - Import process: drivers.ts import functions
   - Creation: any createDriver mutation

3. **Update Driver Queries** (convex/drivers.ts)
   - `getById` - Return displayName field with priority logic
   - `getByIdWithUser` - Update to: `user?.officialName ?? driver.officialName`
   - `getAll` - Include computed displayName
   - Update all other driver queries to use displayName field

4. **Add Mutation for Editing Official Name** (convex/drivers.ts)
   ```typescript
   updateOfficialName
   args: { driverId: v.id("drivers"), officialName: v.string() }
   permission: event_manager, league_manager roles
   ```

5. **Update Statistics Functions** (convex/statistics.ts)
   - Update event rundown to use new display name priority

6. **Create Migration Script** (convex/seed.ts or convex/migrations.ts)
   - Query all drivers without officialName
   - Compute officialName using formatDriverName()
   - Batch update drivers

### Phase 3: Frontend Changes
1. **Create Shared Display Name Utility** (src/app/core/utils/driver.utils.ts)
   - `getDisplayName(driver, user?)` function for consistent logic

2. **Update Driver Detail Page** (src/app/features/drivers/driver-detail/)
   - Add editable official name field (event staff only)
   - Show current computed value

3. **Update Report Components** (use displayName throughout)
   - report-list.component.ts
   - report-detail.component.ts
   - dashboard.component.ts
   - review-dashboard.component.ts
   - finalize-dashboard.component.ts
   - finalize-form.component.ts
   - review-form.component.ts

### Phase 4: Migration
1. Run migration script to populate existing drivers
2. Verify all drivers have officialName set

---

## Auto-Generated Name Format Specification
```
Input: "John Smith"           → Output: "J. Smith"
Input: "Jane Doe"             → Output: "J. Doe"
Input: "Robert Johnson Jr"    → Output: "R. Johnson Jr"
Input: "María García López"   → Output: "M. García López"
Input: "A. B. Smith"          → Output: "A. Smith" (handle already abbreviated)
```

**Logic:**
1. Split by space
2. Take first letter of first word + ". " 
3. Append rest of string (words 2+)
4. Capitalize first character of result
5. Handle edge cases (single names, already formatted names)

---

## Files to Modify

### Schema & Backend
- `convex/schema.ts`
- `convex/drivers.ts`
- `convex/statistics.ts`
- `convex/seed.ts` (or new `convex/migrations.ts`)
- `convex/lib/formatting.ts` (create new)

### Frontend Models
- `src/app/core/models/driver.model.ts`
- `src/app/core/utils/driver.utils.ts` (create new)

### Frontend Components
- `src/app/features/drivers/driver-detail/driver-detail.component.ts`
- `src/app/features/reports/report-list/report-list.component.ts`
- `src/app/features/reports/report-detail/report-detail.component.ts`
- `src/app/features/dashboard/dashboard.component.ts`
- `src/app/features/reviews/review-dashboard/review-dashboard.component.ts`
- `src/app/features/finalize/finalize-dashboard/finalize-dashboard.component.ts`
- `src/app/features/finalize/finalize-form/finalize-form.component.ts`
- `src/app/features/reviews/review-form/review-form.component.ts`
