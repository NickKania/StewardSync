import { Id } from '@convex/_generated/dataModel';
import { Driver } from './driver.model';
import { Event, Session } from './event.model';

export type ReportStatus = 'pending' | 'reviewed' | 'finalized' | 'rejected';

export interface Report {
  _id: Id<'reports'>;
  reportDate: number;
  reportingUserId?: Id<'users'>;
  reportingDriverId?: Id<'drivers'>;
  reportedDriverId: Id<'drivers'>;
  eventId: Id<'events'>;
  raceId: Id<'races'>;
  lap?: string;
  turn: string;
  description: string;
  status: ReportStatus;
  isFinalized: boolean;
  isSelfReport?: boolean;
  isStewardReported?: boolean;
  videoLink?: string;
  videoTimestamp?: string;
  finalDecision?: string;
  appliedPenalty?: string;
  atFaultDriverId?: Id<'drivers'>;
  isNoDriverAtFault?: boolean;
  officialNotes?: string;
  finalizedBy?: Id<'users'>;
  finalizedAt?: number;
  editedBy?: Id<'users'>;
  editedAt?: number;
  isEdited?: boolean;
  createdAt: number;
  updatedAt: number;

  // Populated relations
  reportingUser?: any;
  reportingDriver?: Driver;
  reportedDriver?: Driver;
  event?: Event;
  race?: Session;
  atFaultDriver?: Driver;
  finalizedByUser?: any;
  editedByUser?: any;
  appliedPenaltyObj?: any;
  reviews?: any[];
}

export interface CreateReportDto {
  reportingUserId: Id<'users'>;
  reportedDriverId: Id<'drivers'>;
  eventId: Id<'events'>;
  raceId: Id<'races'>;
  turn: string;
  description: string;
  videoLink?: string;
  videoTimestamp?: string;
}

export interface UpdateReportDto {
  reportId: Id<'reports'>;
  turn?: string;
  description?: string;
  videoLink?: string;
  videoTimestamp?: string;
}
