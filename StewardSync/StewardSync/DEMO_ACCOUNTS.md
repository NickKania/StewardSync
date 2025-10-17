# StewardSync Demo Accounts

This file contains the demo accounts for testing the StewardSync application.

## Access Information

**Application URL**: http://localhost:5001 (or the port where the application is running)

**Login URL**: http://localhost:5001/login

## Demo Accounts

All demo accounts use the same password: `password`

### Head Steward
- **Username**: `headsteward`
- **Password**: `password`
- **Role**: Head Steward
- **Permissions**: Full access - can report, review, and finalize incidents

### Steward
- **Username**: `steward1`
- **Password**: `password`
- **Role**: Steward
- **Permissions**: Can report and review incidents (cannot finalize)

### Event Manager
- **Username**: `eventmanager`
- **Password**: `password`
- **Role**: Event Manager
- **Permissions**: Full access - can report, review, and finalize incidents

### Driver
- **Username**: `driver1`
- **Password**: `password`
- **Role**: Driver
- **Permissions**: Can report incidents only

## Role-Based Access Control

- **Driver**: Can access Report Incident form and View Reports
- **Steward**: Can access Report Incident, Review Report, and View Reports
- **Head Steward**: Can access all features including Finalize Report
- **Event Manager**: Can access all features including Finalize Report

## Testing Workflow

1. **Testing Incident Reporting**:
   - Login as any user (e.g., `driver1`)
   - Navigate to "Report Incident" from the menu
   - Fill out the form and submit

2. **Testing Review Process**:
   - Login as `steward1` or `headsteward`
   - Navigate to "Review Report" from the menu
   - Select an unfinalized report and submit a review

3. **Testing Finalization**:
   - Login as `headsteward` or `eventmanager`
   - Navigate to "Finalize Report" from the menu
   - Select a report with reviews and finalize it

4. **Testing View Reports**:
   - Login as any user
   - Navigate to "View Reports" from the menu
   - Use filters to see all, unfinalized, or finalized reports

## Notes

- The authentication system is a demo implementation for testing purposes
- In production, replace with proper authentication (ASP.NET Core Identity, JWT, etc.)
- All demo users are created with basic roles for testing the workflow
- The database will be automatically created with sample data on first run