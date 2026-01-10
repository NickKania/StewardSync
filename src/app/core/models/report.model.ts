import { Id } from '@convex/_generated/dataModel';
import { Driver } from './driver.model';
import { Event, Race } from './event.model';

export type ReportStatus = 'pending' | 'reviewed' | 'finalized' | 'rejected';

export interface Report {
  _id: Id<'reports'>;
  reportDate: number;
  reportingDriverId: Id<'drivers'>;
  reportedDriverId: Id<'drivers'>;
  eventId: Id<'events'>;
  raceId: Id<'races'>;
  turn: number;
  description: string;
  status: ReportStatus;
  isFinalized: boolean;
  createdAt: number;
  updatedAt: number;

  // Populated relations
  reportingDriver?: Driver;
  reportedDriver?: Driver;
  event?: Event;
  race?: Race;
}

export interface CreateReportDto {
  reportingDriverId: Id<'drivers'>;
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
