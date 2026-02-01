import { Id } from '@convex/_generated/dataModel';

export interface DriverClass {
  _id: Id<'driverClasses'>;
  seriesId: Id<'series'>;
  className: string;
  displayName: string;
  createdAt: number;
}

export interface Driver {
  _id: Id<'drivers'>;
  driverNumber: number;
  driverName: string;
  officialName?: string;
  username?: string;
  externalId?: string;
  driverClassId: Id<'driverClasses'>;
  driverClass?: DriverClass; // Populated when joined
  steamId?: string;
  championshipId?: Id<'series'>;
  userId?: Id<'users'>;
  createdAt: number;
}
