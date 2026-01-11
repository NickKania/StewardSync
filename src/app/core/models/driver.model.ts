import { Id } from '@convex/_generated/dataModel';

export interface Driver {
  _id: Id<'drivers'>;
  driverNumber: number;
  driverName: string;
  username?: string;
  externalId?: string;
  driverClass: string;
  steamId?: string;
  championshipId?: Id<'series'>;
  createdAt: number;
}
