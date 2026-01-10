import { Id } from '@convex/_generated/dataModel';

export interface Driver {
  _id: Id<'drivers'>;
  driverNumber: number;
  driverName: string;
  externalId?: string;
  driverClass: string;
  createdAt: number;
}
