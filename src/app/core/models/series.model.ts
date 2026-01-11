import { Id } from '@convex/_generated/dataModel';

export interface Series {
  _id: Id<'series'>;
  name: string;
  description?: string;
  simgridLink?: string;
  createdAt: number;
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
