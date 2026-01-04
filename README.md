#  StewardSync
The goal of this project is to provide a unified application for reviewing racing stweard reports.

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

## Mock Mode

StewardSync includes a mock mode for testing the UI without setting up a Convex backend. This is useful for:

- UI/UX development and testing
- Demonstrations
- Quick prototyping without backend dependencies

### Running in Mock Mode

```bash
npm run dev:mock
```

This will start the application with:
- Hardcoded users (Admin, Steward, Driver)
- Sample data (drivers, events, races, reports, reviews)
- Mock authentication (auto-logged in as admin)
- No Convex backend required

For more details, see [`MOCK_MODE.md`](MOCK_MODE.md).
