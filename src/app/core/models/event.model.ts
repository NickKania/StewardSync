import { Id } from '@convex/_generated/dataModel';

export interface Event {
  _id: Id<'events'>;
  series: string;
  eventNumber: number;
  trackName: string;
  eventDate: number;
  createdAt: number;
}

export interface Race {
  _id: Id<'races'>;
  eventId: Id<'events'>;
  raceNumber: number;
  event?: Event;
  createdAt: number;
}
