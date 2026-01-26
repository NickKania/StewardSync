import { Component, inject, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ConvexService } from '@core/services/convex.service';
import { Series } from '@core/models/series.model';
import { CardComponent } from '@shared/components/card/card.component';
import { ButtonComponent } from '@shared/components/button/button.component';
import { BadgeComponent } from '@shared/components/badge/badge.component';
import { LoadingComponent } from '@shared/components/loading/loading.component';
import { DateFormatPipe } from '@shared/pipes/date-format.pipe';

@Component({
  selector: 'app-event-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    CardComponent,
    ButtonComponent,
    BadgeComponent,
    LoadingComponent,
    DateFormatPipe
  ],
  template: `
    <div class="space-y-6">
       <!-- Header -->
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Events</h1>
        <p class="text-gray-500 mt-1 dark:text-gray-400">View all racing events</p>
      </div>

      <!-- Series filter -->
      <app-card>
        <div class="flex gap-4">
          <div class="w-48">
            <select class="input" [(ngModel)]="selectedSeries">
              <option value="">All series</option>
              @for (s of series(); track s._id) {
                <option [value]="s._id">{{ s.name }}</option>
              }
            </select>
          </div>
        </div>
      </app-card>

      <!-- Events list -->
      @if (loading()) {
        <app-loading text="Loading events..." />
      } @else if (filteredEvents().length > 0) {
        <div class="space-y-4">
          @for (event of filteredEvents(); track event._id) {
            <a [routerLink]="['/events', event._id]">
              <app-card [hover]="true">
                 <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div class="flex items-center gap-4">
                    <div class="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center dark:bg-gray-800">
                      <span class="text-2xl font-bold text-gray-400 dark:text-gray-500">R{{ event.eventNumber }}</span>
                    </div>
                    <div>
                      <h3 class="font-semibold text-gray-900 dark:text-gray-100">{{ event.trackName }}</h3>
                      <p class="text-sm text-gray-500 dark:text-gray-400">{{ event.series?.name }} - Round {{ event.eventNumber }}</p>
                    </div>
                  </div>
                  <div class="flex items-center gap-4">
                    <div class="text-right">
                      <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ event.eventDate | dateFormat:'PP' }}</p>
                      <app-badge [variant]="getEventStatus(event.eventDate)">
                        {{ getEventStatusLabel(event.eventDate) }}
                      </app-badge>
                    </div>
                    <svg class="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                    </svg>
                  </div>
                </div>
              </app-card>
            </a>
           }
        </div>
       } @else {
        <app-card>
          <div class="text-center py-12">
            <svg class="w-12 h-12 text-gray-300 mx-auto mb-4 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
            </svg>
             <p class="text-gray-500 dark:text-gray-400">No events found{{ selectedSeries() ? ' for selected series' : '' }}</p>
          </div>
        </app-card>
      }
    </div>
  `
})
export class EventListComponent implements OnInit, OnDestroy {
  private convex = inject(ConvexService);

  events = signal<any[]>([]);
  series = signal<Series[]>([]);
  loading = signal(true);

  selectedSeries = signal('');

  filteredEvents = computed(() => {
    const seriesId = this.selectedSeries();
    if (!seriesId) {
      return this.events();
    }
    return this.events().filter(e => e.seriesId === seriesId);
  });

  private unsubscribes: (() => void)[] = [];

  ngOnInit(): void {
    this.loadEvents();
  }

  ngOnDestroy(): void {
    this.unsubscribes.forEach(unsub => unsub());
  }

  private loadEvents(): void {
    const eventsQuery = this.convex.createReactiveQuery(
      this.convex.api.events.list,
      {}
    );
    this.unsubscribes.push(eventsQuery.unsubscribe);

    const seriesQuery = this.convex.createReactiveQuery(
      this.convex.api.series.list,
      {}
    );
    this.unsubscribes.push(seriesQuery.unsubscribe);

    const checkData = setInterval(() => {
      const eventsData = eventsQuery.data();
      const seriesData = seriesQuery.data();

      if (eventsData !== undefined && seriesData !== undefined) {
        this.events.set(eventsData);
        this.series.set(seriesData);
        this.loading.set(false);
      }
    }, 100);
    this.unsubscribes.push(() => clearInterval(checkData));
  }

  getEventStatus(eventDate: number): 'success' | 'warning' | 'info' {
    const now = Date.now();
    const dayInMs = 24 * 60 * 60 * 1000;

    if (eventDate < now - dayInMs) {
      return 'success'; // Past
    } else if (eventDate < now + dayInMs) {
      return 'warning'; // Today/Tomorrow
    }
    return 'info'; // Upcoming
  }

  getEventStatusLabel(eventDate: number): string {
    const now = Date.now();
    const dayInMs = 24 * 60 * 60 * 1000;

    if (eventDate < now - dayInMs) {
      return 'Completed';
    } else if (eventDate < now + dayInMs) {
      return 'Current';
    }
    return 'Upcoming';
  }
}
