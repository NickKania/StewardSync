import { Id } from '@convex/_generated/dataModel';
import { Series } from './series.model';

export interface Event {
  _id: Id<'events'>;
  seriesId: Id<'series'>;
  eventNumber: number;
  trackName: string;
  eventDate: number;
  createdAt: number;
  series?: Series;
}

export interface Race {
  _id: Id<'races'>;
  eventId: Id<'events'>;
  raceNumber: number;
  event?: Event;
  createdAt: number;
}
