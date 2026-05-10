import { Component, inject, OnInit, OnDestroy, signal, computed, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ConvexService } from '@core/services/convex.service';
import { Series } from '@core/models/series.model';
import { CardComponent } from '@shared/components/card/card.component';
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
          <div class="w-full sm:w-48">
            <select
              class="input"
              [ngModel]="selectedSeries()"
              (ngModelChange)="onSeriesChange($event)"
            >
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
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

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
    this.route.queryParams
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => this.applyQueryParams(params));

    this.loadEvents();
  }

  ngOnDestroy(): void {
    this.unsubscribes.forEach(unsub => unsub());
  }

  private loadEvents(): void {
    let eventsLoaded = false;
    let seriesLoaded = false;

    const eventsQuery = this.convex.createReactiveQuery(
      this.convex.api.events.list,
      {},
      (data) => {
        this.events.set(data);
        eventsLoaded = true;
        if (eventsLoaded && seriesLoaded) {
          this.loading.set(false);
        }
      }
    );
    this.unsubscribes.push(eventsQuery.unsubscribe);

    const seriesQuery = this.convex.createReactiveQuery(
      this.convex.api.series.listActive,
      {},
      (data) => {
        this.series.set(data);
        seriesLoaded = true;
        if (eventsLoaded && seriesLoaded) {
          this.loading.set(false);
        }
      }
    );
    this.unsubscribes.push(seriesQuery.unsubscribe);
  }

  onSeriesChange(seriesId: string, syncQueryParams = true): void {
    this.selectedSeries.set(seriesId || '');
    if (syncQueryParams) {
      this.syncQueryParams();
    }
  }

  private applyQueryParams(params: Params): void {
    const nextSeries = this.getStringParam(params, 'series');
    if (nextSeries !== this.selectedSeries()) {
      this.onSeriesChange(nextSeries, false);
    }
  }

  private getFilterQueryParams(): Record<string, string | undefined> {
    return {
      series: this.selectedSeries() || undefined,
    };
  }

  private syncQueryParams(): void {
    const currentQueryParams = this.route.snapshot.queryParams as Record<string, unknown>;
    const queryParams = this.getMergedQueryParams(currentQueryParams);
    if (this.areQueryParamsEqual(currentQueryParams, queryParams)) {
      return;
    }

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
    });
  }

  private getMergedQueryParams(
    currentQueryParams: Record<string, unknown>,
  ): Record<string, string | undefined> {
    const preservedParams: Record<string, string | undefined> = {};

    Object.entries(currentQueryParams).forEach(([key, value]) => {
      if (key !== 'series' && typeof value === 'string' && value) {
        preservedParams[key] = value;
      }
    });

    return {
      ...preservedParams,
      ...this.getFilterQueryParams(),
    };
  }

  private areQueryParamsEqual(
    current: Record<string, unknown>,
    next: Record<string, string | undefined>,
  ): boolean {
    const normalize = (params: Record<string, unknown>): Record<string, string> => {
      const normalized: Record<string, string> = {};

      Object.entries(params).forEach(([key, value]) => {
        if (typeof value === 'string' && value) {
          normalized[key] = value;
        }
      });

      return normalized;
    };

    const normalizedCurrent = normalize(current);
    const normalizedNext = normalize(next);
    const currentKeys = Object.keys(normalizedCurrent).sort();
    const nextKeys = Object.keys(normalizedNext).sort();

    if (currentKeys.length !== nextKeys.length) {
      return false;
    }

    return currentKeys.every(
      (key, index) =>
        key === nextKeys[index] && normalizedCurrent[key] === normalizedNext[key],
    );
  }

  private getStringParam(params: Params, key: string): string {
    const value = params[key];
    return typeof value === 'string' ? value : '';
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
