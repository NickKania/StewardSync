// Mock data for testing without Convex backend

export const mockUsers = [
  {
    _id: "user_admin" as any,
    name: "Admin User",
    email: "admin@stewardsync.com",
    tokenIdentifier: "admin_token",
    Role: "role_admin",
    role: {
      _id: "role_admin" as any,
      RoleName: "Admin",
      Description: "Full access to all features",
    },
  },
  {
    _id: "user_steward" as any,
    name: "Steward User",
    email: "steward@stewardsync.com",
    tokenIdentifier: "steward_token",
    Role: "role_steward",
    role: {
      _id: "role_steward" as any,
      RoleName: "Steward",
      Description: "Can review and finalize reports",
    },
  },
  {
    _id: "user_driver" as any,
    name: "Driver User",
    email: "driver@stewardsync.com",
    tokenIdentifier: "driver_token",
    Role: "role_driver",
    role: {
      _id: "role_driver" as any,
      RoleName: "Driver",
      Description: "Can submit reports",
    },
  },
];

export const mockRoles = [
  {
    _id: "role_admin" as any,
    RoleName: "Admin",
    Description: "Full access to all features",
  },
  {
    _id: "role_steward" as any,
    RoleName: "Steward",
    Description: "Can review and finalize reports",
  },
  {
    _id: "role_driver" as any,
    RoleName: "Driver",
    Description: "Can submit reports",
  },
];

export const mockDrivers = [
  {
    _id: "driver_1" as any,
    Name: "Lewis Hamilton",
    Number: 44,
    Team: "Mercedes",
  },
  {
    _id: "driver_2" as any,
    Name: "Max Verstappen",
    Number: 1,
    Team: "Red Bull Racing",
  },
  {
    _id: "driver_3" as any,
    Name: "Charles Leclerc",
    Number: 16,
    Team: "Ferrari",
  },
  {
    _id: "driver_4" as any,
    Name: "Lando Norris",
    Number: 4,
    Team: "McLaren",
  },
  {
    _id: "driver_5" as any,
    Name: "Carlos Sainz",
    Number: 55,
    Team: "Ferrari",
  },
];

export const mockEvents = [
  {
    _id: "event_1" as any,
    Name: "British Grand Prix",
    Location: "Silverstone",
    Date: "2024-07-07",
  },
  {
    _id: "event_2" as any,
    Name: "Monaco Grand Prix",
    Location: "Monte Carlo",
    Date: "2024-05-26",
  },
  {
    _id: "event_3" as any,
    Name: "Italian Grand Prix",
    Location: "Monza",
    Date: "2024-09-01",
  },
];

export const mockRaces = [
  {
    _id: "race_1" as any,
    Event: "event_1" as any,
    Name: "Feature Race",
    Laps: 52,
    Status: "Completed",
  },
  {
    _id: "race_2" as any,
    Event: "event_2" as any,
    Name: "Feature Race",
    Laps: 78,
    Status: "Completed",
  },
  {
    _id: "race_3" as any,
    Event: "event_3" as any,
    Name: "Feature Race",
    Laps: 53,
    Status: "Completed",
  },
];

export const mockReports = [
  {
    _id: "report_1" as any,
    ReportingDriver: "driver_1" as any,
    ReportedDriver: "driver_2" as any,
    Event: "event_1" as any,
    Race: "race_1" as any,
    IncidentDescription: "Contact at Turn 4",
    IncidentTime: "Lap 12",
    Severity: "Medium",
    Status: "Pending Review",
    IsFinalized: false,
    createdBy: "user_driver" as any,
    creationTime: "2024-07-07T14:30:00Z",
  },
  {
    _id: "report_2" as any,
    ReportingDriver: "driver_3" as any,
    ReportedDriver: "driver_4" as any,
    Event: "event_2" as any,
    Race: "race_2" as any,
    IncidentDescription: "Blocking in qualifying",
    IncidentTime: "Lap 8",
    Severity: "Low",
    Status: "Under Review",
    IsFinalized: false,
    createdBy: "user_driver" as any,
    creationTime: "2024-05-26T13:15:00Z",
  },
  {
    _id: "report_3" as any,
    ReportingDriver: "driver_2" as any,
    ReportedDriver: "driver_1" as any,
    Event: "event_3" as any,
    Race: "race_3" as any,
    IncidentDescription: "Unsafe re-entry to track",
    IncidentTime: "Lap 23",
    Severity: "High",
    Status: "Finalized",
    IsFinalized: true,
    createdBy: "user_driver" as any,
    creationTime: "2024-09-01T15:45:00Z",
  },
];

export const mockReviews = [
  {
    _id: "review_1" as any,
    ReviewedReport: "report_1" as any,
    UserId: "user_steward" as any,
    ReviewText: "Reviewing video evidence. Contact appears to be racing incident.",
    Rating: 3,
    creationTime: "2024-07-07T15:00:00Z",
    user: mockUsers[1],
  },
  {
    _id: "review_2" as any,
    ReviewedReport: "report_1" as any,
    UserId: "user_admin" as any,
    ReviewText: "Agreed with steward's assessment. No further action required.",
    Rating: 3,
    creationTime: "2024-07-07T15:30:00Z",
    user: mockUsers[0],
  },
];

// Helper function to get reports with related data
export function getReportsWithDetails(finalizedOnly?: boolean) {
  let reports = mockReports;
  
  if (finalizedOnly !== undefined) {
    reports = reports.filter(r => r.IsFinalized === finalizedOnly);
  }

  return reports.map(report => ({
    ...report,
    reportingDriver: mockDrivers.find(d => d._id === report.ReportingDriver),
    reportedDriver: mockDrivers.find(d => d._id === report.ReportedDriver),
    event: mockEvents.find(e => e._id === report.Event),
    race: mockRaces.find(r => r._id === report.Race),
    createdBy: mockUsers.find(u => u._id === report.createdBy),
  }));
}

// Helper function to get a single report with details
export function getReportWithDetails(reportId: string) {
  const report = mockReports.find(r => r._id === reportId);
  if (!report) return null;

  return {
    ...report,
    reportingDriver: mockDrivers.find(d => d._id === report.ReportingDriver),
    reportedDriver: mockDrivers.find(d => d._id === report.ReportedDriver),
    event: mockEvents.find(e => e._id === report.Event),
    race: mockRaces.find(r => r._id === report.Race),
    createdBy: mockUsers.find(u => u._id === report.createdBy),
  };
}

// Helper function to get reviews for a report
export function getReviewsForReport(reportId: string) {
  return mockReviews
    .filter(r => r.ReviewedReport === reportId)
    .map(review => ({
      ...review,
      user: mockUsers.find(u => u._id === review.UserId),
    }));
}
