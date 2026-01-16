import { Id } from '@convex/_generated/dataModel';
import { User } from './user.model';
import { Report } from './report.model';

export type PenaltyType = 'none' | 'warning' | 'time_penalty' | 'drive_through' | 'stop_go' | 'disqualification';

export interface Review {
  _id: Id<'reviews'>;
  reviewDate: number;
  userId: Id<'users'>;
  reportId: Id<'reports'>;
  incidentDescription: string;
  reviewNotes: string;
  recommendedPenalty?: PenaltyType;
  videoTimestamp?: string;
  isSelfReport?: boolean;
  createdAt: number;
  updatedAt: number;

  // Populated relations
  reviewer?: User;
  report?: Report;
}

export interface CreateReviewDto {
  reportId: Id<'reports'>;
  incidentDescription: string;
  reviewNotes: string;
  recommendedPenalty?: PenaltyType;
  videoTimestamp?: string;
  isSelfReport?: boolean;
}

export interface UpdateReviewDto {
  reviewId: Id<'reviews'>;
  incidentDescription?: string;
  reviewNotes?: string;
  recommendedPenalty?: PenaltyType;
  videoTimestamp?: string;
}

export interface FinalizeReportDto {
  reportId: Id<'reports'>;
  finalDecision: string;
  appliedPenalty: PenaltyType;
  officialNotes: string;
}
