// Mock API that mimics Convex's generated API structure
// This is used when NEXT_PUBLIC_MOCK_MODE is true

import {
  mockUsers,
  mockRoles,
  mockDrivers,
  mockEvents,
  mockRaces,
  getReportsWithDetails,
  getReportWithDetails,
  getReviewsForReport,
} from "./mock-data";

export const api = {
  auth: {
    getCurrentUser: () => {
      // Return the admin user by default for mock mode
      return mockUsers[0];
    },
  },
  queries: {
    listReports: (args?: { limit?: number; finalizedOnly?: boolean }) => {
      return getReportsWithDetails(args?.finalizedOnly);
    },
    getReport: (args: { reportId: string }) => {
      return getReportWithDetails(args.reportId);
    },
    listReviews: (args: { reportId: string }) => {
      return getReviewsForReport(args.reportId);
    },
    listDrivers: () => {
      return mockDrivers;
    },
    listEvents: () => {
      return mockEvents;
    },
    listRaces: (args?: { eventId?: string }) => {
      if (args?.eventId) {
        return mockRaces.filter(r => r.Event === args.eventId);
      }
      return mockRaces;
    },
    listRoles: () => {
      return mockRoles;
    },
    listUsers: () => {
      return mockUsers;
    },
    getUnfinalizedReports: () => {
      return getReportsWithDetails(false);
    },
  },
  mutations: {
    createReport: (args: any) => {
      console.log("Mock: Creating report", args);
      return { id: "mock_report_id" };
    },
    updateReport: (args: any) => {
      console.log("Mock: Updating report", args);
      return { id: args.id };
    },
    finalizeReport: (args: any) => {
      console.log("Mock: Finalizing report", args);
      return { id: args.reportId };
    },
    createReview: (args: any) => {
      console.log("Mock: Creating review", args);
      return { id: "mock_review_id" };
    },
    createDriver: (args: any) => {
      console.log("Mock: Creating driver", args);
      return { id: "mock_driver_id" };
    },
    updateDriver: (args: any) => {
      console.log("Mock: Updating driver", args);
      return { id: args.id };
    },
    deleteDriver: (args: any) => {
      console.log("Mock: Deleting driver", args);
      return { id: args.id };
    },
    createEvent: (args: any) => {
      console.log("Mock: Creating event", args);
      return { id: "mock_event_id" };
    },
    updateEvent: (args: any) => {
      console.log("Mock: Updating event", args);
      return { id: args.id };
    },
    deleteEvent: (args: any) => {
      console.log("Mock: Deleting event", args);
      return { id: args.id };
    },
    createUser: (args: any) => {
      console.log("Mock: Creating user", args);
      return { id: "mock_user_id" };
    },
    updateUser: (args: any) => {
      console.log("Mock: Updating user", args);
      return { id: args.id };
    },
    deleteUser: (args: any) => {
      console.log("Mock: Deleting user", args);
      return { id: args.id };
    },
  },
};
