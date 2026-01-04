# StewardSync
The goal of this project is to provide a unified application for reviewing racing steward reports.

## Models
### Report
- ReportId (pk)
- ReportDate (auto_generated)
- ReportingDriver (fk Driver)
- ReportedDriver (fk Driver)
- Event (fk Event)
- Race (fk Race)
- Turn (string)
- Description (text)
- VideoUrl (text)
- Status (Enum: Pending, UnderReview, DecisionReached, Closed)

### Review
- ReviewId (pk)
- ReviewDate (auto_generated)
- UserId (fk User)
- ReviewedReport (fk Report)
- Analysis (text)
- Notes (text)

### Penalty
- PenaltyId (pk)
- ReportId (fk Report)
- PenaltyType (Enum: TimePenalty, GridPenalty, Disqualification, NoAction, Warning)
- PenaltyValue (int) - e.g., 5 seconds, 3 grid spots
- Reason (text)

### User
- UserId (pk)
- UserName (text)
- Role (fk Role)
- DriverId (fk Driver, nullable)

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
Reporting should be done via a report form that is hosted on the site. This should be available to all authenticated users (linked to a Driver). The form should include fields for:
- Driver being reported
- Event, Race, and Turn (or location)
- Incident Description
- **Video Evidence Link** (Required)

The system should automatically associate the report with the logged-in driver (ReportingDriver).

## Reviewing
Reviewing should be done via a review dashboard available to Stewards.
- Stewards can view the report details and watch the linked video.
- Stewards can submit a **Review** containing their analysis of the incident.
- Multiple stewards can review a single report.

## Finalizing (Decision Making)
Finalizing is the process of applying a verdict and penalty.
- Available to Head Stewards.
- The Head Steward reviews the Report and Steward Reviews.
- A **Penalty** record is created if applicable (e.g., 5s Time Penalty to Driver A).
- The Report Status is updated to `DecisionReached` or `Closed`.
