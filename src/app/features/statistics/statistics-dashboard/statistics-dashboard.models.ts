export interface EventRundownRow {
  reportId: string | number | null;
  driverId: string | null;
  carNumber: number | null;
  driverName: string | null;
  driverClass: string | null;
  lap: string | null;
  turn: string | null;
  incidentDescription: string;
  adjustedReason?: string;
  penaltyName: string | null;
  penaltyAllowsNoDriverAtFault: boolean;
  timePenaltySeconds: number;
  licensePoints: number | null;
  isSelfReport: boolean;
  hasTimePenaltyAdjustment: boolean;
  hasLicensePointAdjustment: boolean;
  isFinalized: boolean;
}

export interface RaceRundown {
  raceId: string;
  raceNumber: number;
  raceName: string;
  reports: EventRundownRow[];
}

export interface DriverPointsRow {
  driverId: string;
  driverNumber?: number;
  driverName: string;
  driverClass: string;
  totalLicensePoints: number;
  eligibleSeriesPenalties?: any[];
  seriesPenalties?: any[];
}

export interface SeriesPenaltyDefinition {
  _id: string;
  penaltyName: string;
  thresholds?: Array<{
    _id: string;
    threshold: number;
    driverClassObjects?: Array<{ displayName?: string }>;
  }>;
}

export interface DriverTimePenaltyRow {
  driverId: string;
  carNumber: number | null;
  driverName: string;
  driverClass: string;
  totalTimePenaltySeconds: number;
}

export interface RaceTimePenaltySummary {
  raceId: string;
  raceNumber: number;
  raceName: string;
  driverPenalties: DriverTimePenaltyRow[];
}

export interface EventDetails {
  seriesName: string;
  eventName: string;
}

export interface TimePenaltyEvent {
  eventNumber: number;
  trackName: string;
}

export interface ImageExportRequest {
  element: HTMLElement;
  filename: string;
}
