import { Component, inject, OnInit, OnDestroy, signal, Input, computed, untracked } from '@angular/core';
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
import { debounceTime, Subject } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';
import { effect } from '@angular/core';

interface SeriesPenaltyRow {
  _id: string;
  penaltyName: string | null;
  penaltyDescription: string | null;
  threshold: number | null;
  pointsAtAssignment: number;
  assignedAt: number;
  isServed: boolean;
  servedAt?: number;
  servedByUserName: string | null;
}

interface SeriesPenaltyGroup {
  seriesId: string;
  seriesName: string;
  penalties: SeriesPenaltyRow[];
}

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
              <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ driver()?.displayName ?? driver()?.driverName }}</h1>
              @if (driver()?.displayName && driver()?.displayName !== driver()?.driverName) {
                <p class="text-sm text-gray-600 dark:text-gray-300">{{ driver()?.driverName }}</p>
              }
              <div class="flex items-center gap-2 mt-1">
                <app-badge variant="primary">{{ driver()?.driverClass }}</app-badge>
                @if (driver()?.externalId) {
                  <span class="text-sm text-gray-500 dark:text-gray-400">ID: {{ driver()?.externalId }}</span>
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
                <p class="text-3xl font-bold text-gray-900 dark:text-gray-100">{{ stats()?.reportsFiledCount || 0 }}</p>
                <p class="text-sm text-gray-500 mt-1 dark:text-gray-400">Reports Filed</p>
              </div>
            </app-card>
            <app-card>
              <div class="text-center">
                <p class="text-3xl font-bold text-amber-600">{{ stats()?.reportsAgainstCount || 0 }}</p>
                <p class="text-sm text-gray-500 mt-1 dark:text-gray-400">Reports Against</p>
              </div>
            </app-card>
            <app-card>
              <div class="text-center">
                <p class="text-3xl font-bold text-blue-600">{{ stats()?.pendingReports || 0 }}</p>
                <p class="text-sm text-gray-500 mt-1 dark:text-gray-400">Pending</p>
              </div>
            </app-card>
            <app-card>
              <div class="text-center">
                <p class="text-3xl font-bold text-green-600">{{ stats()?.finalizedReports || 0 }}</p>
                <p class="text-sm text-gray-500 mt-1 dark:text-gray-400">Finalized</p>
              </div>
            </app-card>
          </div>
        }

        <!-- Driver info -->
        <app-card title="Driver Information">
          <dl class="grid sm:grid-cols-2 gap-4">
            <div>
              <dt class="text-sm text-gray-500 dark:text-gray-400">Driver Number</dt>
              <dd class="font-medium text-gray-900 dark:text-gray-100">#{{ driver()?.driverNumber }}</dd>
            </div>
            <div>
              <dt class="text-sm text-gray-500 dark:text-gray-400">Full Name</dt>
              <dd class="font-medium text-gray-900 dark:text-gray-100">{{ driver()?.driverName }}</dd>
            </div>
            <div>
              <dt class="text-sm text-gray-500 dark:text-gray-400">Class</dt>
              <dd class="font-medium text-gray-900 dark:text-gray-100">{{ driver()?.driverClass }}</dd>
            </div>
            <div>
              <dt class="text-sm text-gray-500 dark:text-gray-400">Official Name</dt>
              <dd class="font-medium text-gray-900 dark:text-gray-100">
                @if (isEditingOfficialName()) {
                  <div class="flex items-center gap-2">
                    <input
                      type="text"
                      class="input flex-1"
                      [ngModel]="officialNameInput()"
                      (ngModelChange)="officialNameInput.set($event)"
                      [disabled]="officialNameSaving()"
                    />
                    <app-button
                      variant="primary"
                      size="sm"
                      (onClick)="saveOfficialName()"
                      [disabled]="officialNameSaving()"
                    >
                      {{ officialNameSaving() ? 'Saving...' : 'Save' }}
                    </app-button>
                    <app-button
                      variant="secondary"
                      size="sm"
                      (onClick)="cancelEditingOfficialName()"
                      [disabled]="officialNameSaving()"
                    >
                      Cancel
                    </app-button>
                  </div>
                } @else {
                  <div class="flex items-center gap-2">
                    <span>{{ driver()?.officialName ?? driver()?.driverName }}</span>
                    @if (canEditOfficialName()) {
                      <button
                        class="text-primary-600 hover:text-primary-800 text-sm"
                        (click)="startEditingOfficialName()"
                      >
                        Edit
                      </button>
                    }
                  </div>
                }
              </dd>
            </div>
            @if (linkedUser()) {
              <div>
                <dt class="text-sm text-gray-500 dark:text-gray-400">Linked User</dt>
                <dd class="font-medium text-gray-900 dark:text-gray-100">{{ linkedUser()?.name }}</dd>
              </div>
              @if (linkedUser()?.officialName) {
                <div>
                  <dt class="text-sm text-gray-500 dark:text-gray-400">User Official Name</dt>
                  <dd class="font-medium text-gray-900 dark:text-gray-100">{{ linkedUser()?.officialName }}</dd>
                </div>
              }
            }
            @if (driver()?.externalId) {
              <div>
                <dt class="text-sm text-gray-500 dark:text-gray-400">External ID</dt>
                <dd class="font-medium text-gray-900 dark:text-gray-100">{{ driver()?.externalId }}</dd>
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
            } @else if (filteredAndSortedSeriesPenalties().length > 0) {
              <div class="flex items-center gap-4 mb-4">
                <div class="flex-1 max-w-md">
                  <input
                    type="text"
                    class="input w-full"
                    placeholder="Filter by any field..."
                    [(ngModel)]="seriesFilterText"
                  />
                </div>
              </div>
              @for (seriesGroup of filteredAndSortedSeriesPenalties(); track seriesGroup.seriesId) {
                <div class="space-y-4">
                  <div class="flex items-center gap-2 pt-4">
                    <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {{ seriesGroup.seriesName }}
                    </h3>
                  </div>
                  @if (getSeriesPenalties(seriesGroup.seriesId).length > 0) {
                    <div class="overflow-x-auto">
                      <table class="w-full text-sm">
                        <thead class="bg-gray-50 dark:bg-gray-800">
                          <tr class="text-left">
                            <th
                              class="px-4 py-2 font-medium text-gray-500 cursor-pointer hover:text-gray-700 align-middle leading-tight dark:text-gray-400 dark:hover:text-gray-200"
                              (click)="sortSeriesPenalties(seriesGroup.seriesId, 'penaltyName')"
                            >
                              Penalty
                              {{
                                getSortIcon(
                                  'penaltyName',
                                  getSeriesSortColumn(seriesGroup.seriesId),
                                  getSeriesSortDirection(seriesGroup.seriesId)
                                )
                              }}
                            </th>
                            <th
                              class="px-4 py-2 font-medium text-gray-500 cursor-pointer hover:text-gray-700 align-middle leading-tight dark:text-gray-400 dark:hover:text-gray-200"
                              (click)="sortSeriesPenalties(seriesGroup.seriesId, 'threshold')"
                            >
                              Threshold
                              {{
                                getSortIcon(
                                  'threshold',
                                  getSeriesSortColumn(seriesGroup.seriesId),
                                  getSeriesSortDirection(seriesGroup.seriesId)
                                )
                              }}
                            </th>
                            <th
                              class="px-4 py-2 font-medium text-gray-500 cursor-pointer hover:text-gray-700 align-middle leading-tight dark:text-gray-400 dark:hover:text-gray-200"
                              (click)="sortSeriesPenalties(seriesGroup.seriesId, 'pointsAtAssignment')"
                            >
                              Points at Assignment
                              {{
                                getSortIcon(
                                  'pointsAtAssignment',
                                  getSeriesSortColumn(seriesGroup.seriesId),
                                  getSeriesSortDirection(seriesGroup.seriesId)
                                )
                              }}
                            </th>
                            <th
                              class="px-4 py-2 font-medium text-gray-500 cursor-pointer hover:text-gray-700 align-middle leading-tight dark:text-gray-400 dark:hover:text-gray-200"
                              (click)="sortSeriesPenalties(seriesGroup.seriesId, 'assignedAt')"
                            >
                              Assigned Date
                              {{
                                getSortIcon(
                                  'assignedAt',
                                  getSeriesSortColumn(seriesGroup.seriesId),
                                  getSeriesSortDirection(seriesGroup.seriesId)
                                )
                              }}
                            </th>
                            <th
                              class="px-4 py-2 font-medium text-gray-500 cursor-pointer hover:text-gray-700 align-middle leading-tight dark:text-gray-400 dark:hover:text-gray-200"
                              (click)="sortSeriesPenalties(seriesGroup.seriesId, 'isServed')"
                            >
                              Status
                              {{
                                getSortIcon(
                                  'isServed',
                                  getSeriesSortColumn(seriesGroup.seriesId),
                                  getSeriesSortDirection(seriesGroup.seriesId)
                                )
                              }}
                            </th>
                            <th class="px-4 py-2 font-medium text-gray-500 align-middle leading-tight dark:text-gray-400">Actions</th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
                          @for (
                            penalty of getSeriesPenalties(seriesGroup.seriesId);
                            track penalty._id
                          ) {
                            <tr class="hover:bg-gray-50 dark:hover:bg-gray-800">
                              <td class="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{{ penalty.penaltyName ?? '-' }}</td>
                              <td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ penalty.threshold ?? '-' }} pts</td>
                              <td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ penalty.pointsAtAssignment }} pts</td>
                              <td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ formatDate(penalty.assignedAt) }}</td>
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
                                  <span class="text-sm text-gray-500 dark:text-gray-400">
                                    By {{ penalty.servedByUserName }} on {{ formatDate(penalty.servedAt!) }}
                                  </span>
                                }
                              </td>
                            </tr>
                          }
                        </tbody>
                      </table>
                    </div>
                  } @else {
                    <p class="text-gray-500 text-center py-4 dark:text-gray-400">No penalties for this series</p>
                  }
                </div>
              }
            } @else if (selectedSeriesId || seriesOptions().length === 1) {
              <p class="text-gray-500 text-center py-4 dark:text-gray-400">No series penalties assigned to this driver</p>
            } @else {
              <p class="text-gray-500 text-center py-4 dark:text-gray-400">Select a series to view penalties</p>
            }
          </div>
        </app-card>
      } @else {
        <app-card>
          <div class="text-center py-12">
            <p class="text-gray-500 dark:text-gray-400">Driver not found</p>
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
  private destroyRef = inject(DestroyRef);

  driver = signal<any>(null);
  stats = signal<any>(null);
  loading = signal(true);

  // Official name editing
  linkedUser = signal<any>(null);
  officialNameInput = signal('');
  isEditingOfficialName = signal(false);
  officialNameSaving = signal(false);

  penalties = signal<DriverSeriesPenaltyDetails[]>([]);
  penaltiesLoading = signal(false);
  selectedSeriesId = '';

  series = signal<any[]>([]);

  seriesFilterText = signal('');
  seriesSortColumn = signal<Record<string, keyof SeriesPenaltyRow>>({});
  seriesSortDirection = signal<Record<string, 'asc' | 'desc'>>({});
  private seriesFilterSubject = new Subject<string>();

  private unsubscribes: (() => void)[] = [];

  private seriesFilterEffect = effect(
    () => {
      const filterText = this.seriesFilterText();
      this.seriesFilterSubject.next(filterText);
    },
    { allowSignalWrites: true },
  );

  groupedPenalties = computed((): SeriesPenaltyGroup[] => {
    const penalties = this.penalties();
    const grouped: Record<string, SeriesPenaltyGroup> = {};

    for (const penalty of penalties) {
      const seriesId = penalty.seriesId as string;
      const seriesName = penalty.seriesName ?? 'Unknown Series';

      if (!grouped[seriesId]) {
        grouped[seriesId] = {
          seriesId,
          seriesName,
          penalties: [],
        };
      }

      grouped[seriesId].penalties.push({
        _id: penalty._id as string,
        penaltyName: penalty.penaltyName,
        penaltyDescription: penalty.penaltyDescription,
        threshold: penalty.threshold,
        pointsAtAssignment: penalty.pointsAtAssignment,
        assignedAt: penalty.assignedAt,
        isServed: penalty.isServed,
        servedAt: penalty.servedAt,
        servedByUserName: penalty.servedByUserName,
      });
    }

    return Object.values(grouped);
  });

  filteredAndSortedSeriesPenalties = computed(() => {
    let groups = this.groupedPenalties();

    if (this.selectedSeriesId) {
      groups = groups.filter(g => g.seriesId === this.selectedSeriesId);
    }

    if (this.seriesFilterText()) {
      const filter = this.seriesFilterText().toLowerCase();

      groups = groups.map(group => ({
        ...group,
        penalties: group.penalties.filter(penalty => {
          const penaltyName = penalty.penaltyName?.toLowerCase() ?? '';
          const penaltyDescription = penalty.penaltyDescription?.toLowerCase() ?? '';
          const threshold = penalty.threshold?.toString() ?? '';
          const points = penalty.pointsAtAssignment?.toString() ?? '';
          const assignedDate = new Date(penalty.assignedAt).toLocaleDateString().toLowerCase();
          const status = penalty.isServed ? 'served' : 'active';

          return (
            penaltyName.includes(filter) ||
            penaltyDescription.includes(filter) ||
            threshold.includes(filter) ||
            points.includes(filter) ||
            assignedDate.includes(filter) ||
            status.includes(filter)
          );
        }),
      }));
    }

    return groups;
  });

  ngOnInit(): void {
    this.setupFilterDebounce();
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
        this.convex.api.drivers.getByIdWithUser,
        { driverId: this.id as any }
      );

      this.driver.set(driver);

      if (driver) {
        // Set linked user info
        this.linkedUser.set(driver.linkedUser);

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
      this.convex.api.series.listActive,
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

  canEditOfficialName(): boolean {
    return this.authService.hasMinimumRole('event_manager');
  }

  startEditingOfficialName(): void {
    const currentName = this.driver()?.officialName ?? this.driver()?.driverName ?? '';
    this.officialNameInput.set(currentName);
    this.isEditingOfficialName.set(true);
  }

  cancelEditingOfficialName(): void {
    this.isEditingOfficialName.set(false);
  }

  async saveOfficialName(): Promise<void> {
    const driverId = this.driver()?._id;
    const userId = this.authService.getUserId();
    if (!driverId || !userId) return;

    this.officialNameSaving.set(true);
    try {
      await this.convex.mutation(
        this.convex.api.drivers.updateOfficialName,
        {
          driverId: driverId,
          officialName: this.officialNameInput(),
          userId: userId
        }
      );

      // Reload driver data to reflect changes
      await this.loadDriver();
      this.isEditingOfficialName.set(false);
    } catch (error) {
      console.error('Failed to save official name:', error);
    } finally {
      this.officialNameSaving.set(false);
    }
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

  private setupFilterDebounce(): void {
    this.seriesFilterSubject
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
      });
  }

  getSeriesPenalties(seriesId: string): SeriesPenaltyRow[] {
    const group = this.filteredAndSortedSeriesPenalties().find(g => g.seriesId === seriesId);
    if (!group) return [];

    const column = this.getSeriesSortColumn(seriesId);
    const direction = this.getSeriesSortDirection(seriesId);

    if (!column) return group.penalties;

    return [...group.penalties].sort((a, b) => {
      const aVal = a[column] ?? '';
      const bVal = b[column] ?? '';

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return direction === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return direction === 'asc' ? aVal - bVal : bVal - aVal;
      }

      if (typeof aVal === 'boolean' && typeof bVal === 'boolean') {
        return direction === 'asc' ? (aVal ? 1 : 0) - (bVal ? 1 : 0) : (bVal ? 1 : 0) - (aVal ? 1 : 0);
      }

      return 0;
    });
  }

  getSeriesSortColumn(seriesId: string): keyof SeriesPenaltyRow | '' {
    return this.seriesSortColumn()[seriesId] ?? '';
  }

  getSeriesSortDirection(seriesId: string): 'asc' | 'desc' {
    return this.seriesSortDirection()[seriesId] ?? 'asc';
  }

  sortSeriesPenalties(seriesId: string, column: keyof SeriesPenaltyRow): void {
    const currentSortColumn = this.seriesSortColumn();
    const currentSortDirection = this.seriesSortDirection();

    const newDirection =
      currentSortColumn[seriesId] === column
        ? currentSortDirection[seriesId] === 'asc'
          ? 'desc'
          : 'asc'
        : 'asc';

    untracked(() => {
      this.seriesSortColumn.update((state) => ({
        ...state,
        [seriesId]: column,
      }));

      this.seriesSortDirection.update((state) => ({
        ...state,
        [seriesId]: newDirection,
      }));
    });
  }

  getSortIcon(column: string, activeColumn: string, direction: string): string {
    if (column !== activeColumn) return '→';
    return direction === 'asc' ? '↑' : '↓';
  }
}
