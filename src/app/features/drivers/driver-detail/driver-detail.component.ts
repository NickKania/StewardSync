import { Component, inject, OnInit, OnDestroy, signal, Input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ConvexService } from '@core/services/convex.service';
import { AuthService } from '@core/services/auth.service';
import { CardComponent } from '@shared/components/card/card.component';
import { ButtonComponent } from '@shared/components/button/button.component';
import { BadgeComponent } from '@shared/components/badge/badge.component';
import { LoadingComponent } from '@shared/components/loading/loading.component';
import { SelectComponent, SelectOption } from '@shared/components/select/select.component';
import { DriverSeriesPenaltyDetails } from '@core/models';

@Component({
  selector: 'app-driver-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    CardComponent,
    ButtonComponent,
    BadgeComponent,
    LoadingComponent,
    SelectComponent
  ],
  template: `
    <div class="space-y-6">
      @if (loading()) {
        <app-loading text="Loading driver..." />
      } @else if (driver()) {
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div class="flex items-center gap-4">
            <div class="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center">
              <span class="text-3xl font-bold text-primary-700">{{ driver()?.driverNumber }}</span>
            </div>
            <div>
              <h1 class="text-2xl font-bold text-gray-900">{{ driver()?.driverName }}</h1>
              <div class="flex items-center gap-2 mt-1">
                <app-badge variant="primary">{{ driver()?.driverClass }}</app-badge>
                @if (driver()?.externalId) {
                  <span class="text-sm text-gray-500">ID: {{ driver()?.externalId }}</span>
                }
              </div>
            </div>
          </div>
          <a routerLink="/drivers">
            <app-button variant="secondary">
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
              </svg>
              Back to Drivers
            </app-button>
          </a>
        </div>

        <!-- Stats -->
        @if (stats()) {
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <app-card>
              <div class="text-center">
                <p class="text-3xl font-bold text-gray-900">{{ stats()?.reportsFiledCount || 0 }}</p>
                <p class="text-sm text-gray-500 mt-1">Reports Filed</p>
              </div>
            </app-card>
            <app-card>
              <div class="text-center">
                <p class="text-3xl font-bold text-amber-600">{{ stats()?.reportsAgainstCount || 0 }}</p>
                <p class="text-sm text-gray-500 mt-1">Reports Against</p>
              </div>
            </app-card>
            <app-card>
              <div class="text-center">
                <p class="text-3xl font-bold text-blue-600">{{ stats()?.pendingReports || 0 }}</p>
                <p class="text-sm text-gray-500 mt-1">Pending</p>
              </div>
            </app-card>
            <app-card>
              <div class="text-center">
                <p class="text-3xl font-bold text-green-600">{{ stats()?.finalizedReports || 0 }}</p>
                <p class="text-sm text-gray-500 mt-1">Finalized</p>
              </div>
            </app-card>
          </div>
        }

        <!-- Driver info -->
        <app-card title="Driver Information">
          <dl class="grid sm:grid-cols-2 gap-4">
            <div>
              <dt class="text-sm text-gray-500">Driver Number</dt>
              <dd class="font-medium text-gray-900">#{{ driver()?.driverNumber }}</dd>
            </div>
            <div>
              <dt class="text-sm text-gray-500">Full Name</dt>
              <dd class="font-medium text-gray-900">{{ driver()?.driverName }}</dd>
            </div>
            <div>
              <dt class="text-sm text-gray-500">Class</dt>
              <dd class="font-medium text-gray-900">{{ driver()?.driverClass }}</dd>
            </div>
            @if (driver()?.externalId) {
              <div>
                <dt class="text-sm text-gray-500">External ID</dt>
                <dd class="font-medium text-gray-900">{{ driver()?.externalId }}</dd>
              </div>
            }
          </dl>
        </app-card>

        <!-- Series Penalties -->
        <app-card title="Series Penalties">
          <div class="space-y-4">
            @if (seriesOptions().length > 1) {
              <div>
                <label class="label">Select Series</label>
                <app-select
                  [options]="seriesOptions()"
                  [(ngModel)]="selectedSeriesId"
                  (ngModelChange)="loadPenalties()"
                  placeholder="All Series"
                />
              </div>
            }

            @if (penaltiesLoading()) {
              <app-loading text="Loading penalties..." />
            } @else if (penalties().length > 0) {
              <div class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead class="bg-gray-50">
                    <tr class="text-left">
                      <th class="px-4 py-2 font-medium text-gray-500">Penalty</th>
                      <th class="px-4 py-2 font-medium text-gray-500">Threshold</th>
                      <th class="px-4 py-2 font-medium text-gray-500">Points at Assignment</th>
                      <th class="px-4 py-2 font-medium text-gray-500">Assigned Date</th>
                      <th class="px-4 py-2 font-medium text-gray-500">Status</th>
                      <th class="px-4 py-2 font-medium text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100">
                    @for (penalty of penalties(); track penalty._id) {
                      <tr class="hover:bg-gray-50">
                        <td class="px-4 py-3 font-medium text-gray-900">{{ penalty.penaltyName }}</td>
                        <td class="px-4 py-3 text-gray-600">{{ penalty.threshold }} pts</td>
                        <td class="px-4 py-3 text-gray-600">{{ penalty.pointsAtAssignment }} pts</td>
                        <td class="px-4 py-3 text-gray-600">{{ formatDate(penalty.assignedAt) }}</td>
                        <td class="px-4 py-3">
                          @if (penalty.isServed) {
                            <app-badge variant="success">Served</app-badge>
                          } @else {
                            <app-badge variant="danger">Active</app-badge>
                          }
                        </td>
                        <td class="px-4 py-3">
                          @if (!penalty.isServed && canMarkAsServed()) {
                            <app-button
                              variant="primary"
                              size="sm"
                              (onClick)="markAsServed(penalty._id)"
                            >
                              Mark as Served
                            </app-button>
                          } @else if (penalty.isServed && penalty.servedByUserName) {
                            <span class="text-sm text-gray-500">
                              By {{ penalty.servedByUserName }} on {{ formatDate(penalty.servedAt!) }}
                            </span>
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            } @else if (selectedSeriesId || seriesOptions().length === 1) {
              <p class="text-gray-500 text-center py-4">No series penalties assigned to this driver</p>
            } @else {
              <p class="text-gray-500 text-center py-4">Select a series to view penalties</p>
            }
          </div>
        </app-card>
      } @else {
        <app-card>
          <div class="text-center py-12">
            <p class="text-gray-500">Driver not found</p>
            <a routerLink="/drivers" class="mt-4 inline-block">
              <app-button variant="primary">Back to Drivers</app-button>
            </a>
          </div>
        </app-card>
      }
    </div>
  `
})
export class DriverDetailComponent implements OnInit, OnDestroy {
  @Input() id!: string;

  private convex = inject(ConvexService);
  authService = inject(AuthService);

  driver = signal<any>(null);
  stats = signal<any>(null);
  loading = signal(true);

  penalties = signal<DriverSeriesPenaltyDetails[]>([]);
  penaltiesLoading = signal(false);
  selectedSeriesId = '';

  series = signal<any[]>([]);

  private unsubscribes: (() => void)[] = [];

  ngOnInit(): void {
    this.loadDriver();
  }

  ngOnDestroy(): void {
    this.unsubscribes.forEach(unsub => unsub());
  }

  private async loadDriver(): Promise<void> {
    if (!this.id) {
      this.loading.set(false);
      return;
    }

    try {
      const driver = await this.convex.query(
        this.convex.api.drivers.getById,
        { driverId: this.id as any }
      );

      this.driver.set(driver);

      if (driver) {
        const stats = await this.convex.query(
          this.convex.api.drivers.getDriverStats,
          { driverId: this.id as any }
        );
        this.stats.set(stats);

        await this.loadSeries();
        await this.loadPenalties();
      }
    } catch (error) {
      console.error('Failed to load driver:', error);
    } finally {
      this.loading.set(false);
    }
  }

  private async loadSeries(): Promise<void> {
    const seriesQuery = this.convex.createReactiveQuery(
      this.convex.api.series.list,
      {}
    );
    this.unsubscribes.push(seriesQuery.unsubscribe);

    const checkSeries = setInterval(() => {
      const data = seriesQuery.data();
      if (data) {
        this.series.set(data);
      }
    }, 100);
    this.unsubscribes.push(() => clearInterval(checkSeries));
  }

  async loadPenalties(): Promise<void> {
    this.penaltiesLoading.set(true);
    try {
      const data = await this.convex.query(
        this.convex.api.driverSeriesPenalties.getDriverPenaltyDetails,
        {
          driverId: this.id as any,
          seriesId: this.selectedSeriesId ? this.selectedSeriesId as any : undefined
        }
      );
      this.penalties.set(data || []);
    } catch (error: any) {
      console.error('Failed to load penalties:', error);
      this.penalties.set([]);
    } finally {
      this.penaltiesLoading.set(false);
    }
  }

  async markAsServed(penaltyId: string): Promise<void> {
    try {
      const userId = this.authService.getUserId();
      if (!userId) {
        console.error('User not authenticated');
        return;
      }

      await this.convex.mutation(
        this.convex.api.driverSeriesPenalties.markAsServed,
        {
          id: penaltyId as any,
          servedBy: userId
        }
      );

      await this.loadPenalties();
    } catch (error: any) {
      console.error('Failed to mark penalty as served:', error);
    }
  }

  canMarkAsServed(): boolean {
    return this.authService.hasMinimumRole('head_steward');
  }

  formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString();
  }

  seriesOptions = computed(() => {
    return [
      { value: '', label: 'All Series' },
      ...this.series().map((s: any) => ({
        value: s._id,
        label: s.name
      }))
    ];
  });
}
