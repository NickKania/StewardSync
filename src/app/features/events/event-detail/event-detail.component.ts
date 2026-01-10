import { Component, inject, OnInit, OnDestroy, signal, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ConvexService } from '@core/services/convex.service';
import { CardComponent } from '@shared/components/card/card.component';
import { ButtonComponent } from '@shared/components/button/button.component';
import { BadgeComponent } from '@shared/components/badge/badge.component';
import { LoadingComponent } from '@shared/components/loading/loading.component';
import { DateFormatPipe } from '@shared/pipes/date-format.pipe';

@Component({
  selector: 'app-event-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    CardComponent,
    ButtonComponent,
    BadgeComponent,
    LoadingComponent,
    DateFormatPipe
  ],
  template: `
    <div class="space-y-6">
      @if (loading()) {
        <app-loading text="Loading event..." />
      } @else if (event()) {
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 class="text-2xl font-bold text-gray-900">{{ event()?.trackName }}</h1>
            <p class="text-gray-500 mt-1">{{ event()?.series }} - Round {{ event()?.eventNumber }}</p>
          </div>
          <div class="flex gap-3">
            <a routerLink="/events">
              <app-button variant="secondary">
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                </svg>
                Back to Events
              </app-button>
            </a>
            <a routerLink="/reports/new">
              <app-button variant="primary">File Report</app-button>
            </a>
          </div>
        </div>

        <div class="grid lg:grid-cols-3 gap-6">
          <!-- Event details -->
          <div class="lg:col-span-2 space-y-6">
            <app-card title="Event Information">
              <dl class="grid sm:grid-cols-2 gap-4">
                <div>
                  <dt class="text-sm text-gray-500">Track</dt>
                  <dd class="font-medium text-gray-900">{{ event()?.trackName }}</dd>
                </div>
                <div>
                  <dt class="text-sm text-gray-500">Series</dt>
                  <dd class="font-medium text-gray-900">{{ event()?.series }}</dd>
                </div>
                <div>
                  <dt class="text-sm text-gray-500">Round Number</dt>
                  <dd class="font-medium text-gray-900">{{ event()?.eventNumber }}</dd>
                </div>
                <div>
                  <dt class="text-sm text-gray-500">Date</dt>
                  <dd class="font-medium text-gray-900">{{ event()?.eventDate | dateFormat:'PPP' }}</dd>
                </div>
              </dl>
            </app-card>

            <!-- Races -->
            <app-card title="Races">
              @if (event()?.races?.length > 0) {
                <div class="space-y-3">
                  @for (race of event()?.races; track race._id) {
                    <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                          <span class="font-bold text-primary-700">{{ race.raceNumber }}</span>
                        </div>
                        <span class="font-medium text-gray-900">Race {{ race.raceNumber }}</span>
                      </div>
                      <a
                        [routerLink]="['/reports']"
                        [queryParams]="{ event: event()?._id, race: race._id }"
                        class="text-sm text-primary-600 hover:text-primary-700 font-medium"
                      >
                        View Reports
                      </a>
                    </div>
                  }
                </div>
              } @else {
                <p class="text-gray-500 text-center py-4">No races scheduled</p>
              }
            </app-card>
          </div>

          <!-- Sidebar -->
          <div class="space-y-6">
            <app-card title="Quick Stats">
              <div class="space-y-4">
                <div class="flex items-center justify-between">
                  <span class="text-gray-500">Total Races</span>
                  <span class="font-bold text-gray-900">{{ event()?.races?.length || 0 }}</span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-gray-500">Status</span>
                  <app-badge [variant]="getEventStatus(event()?.eventDate)">
                    {{ getEventStatusLabel(event()?.eventDate) }}
                  </app-badge>
                </div>
              </div>
            </app-card>
          </div>
        </div>
      } @else {
        <app-card>
          <div class="text-center py-12">
            <p class="text-gray-500">Event not found</p>
            <a routerLink="/events" class="mt-4 inline-block">
              <app-button variant="primary">Back to Events</app-button>
            </a>
          </div>
        </app-card>
      }
    </div>
  `
})
export class EventDetailComponent implements OnInit, OnDestroy {
  @Input() id!: string;

  private convex = inject(ConvexService);

  event = signal<any>(null);
  loading = signal(true);

  private unsubscribes: (() => void)[] = [];

  ngOnInit(): void {
    this.loadEvent();
  }

  ngOnDestroy(): void {
    this.unsubscribes.forEach(unsub => unsub());
  }

  private async loadEvent(): Promise<void> {
    if (!this.id) {
      this.loading.set(false);
      return;
    }

    try {
      const event = await this.convex.query(
        this.convex.api.events.getWithRaces,
        { eventId: this.id as any }
      );

      this.event.set(event);
    } catch (error) {
      console.error('Failed to load event:', error);
    } finally {
      this.loading.set(false);
    }
  }

  getEventStatus(eventDate: number | undefined): 'success' | 'warning' | 'info' {
    if (!eventDate) return 'info';

    const now = Date.now();
    const dayInMs = 24 * 60 * 60 * 1000;

    if (eventDate < now - dayInMs) {
      return 'success';
    } else if (eventDate < now + dayInMs) {
      return 'warning';
    }
    return 'info';
  }

  getEventStatusLabel(eventDate: number | undefined): string {
    if (!eventDate) return 'Unknown';

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
