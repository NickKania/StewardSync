import { Id } from '@convex/_generated/dataModel';
import { DriverClass } from './driver.model';

export interface Series {
  _id: Id<'series'>;
  name: string;
  description?: string;
  simgridLink?: string;
  reportingOpenTime?: string;
  reportingCloseDuration?: number;
  isReportingLocked?: boolean;
  isActive?: boolean;
  seriesPenaltyNotes?: string;
  createdAt: number;
}

export interface SeriesPenalty {
  _id: Id<'seriesPenalties'>;
  seriesId: Id<'series'>;
  penaltyName: string;
  penaltyDescription?: string;
  createdAt: number;
  series?: Series;
  thresholds?: SeriesPenaltyThreshold[];
}

export interface SeriesPenaltyThreshold {
  _id: Id<'seriesPenaltyThresholds'>;
  seriesPenaltyId: Id<'seriesPenalties'>;
  threshold: number;
  driverClassIds: Id<'driverClasses'>[];
  requiresReview?: boolean;
  driverClassObjects?: DriverClass[]; // Populated by backend queries
  createdAt: number;
}

export interface DriverSeriesPenalty {
  _id: Id<'driverSeriesPenalties'>;
  driverId: Id<'drivers'>;
  seriesId: Id<'series'>;
  seriesPenaltyId: Id<'seriesPenalties'>;
  seriesPenaltyThresholdId: Id<'seriesPenaltyThresholds'>;
  isServed: boolean;
  requiresReview?: boolean;
  raceBanReviewId?: string;
  pointsAtAssignment: number;
  assignedAt: number;
  servedAt?: number;
  servedBy?: Id<'users'>;
  seriesPenalty?: SeriesPenalty;
  seriesPenaltyThreshold?: SeriesPenaltyThreshold;
  servedByUser?: any;
}

export interface DriverSeriesPenaltyDetails {
  _id: Id<'driverSeriesPenalties'>;
  driverId: Id<'drivers'>;
  seriesId: Id<'series'>;
  seriesName: string | null;
  seriesPenaltyId: Id<'seriesPenalties'>;
  seriesPenaltyThresholdId: Id<'seriesPenaltyThresholds'>;
  penaltyName: string | null;
  penaltyDescription: string | null;
  threshold: number | null;
  isServed: boolean;
  requiresReview?: boolean;
  reviewStatus?: 'not_required' | 'required_no_request' | 'open' | 'scheduled' | 'completed';
  raceBanReviewId?: string | null;
  status?: 'active' | 'served' | 'served_pending_review';
  pointsAtAssignment: number;
  assignedAt: number;
  expectedServeDate: number | null;
  servedAt?: number;
  servedBy?: Id<'users'>;
  servedByUserName: string | null;
}

export interface SeriesLicensePointsWithPenalties {
  driverId: string;
  driverNumber: number;
  driverName: string;
  totalLicensePoints: number;
  seriesPenalties: DriverSeriesPenalty[];
}

export interface Penalty {
  _id: Id<'penalties'>;
  seriesId: Id<'series'>;
  name: string;
  timePenalty: number;
  selfReportReduction?: number;
  timePenaltyLap1: number;
  licensePoints: number;
  createdAt: number;
  series?: Series;
}
