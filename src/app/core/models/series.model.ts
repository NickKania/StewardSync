import { Id } from '@convex/_generated/dataModel';

export interface Series {
  _id: Id<'series'>;
  name: string;
  description?: string;
  simgridLink?: string;
  createdAt: number;
}

export interface SeriesPenalty {
  _id: Id<'series'>;
  seriesId: Id<'series'>;
  driverClass?: string;
  threshold: number;
  penaltyName: string;
  penaltyDescription?: string;
  createdAt: number;
  series?: Series;
  thresholds?: SeriesPenaltyThreshold[];
}

export interface SeriesPenaltyThreshold {
  _id: Id<'seriesPenaltyThresholds'>;
  seriesPenaltyId: Id<'series'>;
  driverClass: string;
  threshold: number;
  createdAt: number;
}

export interface DriverSeriesPenalty {
  _id: Id<'drivers'>;
  driverId: Id<'drivers'>;
  seriesId: Id<'series'>;
  seriesPenaltyId: Id<'series'>;
  seriesPenaltyThresholdId: Id<'seriesPenaltyThresholds'>;
  isServed: boolean;
  pointsAtAssignment: number;
  assignedAt: number;
  servedAt?: number;
  servedBy?: Id<'users'>;
  seriesPenalty?: SeriesPenalty;
  seriesPenaltyThreshold?: SeriesPenaltyThreshold;
  servedByUser?: any;
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
  timePenaltyWithSelfReport: number;
  licensePoints: number;
  createdAt: number;
  series?: Series;
}
