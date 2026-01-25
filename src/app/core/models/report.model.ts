import { Id } from '@convex/_generated/dataModel';
import { Driver } from './driver.model';
import { Event, Race } from './event.model';

export type ReportStatus = 'pending' | 'reviewed' | 'finalized' | 'rejected';

export interface Report {
  _id: Id<'reports'>;
  reportDate: number;
  reportingUserId?: Id<'users'>;
  reportingDriverId?: Id<'drivers'>;
  reportedDriverId: Id<'drivers'>;
  eventId: Id<'events'>;
  raceId: Id<'races'>;
  lap?: number;
  turn: number;
  description: string;
  status: ReportStatus;
  isFinalized: boolean;
  isSelfReport?: boolean;
  isStewardReported?: boolean;
  finalDecision?: string;
  appliedPenalty?: string;
  atFaultDriverId?: Id<'drivers'>;
  officialNotes?: string;
  finalizedBy?: Id<'users'>;
  finalizedAt?: number;
  isEdited?: boolean;
  createdAt: number;
  updatedAt: number;

  // Populated relations
  reportingUser?: any;
  reportingDriver?: Driver;
  reportedDriver?: Driver;
  event?: Event;
  race?: Race;
  atFaultDriver?: Driver;
  appliedPenaltyObj?: any;
  reviews?: any[];
}

export interface CreateReportDto {
  reportingUserId: Id<'users'>;
  reportedDriverId: Id<'drivers'>;
  eventId: Id<'events'>;
  raceId: Id<'races'>;
  turn: number;
  description: string;
}

export interface UpdateReportDto {
  reportId: Id<'reports'>;
  turn?: number;
  description?: string;
}
