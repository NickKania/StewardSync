import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConvexService } from '@core/services/convex.service';
import { CardComponent } from '@shared/components/card/card.component';
import { ButtonComponent } from '@shared/components/button/button.component';
import { BadgeComponent } from '@shared/components/badge/badge.component';
import { LoadingComponent } from '@shared/components/loading/loading.component';
import { Series, Penalty } from '@core/models/series.model';
import { Id } from '@convex/_generated/dataModel';

@Component({
  selector: 'app-series-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardComponent,
    ButtonComponent,
    BadgeComponent,
    LoadingComponent
  ],
  template: `
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Series Management</h1>
          <p class="text-gray-500 mt-1">Manage racing series and their penalty configurations</p>
        </div>
        <app-button (click)="showSeriesModal = true">
          <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
          </svg>
          Add Series
        </app-button>
      </div>

      <!-- Series List -->
      @if (loading()) {
        <app-loading text="Loading series..." />
      } @else if (series().length > 0) {
        <div class="space-y-4">
          @for (s of series(); track s._id) {
            <app-card>
              <div class="space-y-4">
                <div class="flex items-center justify-between">
                  <div class="flex-1">
                    <h3 class="text-lg font-semibold text-gray-900">{{ s.name }}</h3>
                    @if (s.description) {
                      <p class="text-sm text-gray-500 mt-1">{{ s.description }}</p>
                    }
                    @if (s.simgridLink) {
                      <a
                        [href]="s.simgridLink"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-sm text-primary-600 hover:text-primary-700 mt-1 inline-flex items-center gap-1"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                        </svg>
                        View on SimGrid
                      </a>
                    }
                  </div>
                  <div class="flex gap-2">
                    <app-button variant="secondary" size="sm" (click)="editSeries(s)">
                      Edit
                    </app-button>
                    <app-button variant="danger" size="sm" (click)="deleteSeries(s._id)">
                      Delete
                    </app-button>
                  </div>
                </div>

                <!-- Penalties for this series -->
                <div class="border-t pt-4">
                  <div class="flex items-center justify-between mb-3">
                    <h4 class="text-sm font-medium text-gray-700">Penalties</h4>
                    <app-button variant="secondary" size="sm" (click)="addPenalty(s._id)">
                      <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                      </svg>
                      Add Penalty
                    </app-button>
                  </div>

                  @if (getSeriesPenalties(s._id).length > 0) {
                    <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                      @for (penalty of getSeriesPenalties(s._id); track penalty._id) {
                        <div class="border rounded-lg p-3 bg-gray-50">
                          <div class="flex items-start justify-between mb-2">
                            <span class="font-medium text-sm">{{ penalty.name }}</span>
                            <div class="flex gap-1">
                              <button
                                (click)="editPenalty(penalty)"
                                class="text-gray-400 hover:text-gray-600 p-1"
                              >
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                                </svg>
                              </button>
                              <button
                                (click)="deletePenalty(penalty._id)"
                                class="text-gray-400 hover:text-red-600 p-1"
                              >
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                </svg>
                              </button>
                            </div>
                          </div>
                          <div class="space-y-1 text-xs text-gray-600">
                            <div class="flex justify-between">
                              <span>Time Penalty:</span>
                              <span class="font-medium">{{ penalty.timePenalty }}s</span>
                            </div>
                            <div class="flex justify-between">
                              <span>w/ Self Report:</span>
                              <span class="font-medium">{{ penalty.timePenaltyWithSelfReport }}s</span>
                            </div>
                            <div class="flex justify-between">
                              <span>License Points:</span>
                              <span class="font-medium">{{ penalty.licensePoints }}</span>
                            </div>
                          </div>
                        </div>
                      }
                    </div>
                  } @else {
                    <p class="text-sm text-gray-500 text-center py-4">No penalties configured</p>
                  }
                </div>
              </div>
            </app-card>
          }
        </div>
      } @else {
        <app-card>
          <div class="text-center py-12">
            <p class="text-gray-500">No series found. Create one to get started.</p>
          </div>
        </app-card>
      }

      <!-- Series Modal -->
      @if (showSeriesModal) {
        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div class="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 class="text-lg font-semibold mb-4">{{ editingSeriesId ? 'Edit' : 'Add' }} Series</h3>
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  class="input w-full"
                  [(ngModel)]="seriesForm.name"
                  placeholder="e.g., F1 2024"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                <textarea
                  class="input w-full"
                  rows="3"
                  [(ngModel)]="seriesForm.description"
                  placeholder="Series description..."
                ></textarea>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">SimGrid Link (optional)</label>
                <input
                  type="text"
                  class="input w-full"
                  [(ngModel)]="seriesForm.simgridLink"
                  placeholder="https://..."
                />
              </div>
              <div class="flex gap-2 justify-end">
                <app-button variant="secondary" (click)="closeSeriesModal()">Cancel</app-button>
                <app-button (click)="saveSeries()" [disabled]="!seriesForm.name">
                  {{ editingSeriesId ? 'Update' : 'Create' }}
                </app-button>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- Penalty Modal -->
      @if (showPenaltyModal) {
        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div class="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 class="text-lg font-semibold mb-4">{{ editingPenaltyId ? 'Edit' : 'Add' }} Penalty</h3>
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Penalty Name</label>
                <input
                  type="text"
                  class="input w-full"
                  [(ngModel)]="penaltyForm.name"
                  placeholder="e.g., Track Limits"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Time Penalty (seconds)</label>
                <input
                  type="number"
                  class="input w-full"
                  [(ngModel)]="penaltyForm.timePenalty"
                  placeholder="e.g., 5"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Time Penalty with Self Report (seconds)</label>
                <input
                  type="number"
                  class="input w-full"
                  [(ngModel)]="penaltyForm.timePenaltyWithSelfReport"
                  placeholder="e.g., 3"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">License Points</label>
                <input
                  type="number"
                  class="input w-full"
                  [(ngModel)]="penaltyForm.licensePoints"
                  placeholder="e.g., 2"
                />
              </div>
              <div class="flex gap-2 justify-end">
                <app-button variant="secondary" (click)="closePenaltyModal()">Cancel</app-button>
                <app-button (click)="savePenalty()" [disabled]="!penaltyForm.name">
                  {{ editingPenaltyId ? 'Update' : 'Create' }}
                </app-button>
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class SeriesManagementComponent implements OnInit, OnDestroy {
  private convex = inject(ConvexService);

  series = signal<Series[]>([]);
  penalties = signal<Penalty[]>([]);
  loading = signal(true);

  showSeriesModal = false;
  showPenaltyModal = false;
  editingSeriesId: Id<'series'> | null = null;
  editingPenaltyId: Id<'penalties'> | null = null;

  seriesForm = {
    name: '',
    description: '',
    simgridLink: ''
  };

  penaltyForm = {
    seriesId: '' as Id<'series'> | '',
    name: '',
    timePenalty: 0,
    timePenaltyWithSelfReport: 0,
    licensePoints: 0
  };

  private unsubscribes: (() => void)[] = [];

  ngOnInit(): void {
    this.loadSeries();
    this.loadPenalties();
  }

  ngOnDestroy(): void {
    this.unsubscribes.forEach(unsub => unsub());
  }

  private loadSeries(): void {
    const seriesQuery = this.convex.createReactiveQuery(
      this.convex.api.series.list,
      {}
    );
    this.unsubscribes.push(seriesQuery.unsubscribe);

    const checkSeries = setInterval(() => {
      const data = seriesQuery.data();
      if (data !== undefined) {
        this.series.set(data);
        this.loading.set(false);
      }
    }, 100);
    this.unsubscribes.push(() => clearInterval(checkSeries));
  }

  private loadPenalties(): void {
    const penaltiesQuery = this.convex.createReactiveQuery(
      this.convex.api.penalties.list,
      {}
    );
    this.unsubscribes.push(penaltiesQuery.unsubscribe);

    const checkPenalties = setInterval(() => {
      const data = penaltiesQuery.data();
      if (data !== undefined) {
        // Filter out penalties with null series (shouldn't happen but TypeScript requires it)
        const validPenalties = data.filter((p: any) => p.series !== null).map((p: any) => ({
          ...p,
          series: p.series || undefined
        }));
        this.penalties.set(validPenalties);
      }
    }, 100);
    this.unsubscribes.push(() => clearInterval(checkPenalties));
  }

  getSeriesPenalties(seriesId: Id<'series'>): Penalty[] {
    return this.penalties().filter(p => p.seriesId === seriesId);
  }

  editSeries(series: Series): void {
    this.editingSeriesId = series._id;
    this.seriesForm = {
      name: series.name,
      description: series.description || '',
      simgridLink: series.simgridLink || ''
    };
    this.showSeriesModal = true;
  }

  async saveSeries(): Promise<void> {
    if (this.editingSeriesId) {
      await this.convex.mutation(this.convex.api.series.update, {
        id: this.editingSeriesId,
        name: this.seriesForm.name,
        description: this.seriesForm.description || undefined,
        simgridLink: this.seriesForm.simgridLink || undefined
      });
    } else {
      await this.convex.mutation(this.convex.api.series.create, {
        name: this.seriesForm.name,
        description: this.seriesForm.description || undefined,
        simgridLink: this.seriesForm.simgridLink || undefined
      });
    }
    this.closeSeriesModal();
  }

  async deleteSeries(seriesId: Id<'series'>): Promise<void> {
    if (confirm('Are you sure you want to delete this series? This will fail if there are existing events.')) {
      try {
        await this.convex.mutation(this.convex.api.series.remove, { id: seriesId });
      } catch (error: any) {
        alert(error.message);
      }
    }
  }

  closeSeriesModal(): void {
    this.showSeriesModal = false;
    this.editingSeriesId = null;
    this.seriesForm = { name: '', description: '', simgridLink: '' };
  }

  addPenalty(seriesId: Id<'series'>): void {
    this.penaltyForm.seriesId = seriesId;
    this.showPenaltyModal = true;
  }

  editPenalty(penalty: Penalty): void {
    this.editingPenaltyId = penalty._id;
    this.penaltyForm = {
      seriesId: penalty.seriesId,
      name: penalty.name,
      timePenalty: penalty.timePenalty,
      timePenaltyWithSelfReport: penalty.timePenaltyWithSelfReport,
      licensePoints: penalty.licensePoints
    };
    this.showPenaltyModal = true;
  }

  async savePenalty(): Promise<void> {
    if (this.editingPenaltyId) {
      await this.convex.mutation(this.convex.api.penalties.update, {
        id: this.editingPenaltyId,
        name: this.penaltyForm.name,
        timePenalty: this.penaltyForm.timePenalty,
        timePenaltyWithSelfReport: this.penaltyForm.timePenaltyWithSelfReport,
        licensePoints: this.penaltyForm.licensePoints
      });
    } else {
      if (!this.penaltyForm.seriesId) return;
      await this.convex.mutation(this.convex.api.penalties.create, {
        seriesId: this.penaltyForm.seriesId as Id<'series'>,
        name: this.penaltyForm.name,
        timePenalty: this.penaltyForm.timePenalty,
        timePenaltyWithSelfReport: this.penaltyForm.timePenaltyWithSelfReport,
        licensePoints: this.penaltyForm.licensePoints
      });
    }
    this.closePenaltyModal();
  }

  async deletePenalty(penaltyId: Id<'penalties'>): Promise<void> {
    if (confirm('Are you sure you want to delete this penalty?')) {
      await this.convex.mutation(this.convex.api.penalties.remove, { id: penaltyId });
    }
  }

  closePenaltyModal(): void {
    this.showPenaltyModal = false;
    this.editingPenaltyId = null;
    this.penaltyForm = {
      seriesId: '' as Id<'series'> | '',
      name: '',
      timePenalty: 0,
      timePenaltyWithSelfReport: 0,
      licensePoints: 0
    };
  }
}
