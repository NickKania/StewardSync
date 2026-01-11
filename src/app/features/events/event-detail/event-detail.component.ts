import { Component, inject, OnInit, OnDestroy, signal, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ConvexService } from '@core/services/convex.service';
import { CardComponent } from '@shared/components/card/card.component';
import { ButtonComponent } from '@shared/components/button/button.component';
import { BadgeComponent } from '@shared/components/badge/badge.component';
import { LoadingComponent } from '@shared/components/loading/loading.component';
import { DateFormatPipe } from '@shared/pipes/date-format.pipe';
import { Id } from '@convex/_generated/dataModel';

@Component({
  selector: 'app-event-detail',
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
      @if (loading()) {
        <app-loading text="Loading event..." />
      } @else if (event()) {
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 class="text-2xl font-bold text-gray-900">{{ event()?.trackName }}</h1>
            <p class="text-gray-500 mt-1">{{ event()?.series?.name }} - Round {{ event()?.eventNumber }}</p>
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
                  <dd class="font-medium text-gray-900">{{ event()?.series?.name }}</dd>
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
              <div class="flex items-center justify-between mb-3">
                <span class="text-sm text-gray-500">Manage races for this event</span>
                <app-button variant="secondary" size="sm" (click)="showAddRaceModal = true">
                  <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                  </svg>
                  Add Race
                </app-button>
              </div>
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
                      <div class="flex items-center gap-2">
                        <button
                          (click)="removeRace(race._id)"
                          class="text-gray-400 hover:text-red-600 p-1"
                          title="Delete race"
                        >
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                          </svg>
                        </button>
                        <a
                          [routerLink]="['/reports']"
                          [queryParams]="{ event: event()?._id, race: race._id }"
                          class="text-sm text-primary-600 hover:text-primary-700 font-medium"
                        >
                          View Reports
                        </a>
                      </div>
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

      <!-- Add Race Modal -->
      @if (showAddRaceModal) {
        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div class="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 class="text-lg font-semibold mb-4">Add Race</h3>
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Race Number</label>
                <input
                  type="number"
                  class="input w-full"
                  [(ngModel)]="raceForm.raceNumber"
                  min="1"
                  placeholder="e.g., 1, 2, 3"
                />
              </div>
              <div class="flex gap-2 justify-end">
                <app-button variant="secondary" (click)="closeAddRaceModal()">Cancel</app-button>
                <app-button (click)="addRace()" [disabled]="raceForm.raceNumber < 1">
                  Add Race
                </app-button>
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class EventDetailComponent implements OnInit, OnDestroy {
  @Input() id!: string;

  private convex = inject(ConvexService);

  event = signal<any>(null);
  loading = signal(true);
  showAddRaceModal = false;
  raceForm = {
    raceNumber: 0
  };

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

  closeAddRaceModal(): void {
    this.showAddRaceModal = false;
    this.raceForm.raceNumber = 0;
  }

  async addRace(): Promise<void> {
    if (this.raceForm.raceNumber < 1) return;

    try {
      await this.convex.mutation(this.convex.api.races.create, {
        eventId: this.event()?._id,
        raceNumber: this.raceForm.raceNumber
      });

      this.closeAddRaceModal();

      await this.loadEvent();
    } catch (error: any) {
      alert(`Failed to add race: ${error.message}`);
    }
  }

  async removeRace(raceId: Id<'races'>): Promise<void> {
    if (!confirm('Are you sure you want to delete this race? This will fail if there are existing reports.')) {
      return;
    }

    try {
      await this.convex.mutation(this.convex.api.races.remove, { raceId });
      await this.loadEvent();
    } catch (error: any) {
      alert(`Failed to delete race: ${error.message}`);
    }
  }
}
