# StewardSync

A unified application for reviewing racing steward reports.

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- A Convex account (free tier available)

### Installation

```bash
# Install dependencies
npm install

# Set up Convex (first time only)
npx convex dev
```

### Development

```bash
# Run both Angular and Convex dev servers
npm run dev

# Or run them separately:
npm run start        # Angular dev server
npm run convex:dev   # Convex dev server
```

The app will be available at `http://localhost:4200`

### Configuration

1. Copy environment template and configure:
   - Update `src/environments/environment.ts` with your Convex URL
   - Set up Google OAuth credentials if using Google sign-in

2. Seed initial data (optional):
   - Run `npx convex run seed:seedRoles` to create roles
   - Run `npx convex run seed:seedSampleData` to add sample drivers/events

## Technical Details
- **Frontend:** Angular 17+ (standalone components, signals)
- **Backend:** Convex (real-time BaaS)
- **Auth:** Google OAuth 2.0 + Demo mode
- **Styling:** Tailwind CSS
# Architectural Details
## Models
### Report
- ReportId (pk)
- ReportDate (auto_generated)
- ReportingDriver (fk Driver)
- ReportedDriver (fk Driver)
- Event (fk Event)
- Race (fk Race)
- Turn (int)
- Description (text)
- IsFinalized (boolean)
### Review
- ReviewId (pk)
- ReviewDate (auto_generated)
- UserId (fk User)
- ReviewedReport (fk Report)
- IncidentDescription (text)
- ReviewNotes (text)
### User
- UserId (pk)
- UserName (text)
- Role (fk Role)
### Role
- RoleId (pk)
- RoleName (text)
### Driver
- DriverId (pk)
- DriverNumber (int)
- DriverName (text)
- ExternalId (text)
- DriverClass (string)
### Event
- EventId (pk)
- Series
- EventNumber (int)
- TrackName (text)
- EventDate (date)
### Race
- RaceId (pk)
- Event (fk Event)
- RaceNumber (int)

## Reporting
Reporting should be done via a report form that is hosted on the site. This should be available to all users, and should be accessible from the main menu. The form should include fields for the driver being reported, the driver reporting the incident, the event, the race, the turn, and the incident description. The form should also include a submit button that will save the report to the database.

## Reviewing
Reviewing should be done via a review form that is hosted on the site. This should be available to stewards and event managers only, and should be accessible from a link that will be displayed only for those roles that have access. The form should include fields for the steward reviewing the report, the report being reviewed, the incident description, and any additional notes. The incident information shaould also be displayed and able to be edited in the case that there are issues with the inital report. The form should also include a submit button that will save the review to the database.

## Finalizing
Finalizing should be done via a finalize form that is hosted on the site. This should be available to only head stewards and event managers, and should be accessible from the main menu. The form should include fields for the steward finalizing the report, the report being finalized, the incident description, and any additional notes from other stewards. The form should also include a submit button that will save the finalization to the database.
