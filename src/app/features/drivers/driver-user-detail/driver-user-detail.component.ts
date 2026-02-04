import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ConvexService } from '@core/services/convex.service';
import { AuthService } from '@core/services/auth.service';
import { ToastService } from '@core/services/toast.service';
import { BadgeComponent } from '@shared/components/badge/badge.component';
import { ButtonComponent } from '@shared/components/button/button.component';
import { CardComponent } from '@shared/components/card/card.component';
import { LoadingComponent } from '@shared/components/loading/loading.component';

@Component({
  selector: 'app-driver-user-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    BadgeComponent,
    ButtonComponent,
    CardComponent,
    LoadingComponent,
  ],
  template: `
    <div class="space-y-6">
      @if (loading()) {
        <app-loading text="Loading user profile..." />
      } @else if (!profile()) {
        <app-card>
          <p class="text-center py-8 text-gray-500 dark:text-gray-400">User profile not found.</p>
          <div class="text-center">
            <a routerLink="/drivers"><app-button variant="secondary">Back to Drivers</app-button></a>
          </div>
        </app-card>
      } @else {
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ profile()?.user?.name }}</h1>
            @if (profile()?.user?.officialName) {
              <p class="text-gray-600 dark:text-gray-300">Official: {{ profile()?.user?.officialName }}</p>
            }
            @if (profile()?.user?.discordUsername) {
              <p class="text-gray-500 dark:text-gray-400">Discord: {{ profile()?.user?.discordUsername }}</p>
            }
          </div>
          <a routerLink="/drivers"><app-button variant="secondary">Back to Drivers</app-button></a>
        </div>

        <app-card>
          <label class="label">Visible Series Profiles</label>
          <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            @for (seriesProfile of profile()!.profiles; track seriesProfile.driverId) {
              <label class="inline-flex items-center gap-2 rounded-md border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  [checked]="selectedDriverIds().includes(seriesProfile.driverId)"
                  (change)="toggleDriverSelection(seriesProfile.driverId)"
                />
                <span>#{{ seriesProfile.driverNumber }} - {{ seriesProfile.seriesName }}</span>
              </label>
            }
          </div>
        </app-card>

        <div class="space-y-4">
          @for (seriesProfile of visibleProfiles(); track seriesProfile.driverId) {
            <app-card>
              <div class="flex items-center justify-between gap-3">
                <div>
                  <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {{ seriesProfile.seriesName }} - #{{ seriesProfile.driverNumber }}
                  </h3>
                  <p class="text-sm text-gray-500 dark:text-gray-400">{{ seriesProfile.displayName || seriesProfile.driverName }}</p>
                </div>
                @if (!seriesProfile.isActive) {
                  <app-badge variant="warning">Withdrawn</app-badge>
                }
              </div>

              <div class="grid md:grid-cols-3 gap-4 mt-4">
                <div>
                  <p class="text-xs uppercase text-gray-500 dark:text-gray-400">Driver Class</p>
                  <p class="font-medium text-gray-900 dark:text-gray-100">{{ seriesProfile.driverClassName || 'No class' }}</p>
                </div>
                <div>
                  <p class="text-xs uppercase text-gray-500 dark:text-gray-400">License Points</p>
                  <p class="font-medium text-gray-900 dark:text-gray-100">{{ seriesProfile.accumulatedLicensePoints || 0 }}</p>
                </div>
                <div>
                  <p class="text-xs uppercase text-gray-500 dark:text-gray-400">Steam ID</p>
                  <p class="font-medium text-gray-900 dark:text-gray-100">{{ seriesProfile.steamId || 'Not set' }}</p>
                </div>
              </div>

              @if (canManageProfiles()) {
                <div class="grid lg:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                  <div class="space-y-2">
                    <label class="label">Update Class</label>
                    <select
                      class="input"
                      [ngModel]="classSelection()[seriesProfile.driverId] || ''"
                      (ngModelChange)="setClassSelection(seriesProfile.driverId, $event)"
                    >
                      <option value="">Select class</option>
                      @for (driverClass of classOptionsBySeries()[seriesProfile.seriesId || '']; track driverClass._id) {
                        <option [value]="driverClass._id">{{ driverClass.displayName }}</option>
                      }
                    </select>

                    <label class="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                      <input
                        type="checkbox"
                        [ngModel]="adjustPointsOnClassChange()[seriesProfile.driverId] || false"
                        (ngModelChange)="setAdjustPoints(seriesProfile.driverId, $event)"
                      />
                      Adjust license points as part of class move
                    </label>

                    @if (adjustPointsOnClassChange()[seriesProfile.driverId]) {
                      <input
                        type="number"
                        class="input"
                        min="0"
                        [ngModel]="pendingLicensePoints()[seriesProfile.driverId] ?? seriesProfile.accumulatedLicensePoints"
                        (ngModelChange)="setPendingLicensePoints(seriesProfile.driverId, $event)"
                        placeholder="New license points"
                      />
                    }

                    <app-button
                      variant="primary"
                      size="sm"
                      [disabled]="!classSelection()[seriesProfile.driverId]"
                      (onClick)="saveDriverClass(seriesProfile.driverId)"
                    >
                      Save Class
                    </app-button>
                  </div>

                  <div class="space-y-2">
                    <label class="label">Edit License Points</label>
                    <input
                      type="number"
                      class="input"
                      min="0"
                      [ngModel]="pendingLicensePoints()[seriesProfile.driverId] ?? seriesProfile.accumulatedLicensePoints"
                      (ngModelChange)="setPendingLicensePoints(seriesProfile.driverId, $event)"
                    />
                    <app-button variant="secondary" size="sm" (onClick)="saveLicensePoints(seriesProfile.driverId)">
                      Save Points
                    </app-button>
                  </div>
                </div>
              }

              <div class="mt-5">
                <h4 class="font-medium text-gray-900 dark:text-gray-100 mb-2">Penalty History</h4>
                @if (!seriesProfile.penalties.length) {
                  <p class="text-sm text-gray-500 dark:text-gray-400">No finalized penalties found for this series profile.</p>
                } @else {
                  <div class="space-y-2">
                    @for (penalty of seriesProfile.penalties; track penalty.reportId) {
                      <a [routerLink]="['/reports', penalty.reportId]" class="block rounded-md border border-gray-200 dark:border-gray-700 p-3 hover:bg-gray-50 dark:hover:bg-gray-800/60">
                        <div class="flex items-center justify-between gap-3">
                          <div>
                            <p class="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {{ penalty.penaltyName || 'No penalty' }} ({{ penalty.licensePoints }} LP)
                            </p>
                            <p class="text-xs text-gray-500 dark:text-gray-400">
                              {{ penalty.eventName }} - Event {{ penalty.eventNumber }} / Race {{ penalty.raceNumber || '-' }}
                            </p>
                          </div>
                          <span class="text-xs text-gray-500 dark:text-gray-400">{{ formatDate(penalty.finalizedAt) }}</span>
                        </div>
                      </a>
                    }
                  </div>
                }
              </div>
            </app-card>
          }
        </div>
      }
    </div>
  `,
})
export class DriverUserDetailComponent implements OnInit {
  @Input() userId!: string;

  private readonly convex = inject(ConvexService);
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);

  loading = signal(true);
  profile = signal<any>(null);
  selectedDriverIds = signal<string[]>([]);

  classOptionsBySeries = signal<Record<string, any[]>>({});
  classSelection = signal<Record<string, string>>({});
  pendingLicensePoints = signal<Record<string, number>>({});
  adjustPointsOnClassChange = signal<Record<string, boolean>>({});

  visibleProfiles = computed(() => {
    const current = this.profile();
    if (!current) return [];

    const selected = this.selectedDriverIds();
    return current.profiles.filter((seriesProfile: any) => selected.includes(seriesProfile.driverId));
  });

  ngOnInit(): void {
    void this.load();
  }

  canManageProfiles(): boolean {
    return this.authService.hasMinimumRole('event_manager');
  }

  async load(): Promise<void> {
    if (!this.userId) {
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    try {
      const profile = await this.convex.query(this.convex.api.drivers.getUserProfile, {
        userId: this.userId as any,
      });
      this.profile.set(profile);

      if (profile?.profiles?.length) {
        const defaultDriverIds = profile.profiles.slice(0, 2).map((p: any) => p.driverId);
        this.selectedDriverIds.set(defaultDriverIds);
        await this.loadClassOptions(profile.profiles);
      }
    } catch (error) {
      console.error('Failed to load user driver profile:', error);
      this.toast.error('Failed to load user profile');
    } finally {
      this.loading.set(false);
    }
  }

  private async loadClassOptions(seriesProfiles: any[]): Promise<void> {
    const uniqueSeriesIds = [...new Set(seriesProfiles.map((p) => p.seriesId).filter(Boolean))];
    const entries = await Promise.all(
      uniqueSeriesIds.map(async (seriesId) => {
        const options = await this.convex.query(this.convex.api.drivers.getDriverClassesBySeries, {
          seriesId: seriesId as any,
        });
        return [seriesId, options || []] as const;
      }),
    );

    const map: Record<string, any[]> = {};
    for (const [seriesId, options] of entries) {
      map[String(seriesId)] = options;
    }
    this.classOptionsBySeries.set(map);
  }

  toggleDriverSelection(driverId: string): void {
    this.selectedDriverIds.update((current) => {
      if (current.includes(driverId)) {
        return current.filter((id) => id !== driverId);
      }
      return [...current, driverId];
    });
  }

  setClassSelection(driverId: string, classId: string): void {
    this.classSelection.update((state) => ({
      ...state,
      [driverId]: classId,
    }));
  }

  setPendingLicensePoints(driverId: string, value: number | string): void {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return;

    this.pendingLicensePoints.update((state) => ({
      ...state,
      [driverId]: Math.max(0, parsed),
    }));
  }

  setAdjustPoints(driverId: string, value: boolean): void {
    this.adjustPointsOnClassChange.update((state) => ({
      ...state,
      [driverId]: value,
    }));
  }

  async saveDriverClass(driverId: string): Promise<void> {
    const currentUserId = this.authService.getUserId();
    if (!currentUserId) return;

    const classId = this.classSelection()[driverId];
    if (!classId) {
      this.toast.warning('Pick a class first');
      return;
    }

    const shouldAdjustPoints = this.adjustPointsOnClassChange()[driverId] || false;
    const points = this.pendingLicensePoints()[driverId];

    try {
      await this.convex.mutation(this.convex.api.drivers.updateDriverClass, {
        driverId: driverId as any,
        newDriverClassId: classId as any,
        userId: currentUserId,
        adjustLicensePoints: shouldAdjustPoints,
        newLicensePoints: shouldAdjustPoints ? points ?? 0 : undefined,
      });

      this.toast.success('Driver class updated');
      await this.load();
    } catch (error: any) {
      console.error('Failed to update driver class:', error);
      this.toast.error(error?.message || 'Failed to update class');
    }
  }

  async saveLicensePoints(driverId: string): Promise<void> {
    const currentUserId = this.authService.getUserId();
    if (!currentUserId) return;

    const points = this.pendingLicensePoints()[driverId];
    if (points === undefined) {
      this.toast.warning('Enter a points value first');
      return;
    }

    try {
      await this.convex.mutation(this.convex.api.drivers.updateDriverLicensePoints, {
        driverId: driverId as any,
        newPoints: points,
        userId: currentUserId,
      });
      this.toast.success('License points updated');
      await this.load();
    } catch (error: any) {
      console.error('Failed to update license points:', error);
      this.toast.error(error?.message || 'Failed to update points');
    }
  }

  formatDate(value: number): string {
    return new Date(value).toLocaleDateString();
  }
}
