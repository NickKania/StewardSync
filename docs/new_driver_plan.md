# Drivers 2.0
A driver should be thought of as a "series driver" where in, it is simply a means to tie a "user" to a "series".


## Schema updates
### Add table to map steam ids to a user (steamUserMapping)
- steamId: string
- userId: fk<users>
- isBanned: bool
- note: string
### Add License Points field
The way that license points are handled should be changed from the current approach of caluclating them based on applied penalties where the driver is "at-fault".

When a report is finalized, the mutation should update the driver's accumulated license points

### Block certain driver updates
When running the `importFromSimgrid()` method, certain fields should not be changed automatically.

- Firstoff, no driver should EVER be deleted. Even if they are no longer showing up in the SimGrid response, they should remain on our side. There should be a isActive flag on the driver record to denote that a driver is no longer showing up in the simgrid response (they have withdrawn from the series)

- Driver class should not be changed by the import job. This should only be done manually via the UI.

## UI Changes
- Event admins and managers should be able to edit the split that the driver class that the driver is in.
  - As a part of that movement, they should be asked whether they want to adjust the drivers license points
### `driver-list-component`
- If no series is selected, it should aggregate drivers based on their associated userId
  - When going to the `driver-detail-component` it should show an overall profile, which will contain
    - Discord username (drivers.username)
  - As well as a series specific profile for each series that they are in (using the series dropdown. Should show the two most recent series by default) which will contain
    - car number
    - driver class (should have an option to edit)
    - license points accrued (should have an option to edit)
    - list of all series penalties, with links to view the report details in `report-detail-component`
- If, when in the `driver-list-component` a series is selected, then we should show all drivers within that series, regardless if they are associated with a user or not.
  - Within a series specific driver, it should display
    - car number
    - driver class (should have an option to edit)
    - license points accrued (should have an option to edit)
    - the user that the driver is currently associated with. This should have the option to edit this and select any user from the users table. If a new user is selected, then add that drivers steamId to `steamUserMapping`
