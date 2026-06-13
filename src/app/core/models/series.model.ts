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
  requireVideoEvidence?: boolean;
  isActive?: boolean;
  seriesPenaltyNotes?: string;
  scheduledImportTime?: string;
  scheduledImportDays?: number[];
  scheduledImportJobId?: Id<'_scheduled_functions'>;
  isScheduledImportActive?: boolean;
  createdAt: number;
}

export interface ScheduledImportStatus {
  isScheduledImportActive: boolean;
  scheduledImportTime?: string;
  scheduledImportDays: number[];
  nextRun: number | null;
  seriesStartDate: number | null;
  seriesEndDate: number | null;
  hasEvents: boolean;
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
  selfReportLicensePointReduction?: number;
  allowNoDriverAtFault?: boolean;
  createdAt: number;
  series?: Series;
}

export interface SeriesCopyPenaltyPreview {
  name: string;
  timePenalty: number;
  selfReportReduction?: number;
  timePenaltyLap1: number;
  licensePoints: number;
  selfReportLicensePointReduction?: number;
  allowNoDriverAtFault?: boolean;
}

export interface SeriesCopyThresholdPreview {
  threshold: number;
  requiresReview: boolean;
  sourceClasses: string[];
  matchedClassIds: Id<'driverClasses'>[];
  matchedClasses?: Array<{
    id: Id<'driverClasses'>;
    className: string;
    displayName: string;
  }>;
  unmatchedClasses: string[];
}

export interface SeriesCopySeriesPenaltyPreview {
  penaltyName: string;
  penaltyDescription?: string;
  alreadyExists: boolean;
  thresholds: SeriesCopyThresholdPreview[];
}

export interface SeriesCopySessionPreview {
  raceNumber?: number;
  sessionName?: string;
}

export interface SeriesCopyPreview {
  penalties: {
    toCreate: SeriesCopyPenaltyPreview[];
    alreadyExists: string[];
  };
  seriesPenalties: SeriesCopySeriesPenaltyPreview[];
  sessions: {
    byEvent: Record<string, {
      toCreate: SeriesCopySessionPreview[];
      alreadyExists: string[];
    }>;
    eventsNotFound: number[];
  };
}

export interface SeriesCopyResult {
  penaltiesCreated: number;
  penaltiesSkipped: number;
  seriesPenaltiesCreated: number;
  seriesPenaltiesSkipped: number;
  thresholdsCreated: number;
  sessionsCreated: number;
  sessionsSkipped: number;
  warnings: string[];
}
