import type { Id } from "@convex/_generated/dataModel";

export interface SeriesForm {
  name: string;
  description: string;
  simgridLink: string;
  reportingOpenTime: string;
  reportingCloseDuration: number;
  isReportingLocked: boolean;
  requireVideoEvidence: boolean;
  isActive: boolean;
  seriesPenaltyNotes: string;
}

export interface PenaltyForm {
  seriesId: Id<"series"> | "";
  name: string;
  timePenalty: number;
  selfReportReduction: number;
  timePenaltyLap1: number;
  licensePoints: number;
  selfReportLicensePointReduction: number;
  allowNoDriverAtFault: boolean;
}

export interface SeriesPenaltyForm {
  seriesId: Id<"series"> | "";
  penaltyName: string;
  penaltyDescription: string;
}

export interface PenaltyThresholdForm {
  id?: string;
  threshold: number;
  requiresReview: boolean;
  selectedDriverClasses: string[];
}
