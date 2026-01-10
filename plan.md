# StewardSync Implementation Plan

## Overview
StewardSync is a unified application for reviewing racing steward reports. This plan outlines the complete implementation strategy for building the application with Angular, Convex, Google OAuth, and Tailwind CSS.

---

## Technology Stack

### Core Technologies
- **Frontend Framework:** Angular 17+ (standalone components, signals)
- **Backend/Database:** Convex (real-time backend-as-a-service)
- **Authentication:** Convex Auth with Google OAuth 2.0
- **Styling:** Tailwind CSS 3.x
- **Build Tool:** Angular CLI with Vite

### Additional Technologies
- **Form Handling:** Angular Reactive Forms
- **State Management:** Angular Signals + Convex real-time subscriptions
- **Routing:** Angular Router with guards for role-based access
- **UI Components:** Headless UI or custom Tailwind components
- **Date Handling:** date-fns
- **Notifications:** ngx-toastr or custom toast component
- **Testing:** Jest + Angular Testing Library
- **E2E Testing:** Playwright

---

## Phase 1: Project Setup & Infrastructure

### 1.1 Initialize Angular Project
- Create new Angular project with standalone components
- Configure TypeScript strict mode
- Set up path aliases for clean imports
- Configure environment files for development/production

### 1.2 Install and Configure Tailwind CSS
- Install Tailwind CSS, PostCSS, and Autoprefixer
- Create tailwind.config.js with custom theme colors (racing theme)
- Set up base styles and custom utilities
- Configure purge settings for production builds

### 1.3 Set Up Convex Backend
- Initialize Convex project
- Configure Convex client in Angular
- Set up Convex provider/service for dependency injection
- Create convex/ directory structure for schema, functions, and queries

### 1.4 Configure Google OAuth
- Set up Google Cloud Console project
- Configure OAuth 2.0 credentials
- Implement Convex Auth with Google provider
- Create authentication service in Angular

---

## Phase 2: Database Schema & Convex Functions

### 2.1 Define Convex Schema
```typescript
// convex/schema.ts
- roles table
- users table (linked to auth, role reference)
- drivers table
- events table
- races table (event reference)
- reports table (all foreign keys as defined)
- reviews table (user and report references)
```

### 2.2 Seed Data Functions
- Create seed function for roles (Driver, Steward, Head Steward, Event Manager)
- Create seed function for sample drivers
- Create seed function for sample events and races

### 2.3 Query Functions
- `getUsers` - list all users with role information
- `getDrivers` - list all drivers
- `getEvents` - list all events with races
- `getRaces` - get races by event
- `getReports` - list reports with filters (by status, driver, event)
- `getReportById` - single report with full details
- `getReviews` - list reviews for a report
- `getReviewsByUser` - reviews by specific steward
- `getCurrentUser` - get authenticated user with role

### 2.4 Mutation Functions
- `createReport` - submit new incident report
- `updateReport` - edit report details
- `createReview` - submit steward review
- `updateReview` - edit review
- `finalizeReport` - mark report as finalized
- `createUser` - create user on first OAuth login
- `updateUserRole` - admin function to change roles

---

## Phase 3: Authentication & Authorization

### 3.1 Authentication Service
- Implement AuthService wrapping Convex Auth
- Handle Google OAuth flow (login, logout, token refresh)
- Store and manage user session state
- Implement auth state observable for components

### 3.2 User Management
- Auto-create user record on first login
- Default role assignment (Driver)
- Profile display component showing user info and role

### 3.3 Route Guards
- `AuthGuard` - require authentication
- `RoleGuard` - check specific role requirements
- Configure guard parameters for different role levels:
  - All authenticated: Report form
  - Steward+: Review access
  - Head Steward/Event Manager: Finalize access

### 3.4 Role-Based UI
- Create directive for conditional rendering by role
- Hide/show navigation items based on permissions
- Disable actions for unauthorized roles

---

## Phase 4: Core Angular Architecture

### 4.1 Application Structure
```
src/
├── app/
│   ├── core/
│   │   ├── services/
│   │   ├── guards/
│   │   ├── interceptors/
│   │   └── models/
│   ├── shared/
│   │   ├── components/
│   │   ├── directives/
│   │   └── pipes/
│   ├── features/
│   │   ├── auth/
│   │   ├── reports/
│   │   ├── reviews/
│   │   ├── drivers/
│   │   └── events/
│   └── layout/
│       ├── header/
│       ├── sidebar/
│       └── footer/
├── convex/
│   ├── schema.ts
│   ├── auth.ts
│   ├── reports.ts
│   ├── reviews.ts
│   ├── drivers.ts
│   └── events.ts
```

### 4.2 Shared Components
- Button component (primary, secondary, danger variants)
- Input component with validation display
- Select/dropdown component
- Card component for content containers
- Modal component for dialogs
- Table component with sorting/pagination
- Loading spinner/skeleton components
- Toast notification component
- Badge component for status display

### 4.3 Layout Components
- Main layout with responsive sidebar
- Header with user menu and notifications
- Navigation menu with role-based items
- Footer with app info

---

## Phase 5: Feature Implementation - Reporting

### 5.1 Report List Page
- Display all reports in sortable/filterable table
- Show report status (pending, reviewed, finalized)
- Filter by event, driver, date range, status
- Pagination for large datasets
- Quick actions (view, edit for own reports)

### 5.2 Report Form Component
- Driver selection dropdowns (reporting/reported driver)
- Event selection with cascading race dropdown
- Turn number input with validation
- Rich text description field
- Form validation with error messages
- Submit with loading state
- Success/error notifications

### 5.3 Report Detail View
- Display all report information
- Show associated reviews (if user has permission)
- Edit button (for report creator, before finalization)
- Review button (for stewards)
- Finalize button (for head stewards/event managers)

---

## Phase 6: Feature Implementation - Reviewing

### 6.1 Review Dashboard
- List of reports pending review
- Filter by event, date, assigned status
- Quick stats (pending, reviewed today, total)
- Steward workload distribution view

### 6.2 Review Form Component
- Display report details (read-only or editable based on permissions)
- Incident description field (can modify original if needed)
- Review notes text area
- Penalty recommendation dropdown (optional)
- Video timestamp field (optional)
- Submit review with validation

### 6.3 Review History
- List all reviews for a report
- Show reviewer, date, and notes
- Diff view for edited report details
- Timeline visualization of review process

---

## Phase 7: Feature Implementation - Finalizing

### 7.1 Finalization Dashboard
- List of fully reviewed reports ready for finalization
- Aggregate view of all steward reviews
- Priority sorting options
- Batch finalization support

### 7.2 Finalization Form
- Summary of all reviews
- Final incident determination
- Penalty decision (warning, time penalty, disqualification, etc.)
- Official notes field
- Publish/finalize button with confirmation
- Email notification trigger (optional)

### 7.3 Final Report View
- Public-facing finalized report display
- Official ruling with all details
- Print-friendly format
- Share link generation

---

## Phase 8: Additional Features

### 8.1 Driver Management
- Driver list with search
- Driver profile page
- Incident history per driver
- Statistics (reports filed, reports against)

### 8.2 Event Management
- Event list with calendar view
- Create/edit events (Event Manager only)
- Add races to events
- Event summary with all associated reports

### 8.3 User Administration
- User list (admin only)
- Role assignment interface
- Activity log per user
- Bulk role updates

### 8.4 Dashboard/Home Page
- Role-appropriate dashboard widgets
- Recent activity feed
- Quick action buttons
- Statistics overview

---

## Phase 9: UI/UX Polish

### 9.1 Responsive Design
- Mobile-first approach for all components
- Collapsible sidebar for mobile
- Touch-friendly form inputs
- Responsive tables (card view on mobile)

### 9.2 Accessibility
- ARIA labels on all interactive elements
- Keyboard navigation support
- Focus management for modals
- Color contrast compliance (WCAG 2.1 AA)
- Screen reader testing

### 9.3 Loading States
- Skeleton loaders for initial data fetch
- Button loading states
- Optimistic UI updates where appropriate
- Error boundaries with retry options

### 9.4 Theme
- Racing-inspired color palette
- Consistent spacing and typography
- Dark mode support (optional)
- Custom icons for racing concepts

---

## Phase 10: Testing & Quality Assurance

### 10.1 Unit Testing
- Service tests for all business logic
- Component tests with Angular Testing Library
- Convex function tests
- Minimum 80% code coverage target

### 10.2 Integration Testing
- Auth flow testing
- Form submission flows
- Role-based access verification
- Real-time subscription testing

### 10.3 E2E Testing
- Critical user journeys with Playwright
- Cross-browser testing
- Mobile viewport testing
- Performance benchmarks

### 10.4 Manual QA Checklist
- Role permission verification
- Form validation edge cases
- Error handling scenarios
- Browser compatibility

---

## Phase 11: Deployment & DevOps

### 11.1 CI/CD Pipeline
- GitHub Actions workflow
- Automated testing on PR
- Lint and format checks
- Build verification

### 11.2 Deployment
- Convex production deployment
- Angular app deployment (Vercel/Netlify recommended)
- Environment variable management
- Domain configuration

### 11.3 Monitoring
- Error tracking (Sentry integration)
- Analytics (optional)
- Convex dashboard monitoring
- Uptime monitoring

---

## Implementation Order Summary

1. **Week 1-2:** Project setup, Tailwind, Convex initialization, schema definition
2. **Week 3-4:** Authentication system, route guards, user management
3. **Week 5-6:** Core layout, shared components, navigation
4. **Week 7-8:** Reporting feature (list, form, detail view)
5. **Week 9-10:** Review feature (dashboard, form, history)
6. **Week 11-12:** Finalization feature (dashboard, form, final view)
7. **Week 13-14:** Additional features (drivers, events, admin)
8. **Week 15-16:** UI polish, responsive design, accessibility
9. **Week 17-18:** Testing, bug fixes, performance optimization
10. **Week 19-20:** Deployment, documentation, launch preparation

---

## File Structure Reference

```
StewardSync/
├── angular.json
├── package.json
├── tailwind.config.js
├── tsconfig.json
├── convex/
│   ├── _generated/
│   ├── schema.ts
│   ├── auth.config.ts
│   ├── users.ts
│   ├── drivers.ts
│   ├── events.ts
│   ├── races.ts
│   ├── reports.ts
│   └── reviews.ts
├── src/
│   ├── index.html
│   ├── main.ts
│   ├── styles.css
│   ├── environments/
│   │   ├── environment.ts
│   │   └── environment.prod.ts
│   └── app/
│       ├── app.component.ts
│       ├── app.config.ts
│       ├── app.routes.ts
│       ├── core/
│       │   ├── services/
│       │   │   ├── auth.service.ts
│       │   │   ├── convex.service.ts
│       │   │   ├── report.service.ts
│       │   │   ├── review.service.ts
│       │   │   └── toast.service.ts
│       │   ├── guards/
│       │   │   ├── auth.guard.ts
│       │   │   └── role.guard.ts
│       │   └── models/
│       │       ├── report.model.ts
│       │       ├── review.model.ts
│       │       ├── user.model.ts
│       │       └── event.model.ts
│       ├── shared/
│       │   ├── components/
│       │   │   ├── button/
│       │   │   ├── input/
│       │   │   ├── select/
│       │   │   ├── card/
│       │   │   ├── modal/
│       │   │   ├── table/
│       │   │   └── toast/
│       │   ├── directives/
│       │   │   └── has-role.directive.ts
│       │   └── pipes/
│       │       └── date-format.pipe.ts
│       ├── layout/
│       │   ├── main-layout/
│       │   ├── header/
│       │   ├── sidebar/
│       │   └── footer/
│       └── features/
│           ├── auth/
│           │   ├── login/
│           │   └── profile/
│           ├── dashboard/
│           ├── reports/
│           │   ├── report-list/
│           │   ├── report-form/
│           │   └── report-detail/
│           ├── reviews/
│           │   ├── review-dashboard/
│           │   ├── review-form/
│           │   └── review-history/
│           ├── finalize/
│           │   ├── finalize-dashboard/
│           │   └── finalize-form/
│           ├── drivers/
│           │   ├── driver-list/
│           │   └── driver-detail/
│           ├── events/
│           │   ├── event-list/
│           │   └── event-detail/
│           └── admin/
│               └── user-management/
└── README.md
```

---

## Notes

- Convex provides real-time subscriptions out of the box, eliminating need for WebSocket setup
- Angular standalone components reduce boilerplate and improve tree-shaking
- Tailwind CSS utility classes will be used exclusively (no custom CSS unless necessary)
- All dates stored in UTC, displayed in user's local timezone
- File uploads (video evidence) can be added as future enhancement using Convex file storage
