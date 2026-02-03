import {
  Component,
  inject,
  OnInit,
  OnDestroy,
  signal,
  computed,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ConvexService } from "@core/services/convex.service";
import { CardComponent } from "@shared/components/card/card.component";
import { ButtonComponent } from "@shared/components/button/button.component";
import { BadgeComponent } from "@shared/components/badge/badge.component";
import { LoadingComponent } from "@shared/components/loading/loading.component";
import {
  MultiSelectComponent,
  MultiSelectOption,
} from "@shared/components/multi-select/multi-select.component";
import {
  Series,
  Penalty,
  SeriesPenalty,
  SeriesPenaltyThreshold,
} from "@core/models/series.model";
import { DriverClass } from "@core/models/driver.model";
import { Id } from "@convex/_generated/dataModel";

@Component({
  selector: "app-series-management",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardComponent,
    ButtonComponent,
    BadgeComponent,
    LoadingComponent,
    MultiSelectComponent,
  ],
  template: `
    <div class="space-y-6">
      <!-- Header -->
      <div
        class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Series Management
          </h1>
          <p class="text-gray-500 mt-1 dark:text-gray-400">
            Manage racing series and their penalty configurations
          </p>
        </div>
        <app-button (click)="showSeriesModal = true">
          <svg
            class="w-5 h-5 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 4v16m8-8H4"
            ></path>
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
                    <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {{ s.name }}
                      @if (s.isActive === false) {
                        <app-badge variant="default" class="ml-2"
                          >Inactive</app-badge
                        >
                      }
                    </h3>
                    @if (s.description) {
                      <p class="text-sm text-gray-500 mt-1 dark:text-gray-400">
                        {{ s.description }}
                      </p>
                    }
                    @if (s.simgridLink) {
                      <a
                        [href]="s.simgridLink"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-sm text-primary-600 hover:text-primary-700 mt-1 inline-flex items-center gap-1"
                      >
                        <svg
                          class="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                          ></path>
                        </svg>
                        View on SimGrid
                      </a>
                    }
                  </div>
                  <div class="flex gap-2">
                    <app-button
                      variant="secondary"
                      size="sm"
                      (click)="editSeries(s)"
                    >
                      Edit
                    </app-button>
                    @if (s.simgridLink) {
                      <app-button
                        variant="secondary"
                        size="sm"
                        (click)="importEvents(s._id)"
                        [disabled]="importing()"
                      >
                        <svg
                          class="w-4 h-4 mr-1"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                          ></path>
                        </svg>
                        {{ importing() ? "Importing..." : "Import Events" }}
                      </app-button>
                      <app-button
                        variant="secondary"
                        size="sm"
                        (click)="importDrivers(s._id)"
                        [disabled]="importing()"
                      >
                        <svg
                          class="w-4 h-4 mr-1"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                          ></path>
                        </svg>
                        {{ importing() ? "Importing..." : "Import Drivers" }}
                      </app-button>
                    }
                    <app-button
                      variant="danger"
                      size="sm"
                      (click)="deleteSeries(s._id)"
                    >
                      Delete
                    </app-button>
                  </div>
                </div>

                <!-- Penalties for this series -->
                <div class="border-t pt-4 dark:border-gray-700">
                  <div class="flex items-center justify-between mb-3">
                    <h4
                      class="text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      Penalties
                    </h4>
                    <app-button
                      variant="secondary"
                      size="sm"
                      (click)="addPenalty(s._id)"
                    >
                      <svg
                        class="w-4 h-4 mr-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M12 4v16m8-8H4"
                        ></path>
                      </svg>
                      Add Penalty
                    </app-button>
                  </div>

                  @if (getSeriesPenalties(s._id).length > 0) {
                    <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                      @for (
                        penalty of getSeriesPenalties(s._id);
                        track penalty._id
                      ) {
                        <div
                          class="border rounded-lg p-3 bg-gray-50 dark:bg-gray-800 dark:border-gray-700"
                        >
                          <div class="flex items-start justify-between mb-2">
                            <span
                              class="font-medium text-sm dark:text-gray-100"
                              >{{ penalty.name }}</span
                            >
                            <div class="flex gap-1">
                              <button
                                (click)="editPenalty(penalty)"
                                class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 dark:text-gray-500"
                              >
                                <svg
                                  class="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                  ></path>
                                </svg>
                              </button>
                              <button
                                (click)="deletePenalty(penalty._id)"
                                class="text-gray-400 hover:text-red-600 p-1 dark:text-gray-500"
                              >
                                <svg
                                  class="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                  ></path>
                                </svg>
                              </button>
                            </div>
                          </div>
                          <div
                            class="space-y-1 text-xs text-gray-600 dark:text-gray-400"
                          >
                            <div class="flex justify-between">
                              <span>Time Penalty:</span>
                              <span class="font-medium"
                                >{{ penalty.timePenalty }}s</span
                              >
                            </div>
                            <div class="flex justify-between">
                              <span>Lap 1 Time:</span>
                              <span class="font-medium"
                                >{{ penalty.timePenaltyLap1 }}s</span
                              >
                            </div>
                            <div class="flex justify-between">
                              <span>Self-Report Reduction:</span>
                              <span class="font-medium"
                                >{{ penalty.selfReportReduction ?? 0 }}s</span
                              >
                            </div>
                            <div class="flex justify-between">
                              <span>License Points:</span>
                              <span class="font-medium">{{
                                penalty.licensePoints
                              }}</span>
                            </div>
                          </div>
                        </div>
                      }
                    </div>
                  } @else {
                    <p
                      class="text-sm text-gray-500 text-center py-4 dark:text-gray-400"
                    >
                      No penalties configured
                    </p>
                  }
                </div>

                <!-- Series Penalties for this series -->
                <div class="border-t pt-4 dark:border-gray-700">
                  <div class="flex items-center justify-between mb-3">
                    <h4
                      class="text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      Series Penalties
                    </h4>
                    <app-button
                      variant="secondary"
                      size="sm"
                      (click)="addSeriesPenalty(s._id)"
                    >
                      <svg
                        class="w-4 h-4 mr-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M12 4v16m8-8H4"
                        ></path>
                      </svg>
                      Add Series Penalty
                    </app-button>
                  </div>

                  @if (getSeriesPenaltiesBySeries(s._id).length > 0) {
                    <div class="space-y-3">
                      @for (
                        sp of getSeriesPenaltiesBySeries(s._id);
                        track sp._id
                      ) {
                        <div
                          class="border rounded-lg p-3 bg-gray-50 dark:bg-gray-800 dark:border-gray-700"
                        >
                          <div class="flex items-start justify-between mb-2">
                            <div class="flex-1">
                              <span
                                class="font-medium text-sm dark:text-gray-100"
                                >{{ sp.penaltyName }}</span
                              >
                              @if (sp.penaltyDescription) {
                                <p
                                  class="text-xs text-gray-600 dark:text-gray-400 mt-1"
                                >
                                  {{ sp.penaltyDescription }}
                                </p>
                              }
                            </div>
                            <div class="flex gap-1 ml-2">
                              <button
                                (click)="editSeriesPenalty(sp)"
                                class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 dark:text-gray-500"
                              >
                                <svg
                                  class="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                  ></path>
                                </svg>
                              </button>
                              <button
                                (click)="deleteSeriesPenalty(sp._id)"
                                class="text-gray-400 hover:text-red-600 p-1 dark:text-gray-500"
                              >
                                <svg
                                  class="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                  ></path>
                                </svg>
                              </button>
                            </div>
                          </div>
                          @if (sp.thresholds && sp.thresholds.length > 0) {
                            <div
                              class="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700"
                            >
                              <p
                                class="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2"
                              >
                                Thresholds:
                              </p>
                              <div class="space-y-1">
                                @for (
                                  threshold of sp.thresholds;
                                  track threshold._id
                                ) {
                                  <div
                                    class="flex flex-wrap items-center gap-1"
                                  >
                                    <app-badge variant="danger">
                                      {{ threshold.threshold }} pts
                                    </app-badge>
                                    <span class="text-xs text-gray-500 dark:text-gray-400"
                                      >for:</span
                                    >
                                    @for (
                                      driverClass of threshold.driverClassObjects;
                                      track driverClass._id
                                    ) {
                                      <app-badge variant="default" size="sm">
                                        {{
                                          driverClass.displayName ||
                                            driverClass.className ||
                                            "Unknown"
                                        }}
                                      </app-badge>
                                    }
                                  </div>
                                }
                              </div>
                            </div>
                          }
                        </div>
                      }
                    </div>
                  } @else {
                    <p
                      class="text-sm text-gray-500 text-center py-4 dark:text-gray-400"
                    >
                      No series penalties configured
                    </p>
                  }
                </div>

                <!-- Driver Classes Management -->
                <div class="border-t pt-4 dark:border-gray-700">
                  <div class="flex items-center justify-between mb-3">
                    <h4
                      class="text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      Driver Classes
                    </h4>
                    <app-button
                      variant="secondary"
                      size="sm"
                      (click)="loadDriverClassesForManagement(s._id)"
                    >
                      <svg
                        class="w-4 h-4 mr-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                        ></path>
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        ></path>
                      </svg>
                      Manage Classes
                    </app-button>
                  </div>

                  @if (getDriverClassesBySeries(s._id).length > 0) {
                    <div
                      class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2"
                    >
                      @for (
                        driverClass of getDriverClassesBySeries(s._id);
                        track driverClass._id
                      ) {
                        <div
                          class="flex items-center justify-between px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm"
                        >
                          <span class="text-gray-700 dark:text-gray-300">{{
                            driverClass.displayName
                          }}</span>
                          <span class="text-xs text-gray-500 dark:text-gray-400"
                            >({{ driverClass.driversCount }} drivers)</span
                          >
                        </div>
                      }
                    </div>
                  } @else {
                    <p
                      class="text-sm text-gray-500 text-center py-4 dark:text-gray-400"
                    >
                      No driver classes found
                    </p>
                  }
                </div>
              </div>
            </app-card>
          }
        </div>
      } @else {
        <app-card>
          <div class="text-center py-12">
            <p class="text-gray-500 dark:text-gray-400">
              No series found. Create one to get started.
            </p>
          </div>
        </app-card>
      }

      <!-- Series Modal -->
      @if (showSeriesModal) {
        <div
          class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        >
          <div class="bg-white rounded-lg p-6 w-full max-w-md dark:bg-gray-800">
            <h3 class="text-lg font-semibold mb-4 dark:text-gray-100">
              {{ editingSeriesId ? "Edit" : "Add" }} Series
            </h3>
            <div class="space-y-4">
              <div>
                <label
                  class="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300"
                  >Name</label
                >
                <input
                  type="text"
                  class="input w-full"
                  [(ngModel)]="seriesForm.name"
                  placeholder="e.g., F1 2024"
                />
              </div>
              <div>
                <label
                  class="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300"
                  >Description (optional)</label
                >
                <textarea
                  class="input w-full"
                  rows="3"
                  [(ngModel)]="seriesForm.description"
                  placeholder="Series description..."
                ></textarea>
              </div>
              <div>
                <label
                  class="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300"
                  >SimGrid Link (optional)</label
                >
                <input
                  type="text"
                  class="input w-full"
                  [(ngModel)]="seriesForm.simgridLink"
                  placeholder="https://..."
                />
              </div>
              <div>
                <label
                  class="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300"
                  >Reporting Opens At (optional)</label
                >
                <input
                  type="time"
                  class="input w-full"
                  [(ngModel)]="seriesForm.reportingOpenTime"
                  placeholder="e.g., 18:00"
                />
                <p class="text-xs text-gray-500 mt-1 dark:text-gray-400">
                  Time in 24-hour UTC format (HH:MM). Reporting opens at this
                  UTC time on the event date.
                </p>
              </div>
              <div>
                <label
                  class="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300"
                  >Reporting Window Duration (hours) (optional)</label
                >
                <input
                  type="number"
                  class="input w-full"
                  [(ngModel)]="seriesForm.reportingCloseDuration"
                  placeholder="e.g., 24"
                  min="1"
                />
                <p class="text-xs text-gray-500 mt-1 dark:text-gray-400">
                  Number of hours reporting remains open. Leave empty for
                  unrestricted access.
                </p>
              </div>
              <div>
                <label class="flex items-center gap-2">
                  <input
                    type="checkbox"
                    [(ngModel)]="seriesForm.isReportingLocked"
                    class="rounded border-gray-300 dark:border-gray-700"
                  />
                  <span
                    class="text-sm font-medium text-gray-700 dark:text-gray-300"
                    >Lock Reports</span
                  >
                </label>
                <p class="text-xs text-gray-500 mt-1 dark:text-gray-400">
                  Prevent all users from creating reports for this series.
                  Stewards will also be blocked.
                </p>
              </div>
              <div>
                <label class="flex items-center gap-2">
                  <input
                    type="checkbox"
                    [(ngModel)]="seriesForm.isActive"
                    class="rounded border-gray-300 dark:border-gray-700"
                  />
                  <span
                    class="text-sm font-medium text-gray-700 dark:text-gray-300"
                    >Active</span
                  >
                </label>
                <p class="text-xs text-gray-500 mt-1 dark:text-gray-400">
                  When unchecked, this series will not appear in any series
                  dropdowns throughout the application.
                </p>
              </div>
              <div class="flex gap-2 justify-end">
                <app-button variant="secondary" (click)="closeSeriesModal()"
                  >Cancel</app-button
                >
                <app-button
                  (click)="saveSeries()"
                  [disabled]="!seriesForm.name"
                >
                  {{ editingSeriesId ? "Update" : "Create" }}
                </app-button>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- Penalty Modal -->
      @if (showPenaltyModal) {
        <div
          class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        >
          <div class="bg-white rounded-lg p-6 w-full max-w-md dark:bg-gray-800">
            <h3 class="text-lg font-semibold mb-4 dark:text-gray-100">
              {{ editingPenaltyId ? "Edit" : "Add" }} Penalty
            </h3>
            <div class="space-y-4">
              <div>
                <label
                  class="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300"
                  >Penalty Name</label
                >
                <input
                  type="text"
                  class="input w-full"
                  [(ngModel)]="penaltyForm.name"
                  placeholder="e.g., Track Limits"
                />
              </div>
              <div>
                <label
                  class="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300"
                  >Time Penalty (seconds)</label
                >
                <input
                  type="number"
                  class="input w-full"
                  [(ngModel)]="penaltyForm.timePenalty"
                  placeholder="e.g., 5"
                />
              </div>
              <div>
                <label
                  class="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300"
                  >Self-Report Reduction (seconds)</label
                >
                <input
                  type="number"
                  class="input w-full"
                  [(ngModel)]="penaltyForm.selfReportReduction"
                  placeholder="e.g., 5"
                  min="0"
                />
                <p class="text-xs text-gray-500 mt-1 dark:text-gray-400">
                  Seconds subtracted from time penalties if driver self-reported
                </p>
              </div>
              <div>
                <label
                  class="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300"
                  >Lap 1 Time Penalty (seconds)</label
                >
                <input
                  type="number"
                  class="input w-full"
                  [(ngModel)]="penaltyForm.timePenaltyLap1"
                  placeholder="e.g., 5"
                />
                <p class="text-xs text-gray-500 mt-1 dark:text-gray-400">
                  Defaults to primary time penalty if not specified
                </p>
              </div>
              <div>
                <label
                  class="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300"
                  >License Points</label
                >
                <input
                  type="number"
                  class="input w-full"
                  [(ngModel)]="penaltyForm.licensePoints"
                  placeholder="e.g., 2"
                />
              </div>
              <div class="flex gap-2 justify-end">
                <app-button variant="secondary" (click)="closePenaltyModal()"
                  >Cancel</app-button
                >
                <app-button
                  (click)="savePenalty()"
                  [disabled]="!penaltyForm.name"
                >
                  {{ editingPenaltyId ? "Update" : "Create" }}
                </app-button>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- Series Penalty Modal -->
      @if (showSeriesPenaltyModal) {
        <div
          class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        >
          <div
            class="bg-white rounded-lg w-full max-w-2xl dark:bg-gray-800 flex flex-col max-h-[90vh]"
          >
            <div class="p-6 border-b dark:border-gray-700">
              <h3 class="text-lg font-semibold dark:text-gray-100">
                {{ editingSeriesPenaltyId ? "Edit" : "Add" }} Series Penalty
              </h3>
            </div>
            <div class="flex-1 overflow-y-auto p-6 space-y-5">
              <div>
                <label class="label">Penalty Name</label>
                <input
                  type="text"
                  class="input w-full"
                  [(ngModel)]="seriesPenaltyForm.penaltyName"
                  placeholder="e.g., Race Ban"
                />
              </div>
              <div>
                <label class="label">Description (optional)</label>
                <textarea
                  class="input w-full"
                  rows="3"
                  [(ngModel)]="seriesPenaltyForm.penaltyDescription"
                  placeholder="Penalty description..."
                ></textarea>
              </div>

              <div class="border-t pt-5 dark:border-gray-700">
                <div class="flex items-center justify-between mb-3">
                  <label
                    class="block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >License Points Thresholds</label
                  >
                  <app-button
                    variant="secondary"
                    size="sm"
                    (click)="addThreshold()"
                    [disabled]="loadingDriverClasses"
                  >
                    <svg
                      class="w-4 h-4 mr-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M12 4v16m8-8H4"
                      ></path>
                    </svg>
                    Add Threshold
                  </app-button>
                </div>
                @if (loadingDriverClasses) {
                  <app-loading text="Loading driver classes..." />
                } @else {
                  @if (thresholds.length === 0) {
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                      No thresholds added. Add at least one threshold.
                    </p>
                  }
                  @for (threshold of thresholds; track threshold.id) {
                    <div
                      class="border rounded-lg p-4 bg-gray-50 dark:bg-gray-900 dark:border-gray-700 mb-3"
                    >
                      <div class="flex justify-between items-start mb-3">
                        <div class="flex-1 mr-4">
                          <label class="label">Threshold (points)</label>
                          <input
                            type="number"
                            class="input w-full"
                            [(ngModel)]="threshold.threshold"
                            placeholder="e.g., 10"
                            min="1"
                          />
                        </div>
                        <button
                          (click)="removeThreshold(threshold.id || '')"
                          class="text-gray-400 hover:text-red-600 p-1 dark:text-gray-500"
                          type="button"
                        >
                          <svg
                            class="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M6 18L18 6M6 6l12 12"
                            ></path>
                          </svg>
                        </button>
                      </div>
                      <div>
                        <label class="label">Driver Classes</label>
                        <app-multi-select
                          [label]="''"
                          [placeholder]="
                            'Select driver classes for this threshold'
                          "
                          [options]="
                            getDriverClassOptions(
                              threshold.selectedDriverClasses
                            )
                          "
                          (selectionChange)="
                            onThresholdClassesChange(threshold.id || '', $event)
                          "
                        />
                      </div>
                    </div>
                  }
                }
              </div>
            </div>
            <div
              class="p-6 border-t dark:border-gray-700 flex gap-2 justify-end"
            >
              <app-button
                variant="secondary"
                (click)="closeSeriesPenaltyModal()"
                >Cancel</app-button
              >
              <app-button
                (click)="saveSeriesPenalty()"
                [disabled]="
                  !seriesPenaltyForm.penaltyName || thresholds.length === 0
                "
              >
                {{ editingSeriesPenaltyId ? "Update" : "Create" }}
              </app-button>
            </div>
          </div>
        </div>
      }

      <!-- Driver Class Management Modal -->
      @if (showDriverClassModal) {
        <div
          class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          (click)="closeDriverClassModal()"
        >
          <div
            class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl m-4"
            (click)="$event.stopPropagation()"
          >
            <div
              class="p-6 border-b dark:border-gray-700 flex justify-between items-center"
            >
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                Manage Driver Classes
              </h3>
              <button
                (click)="closeDriverClassModal()"
                class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 dark:text-gray-500"
              >
                <svg
                  class="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M6 18L18 6M6 6l12 12"
                  ></path>
                </svg>
              </button>
            </div>

            <div class="p-6 space-y-4">
              @if (loadingDriverClasses) {
                <app-loading text="Loading driver classes..." />
              } @else if (driverClassesForManagement().length === 0) {
                <p class="text-gray-500 text-center py-4 dark:text-gray-400">
                  No driver classes found for this series.
                </p>
              } @else {
                <div class="space-y-3">
                  @for (
                    driverClass of driverClassesForManagement();
                    track driverClass._id
                  ) {
                    <div
                      class="border rounded-lg p-4 bg-gray-50 dark:bg-gray-800 dark:border-gray-700"
                    >
                      <div class="flex items-center justify-between">
                        <div class="flex-1">
                          <div class="flex items-center gap-2 mb-1">
                            <span
                              class="font-medium text-gray-700 dark:text-gray-300"
                              >{{ driverClass.className }}</span
                            >
                            <span class="text-xs text-gray-500 dark:text-gray-400"
                              >({{ driverClass.driversCount }} drivers)</span
                            >
                          </div>

                          @if (editingDriverClassId === driverClass._id) {
                            <div class="mt-2 space-y-3">
                              <div
                                class="text-sm text-gray-600 dark:text-gray-400"
                              >
                                Class Name:
                                <span
                                  class="font-medium text-gray-900 dark:text-gray-100"
                                  >{{ driverClass.className }}</span
                                >
                              </div>
                              <div>
                                <label
                                  class="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300"
                                  >Display Name</label
                                >
                                <div class="flex gap-2">
                                  <input
                                    type="text"
                                    class="input flex-1"
                                    [(ngModel)]="editingDriverClassName"
                                    placeholder="Display name"
                                  />
                                  <app-button
                                    variant="secondary"
                                    size="sm"
                                    (click)="cancelEditDriverClass()"
                                    >Cancel</app-button
                                  >
                                  <app-button
                                    size="sm"
                                    (click)="saveDriverClassDisplayName()"
                                    >Save</app-button
                                  >
                                </div>
                              </div>
                            </div>
                          } @else {
                            <p class="text-sm text-gray-600 dark:text-gray-400">
                              Display:
                              <span class="font-medium">{{
                                driverClass.displayName
                              }}</span>
                            </p>
                          }
                        </div>

                        @if (editingDriverClassId !== driverClass._id) {
                          <button
                            (click)="editDriverClass(driverClass)"
                            class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-2 dark:text-gray-500"
                          >
                            <svg
                              class="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              ></path>
                            </svg>
                          </button>
                        }
                      </div>
                    </div>
                  }
                </div>
              }
            </div>

            <div class="p-6 border-t dark:border-gray-700 flex justify-end">
              <app-button variant="secondary" (click)="closeDriverClassModal()"
                >Close</app-button
              >
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class SeriesManagementComponent implements OnInit, OnDestroy {
  private convex = inject(ConvexService);

  series = signal<Series[]>([]);
  penalties = signal<Penalty[]>([]);
  seriesPenalties = signal<SeriesPenalty[]>([]);
  availableDriverClasses = signal<DriverClass[]>([]);
  seriesPenaltyThresholds = signal<Map<string, any[]>>(new Map());
  loading = signal(true);

  showSeriesModal = false;
  showPenaltyModal = false;
  showSeriesPenaltyModal = false;
  showSeriesPenaltyThresholdModal = false;
  editingSeriesId: Id<"series"> | null = null;
  editingPenaltyId: Id<"penalties"> | null = null;
  editingSeriesPenaltyId: Id<"seriesPenalties"> | null = null;
  editingSeriesPenaltyThresholdId: Id<"seriesPenaltyThresholds"> | null = null;
  isEditingThresholds = false;

  seriesForm = {
    name: "",
    description: "",
    simgridLink: "",
    reportingOpenTime: "",
    reportingCloseDuration: 0,
    isReportingLocked: false,
    isActive: true,
  };

  penaltyForm = {
    seriesId: "" as Id<"series"> | "",
    name: "",
    timePenalty: 0,
    selfReportReduction: 0,
    timePenaltyLap1: 0,
    licensePoints: 0,
  };

  seriesPenaltyForm = {
    seriesId: "" as Id<"series"> | "",
    penaltyName: "",
    penaltyDescription: "",
  };

  seriesPenaltyThresholdForm = {
    driverClass: "",
    threshold: 0,
  };

  selectedDriverClasses = signal<MultiSelectOption[]>([]);
  classThresholds: Record<string, number> = {};
  loadingDriverClasses = false;

  // Driver Class Management
  showDriverClassModal = false;
  editingDriverClassSeriesId: Id<"series"> | null = null;
  driverClassesForManagement = signal<any[]>([]);
  editingDriverClassId: Id<"driverClasses"> | null = null;
  editingDriverClassName = "";

  // Driver classes by series for main page display
  driverClassesBySeries = signal<Map<Id<"series">, any[]>>(new Map());
  private driverClassesSubscriptions: Map<Id<"series">, () => void> = new Map();

  thresholds: Array<{
    id?: string;
    threshold: number;
    selectedDriverClasses: string[];
  }> = [];

  selectedClassCount = computed(
    () => this.selectedDriverClasses().filter((opt) => opt.selected).length,
  );

  selectedClasses = computed(() =>
    this.selectedDriverClasses().filter((opt) => opt.selected),
  );

  private unsubscribes: (() => void)[] = [];
  importing = signal(false);
  importResult = signal<{ created: number; skipped: number } | null>(null);

  ngOnInit(): void {
    this.loadSeries();
    this.loadPenalties();
    this.loadSeriesPenalties();
  }

  ngOnDestroy(): void {
    this.unsubscribes.forEach((unsub) => unsub());
  }

  private loadSeries(): void {
    const seriesQuery = this.convex.createReactiveQuery(
      this.convex.api.series.list,
      {},
    );
    this.unsubscribes.push(seriesQuery.unsubscribe);

    const checkSeries = setInterval(() => {
      const data = seriesQuery.data();
      if (data !== undefined) {
        this.series.set(data);
        this.loading.set(false);

        // Subscribe to driver classes for each series
        data.forEach((s: Series) => {
          this.subscribeToDriverClassesForSeries(s._id);
        });
      }
    }, 100);
    this.unsubscribes.push(() => clearInterval(checkSeries));
  }

  private loadPenalties(): void {
    const penaltiesQuery = this.convex.createReactiveQuery(
      this.convex.api.penalties.list,
      {},
    );
    this.unsubscribes.push(penaltiesQuery.unsubscribe);

    const checkPenalties = setInterval(() => {
      const data = penaltiesQuery.data();
      if (data !== undefined) {
        // Filter out penalties with null series (shouldn't happen but TypeScript requires it)
        const validPenalties = data
          .filter((p: any) => p.series !== null)
          .map((p: any) => ({
            ...p,
            series: p.series || undefined,
          }));
        this.penalties.set(validPenalties);
      }
    }, 100);
    this.unsubscribes.push(() => clearInterval(checkPenalties));
  }

  private loadSeriesPenalties(): void {
    const seriesPenaltiesQuery = this.convex.createReactiveQuery(
      this.convex.api.seriesPenalties.list,
      {},
    );
    this.unsubscribes.push(seriesPenaltiesQuery.unsubscribe);

    const checkSeriesPenalties = setInterval(() => {
      const data = seriesPenaltiesQuery.data();
      if (data !== undefined) {
        const validSeriesPenalties = data.map((sp: any) => ({
          ...sp,
          series: sp.series || undefined,
        }));
        this.seriesPenalties.set(validSeriesPenalties);
      }
    }, 100);
    this.unsubscribes.push(() => clearInterval(checkSeriesPenalties));
  }

  getSeriesPenalties(seriesId: Id<"series">): Penalty[] {
    return this.penalties().filter((p) => p.seriesId === seriesId);
  }

  editSeries(series: Series): void {
    this.editingSeriesId = series._id;
    this.seriesForm = {
      name: series.name,
      description: series.description || "",
      simgridLink: series.simgridLink || "",
      reportingOpenTime: series.reportingOpenTime || "",
      reportingCloseDuration: series.reportingCloseDuration || 0,
      isReportingLocked: series.isReportingLocked || false,
      isActive: series.isActive !== false,
    };
    this.showSeriesModal = true;
  }

  async saveSeries(): Promise<void> {
    if (this.editingSeriesId) {
      await this.convex.mutation(this.convex.api.series.update, {
        id: this.editingSeriesId,
        name: this.seriesForm.name,
        description: this.seriesForm.description || undefined,
        simgridLink: this.seriesForm.simgridLink || undefined,
        reportingOpenTime: this.seriesForm.reportingOpenTime || undefined,
        reportingCloseDuration:
          this.seriesForm.reportingCloseDuration || undefined,
        isReportingLocked: this.seriesForm.isReportingLocked,
        isActive: this.seriesForm.isActive,
      });
    } else {
      await this.convex.mutation(this.convex.api.series.create, {
        name: this.seriesForm.name,
        description: this.seriesForm.description || undefined,
        simgridLink: this.seriesForm.simgridLink || undefined,
        reportingOpenTime: this.seriesForm.reportingOpenTime || undefined,
        reportingCloseDuration:
          this.seriesForm.reportingCloseDuration || undefined,
        isReportingLocked: this.seriesForm.isReportingLocked,
        isActive: this.seriesForm.isActive,
      });
    }
    this.closeSeriesModal();
  }

  async deleteSeries(seriesId: Id<"series">): Promise<void> {
    if (
      confirm(
        "Are you sure you want to delete this series? This will fail if there are existing events.",
      )
    ) {
      try {
        await this.convex.mutation(this.convex.api.series.remove, {
          id: seriesId,
        });
      } catch (error: any) {
        alert(error.message);
      }
    }
  }

  closeSeriesModal(): void {
    this.showSeriesModal = false;
    this.editingSeriesId = null;
    this.seriesForm = {
      name: "",
      description: "",
      simgridLink: "",
      reportingOpenTime: "",
      reportingCloseDuration: 0,
      isReportingLocked: false,
      isActive: true,
    };
  }

  addPenalty(seriesId: Id<"series">): void {
    this.penaltyForm.seriesId = seriesId;
    this.showPenaltyModal = true;
  }

  editPenalty(penalty: Penalty): void {
    this.editingPenaltyId = penalty._id;
    this.penaltyForm = {
      seriesId: penalty.seriesId,
      name: penalty.name,
      timePenalty: penalty.timePenalty,
      selfReportReduction: penalty.selfReportReduction ?? 0,
      timePenaltyLap1: penalty.timePenaltyLap1,
      licensePoints: penalty.licensePoints,
    };
    this.showPenaltyModal = true;
  }

  async savePenalty(): Promise<void> {
    if (this.editingPenaltyId) {
      await this.convex.mutation(this.convex.api.penalties.update, {
        id: this.editingPenaltyId,
        name: this.penaltyForm.name,
        timePenalty: this.penaltyForm.timePenalty,
        selfReportReduction: this.penaltyForm.selfReportReduction,
        timePenaltyLap1: this.penaltyForm.timePenaltyLap1,
        licensePoints: this.penaltyForm.licensePoints,
      });
    } else {
      if (!this.penaltyForm.seriesId) return;
      await this.convex.mutation(this.convex.api.penalties.create, {
        seriesId: this.penaltyForm.seriesId as Id<"series">,
        name: this.penaltyForm.name,
        timePenalty: this.penaltyForm.timePenalty,
        selfReportReduction: this.penaltyForm.selfReportReduction,
        timePenaltyLap1: this.penaltyForm.timePenaltyLap1,
        licensePoints: this.penaltyForm.licensePoints,
      });
    }
    this.closePenaltyModal();
  }

  async deletePenalty(penaltyId: Id<"penalties">): Promise<void> {
    if (confirm("Are you sure you want to delete this penalty?")) {
      await this.convex.mutation(this.convex.api.penalties.remove, {
        id: penaltyId,
      });
    }
  }

  closePenaltyModal(): void {
    this.showPenaltyModal = false;
    this.editingPenaltyId = null;
    this.penaltyForm = {
      seriesId: "" as Id<"series"> | "",
      name: "",
      timePenalty: 0,
      selfReportReduction: 0,
      timePenaltyLap1: 0,
      licensePoints: 0,
    };
  }

  getSeriesPenaltiesBySeries(seriesId: Id<"series">): SeriesPenalty[] {
    return this.seriesPenalties().filter((sp) => sp.seriesId === seriesId);
  }

  addSeriesPenalty(seriesId: Id<"series">): void {
    this.loadingDriverClasses = true;
    this.editingSeriesPenaltyId = null;
    this.seriesPenaltyForm.seriesId = seriesId;
    this.seriesPenaltyForm.penaltyName = "";
    this.seriesPenaltyForm.penaltyDescription = "";
    this.thresholds = [];

    // Show modal immediately, then fetch data
    this.showSeriesPenaltyModal = true;

    // Fetch driver classes for this series asynchronously
    this.convex
      .query(this.convex.api.driverClasses.getDriverClassesWithUsage, {
        seriesId,
      })
      .then((classes) => {
        this.availableDriverClasses.set(classes);
        this.loadingDriverClasses = false;
      })
      .catch((error) => {
        console.error("Failed to load driver classes:", error);
        this.loadingDriverClasses = false;
      });
  }

  editSeriesPenalty(seriesPenalty: SeriesPenalty): void {
    this.loadingDriverClasses = true;
    this.editingSeriesPenaltyId = seriesPenalty._id;
    this.seriesPenaltyForm.seriesId = seriesPenalty.seriesId;
    this.seriesPenaltyForm.penaltyName = seriesPenalty.penaltyName;
    this.seriesPenaltyForm.penaltyDescription =
      seriesPenalty.penaltyDescription || "";

    this.thresholds =
      seriesPenalty.thresholds?.map((t: SeriesPenaltyThreshold) => ({
        id: t._id,
        threshold: t.threshold,
        selectedDriverClasses:
          t.driverClassIds?.map((id) => id.toString()) || [],
      })) || [];

    // Show modal immediately, then fetch data
    this.showSeriesPenaltyModal = true;

    // Fetch driver classes for this series asynchronously
    this.convex
      .query(this.convex.api.driverClasses.getDriverClassesWithUsage, {
        seriesId: seriesPenalty.seriesId,
      })
      .then((classes) => {
        this.availableDriverClasses.set(classes);
        this.loadingDriverClasses = false;
      })
      .catch((error) => {
        console.error("Failed to load driver classes:", error);
        this.loadingDriverClasses = false;
      });
  }

  addThreshold(): void {
    this.thresholds.push({
      id: `new-${Date.now()}`,
      threshold: 0,
      selectedDriverClasses: [],
    });
  }

  removeThreshold(id: string): void {
    this.thresholds = this.thresholds.filter((t) => t.id !== id);
  }

  getDriverClassOptions(selectedClasses: string[]): MultiSelectOption[] {
    return this.availableDriverClasses().map((dc: any) => ({
      value: typeof dc._id === "string" ? dc._id : String(dc._id),
      label: String(dc.className || "Unknown"),
      selected: selectedClasses.includes(
        typeof dc._id === "string" ? dc._id : String(dc._id),
      ),
    }));
  }

  onThresholdClassesChange(
    thresholdId: string,
    selectedValues: string[],
  ): void {
    const threshold = this.thresholds.find((t) => t.id === thresholdId);
    if (threshold) {
      threshold.selectedDriverClasses = selectedValues;
    }
  }

  async saveSeriesPenalty(): Promise<void> {
    const validThresholds = this.thresholds.filter(
      (t) => t.threshold > 0 && t.selectedDriverClasses.length > 0,
    );

    if (validThresholds.length === 0) {
      alert(
        "Please add at least one valid threshold with selected driver classes",
      );
      return;
    }

    try {
      if (this.editingSeriesPenaltyId) {
        await this.convex.mutation(this.convex.api.seriesPenalties.update, {
          id: this.editingSeriesPenaltyId,
          penaltyName: this.seriesPenaltyForm.penaltyName,
          penaltyDescription:
            this.seriesPenaltyForm.penaltyDescription || undefined,
        });

        const existingThresholds = await this.convex.query(
          this.convex.api.seriesPenaltyThresholds.listBySeriesPenalty,
          { seriesPenaltyId: this.editingSeriesPenaltyId },
        );

        for (const existing of existingThresholds) {
          await this.convex.mutation(
            this.convex.api.seriesPenaltyThresholds.remove,
            {
              id: existing._id,
            },
          );
        }

        for (const threshold of validThresholds) {
          await this.convex.mutation(
            this.convex.api.seriesPenaltyThresholds.create,
            {
              seriesPenaltyId: this.editingSeriesPenaltyId,
              threshold: threshold.threshold,
              driverClassIds: threshold.selectedDriverClasses.map(
                (id) => id as Id<"driverClasses">,
              ),
            },
          );
        }
      } else {
        const seriesPenaltyId = await this.convex.mutation(
          this.convex.api.seriesPenalties.create,
          {
            seriesId: this.seriesPenaltyForm.seriesId as Id<"series">,
            penaltyName: this.seriesPenaltyForm.penaltyName,
            penaltyDescription:
              this.seriesPenaltyForm.penaltyDescription || undefined,
          },
        );

        for (const threshold of validThresholds) {
          await this.convex.mutation(
            this.convex.api.seriesPenaltyThresholds.create,
            {
              seriesPenaltyId,
              threshold: threshold.threshold,
              driverClassIds: threshold.selectedDriverClasses.map(
                (id) => id as Id<"driverClasses">,
              ),
            },
          );
        }
      }
      this.closeSeriesPenaltyModal();
    } catch (error: any) {
      alert(`Failed to save series penalty: ${error.message}`);
    }
  }

  async deleteSeriesPenalty(
    seriesPenaltyId: Id<"seriesPenalties">,
  ): Promise<void> {
    if (confirm("Are you sure you want to delete this series penalty?")) {
      try {
        const thresholds = await this.convex.query(
          this.convex.api.seriesPenaltyThresholds.listBySeriesPenalty,
          { seriesPenaltyId },
        );

        for (const threshold of thresholds) {
          await this.convex.mutation(
            this.convex.api.seriesPenaltyThresholds.remove,
            {
              id: threshold._id,
            },
          );
        }

        await this.convex.mutation(this.convex.api.seriesPenalties.remove, {
          id: seriesPenaltyId,
        });
      } catch (error: any) {
        alert(`Failed to delete series penalty: ${error.message}`);
      }
    }
  }

  closeSeriesPenaltyModal(): void {
    this.showSeriesPenaltyModal = false;
    this.editingSeriesPenaltyId = null;
    this.seriesPenaltyForm = {
      seriesId: "" as Id<"series"> | "",
      penaltyName: "",
      penaltyDescription: "",
    };
    this.thresholds = [];
    this.availableDriverClasses.set([]);
  }

  async importEvents(seriesId: Id<"series">): Promise<void> {
    this.importing.set(true);
    this.importResult.set(null);

    try {
      const result = await this.convex.action(
        this.convex.api.events.importFromSimGrid,
        { seriesId },
      );
      this.importResult.set(result);

      if (result.created > 0) {
        alert(
          `Successfully imported ${result.created} events${result.skipped > 0 ? ` (${result.skipped} already exist)` : ""}`,
        );
      } else if (result.skipped > 0) {
        alert(
          `No new events imported. ${result.skipped} events already exist.`,
        );
      } else {
        alert("No events found on SimGrid.");
      }
    } catch (error: any) {
      alert(`Failed to import events: ${error.message}`);
    } finally {
      this.importing.set(false);
    }
  }

  async importDrivers(seriesId: Id<"series">): Promise<void> {
    this.importing.set(true);
    this.importResult.set(null);

    try {
      const series = await this.convex.query(this.convex.api.series.getById, {
        id: seriesId,
      });
      if (!series || !series.simgridLink) {
        throw new Error("Series not found or simgridLink not configured");
      }

      const championshipId = this.extractChampionshipId(series.simgridLink);
      if (!championshipId) {
        throw new Error("Could not extract championship ID from simgridLink");
      }

      const result = await this.convex.action(
        (this.convex.api as any).actions.importDriversFromSimGrid,
        {
          championshipId: seriesId,
          simgridChampionshipId: championshipId,
        },
      );

      if (result.success) {
        const createdCount = result.results.filter(
          (r: any) => r.action === "created",
        ).length;
        const updatedCount = result.results.filter(
          (r: any) => r.action === "updated",
        ).length;
        alert(
          `Successfully imported ${result.imported} drivers (${createdCount} created, ${updatedCount} updated)`,
        );
      } else {
        alert(`Failed to import drivers: ${result.error}`);
      }
    } catch (error: any) {
      alert(`Failed to import drivers: ${error.message}`);
    } finally {
      this.importing.set(false);
    }
  }

  private extractChampionshipId(url: string): string | null {
    const patterns = [/championship\/(\d+)/, /id=(\d+)/, /\/(\d+)\/?$/];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }

    return null;
  }

  // Driver Class Management Methods
  async loadDriverClassesForManagement(seriesId: Id<"series">): Promise<void> {
    this.editingDriverClassSeriesId = seriesId;
    this.loadingDriverClasses = true;

    try {
      const classes = await this.convex.query(
        this.convex.api.driverClasses.getDriverClassesWithUsage,
        { seriesId },
      );

      this.driverClassesForManagement.set(classes);
      this.showDriverClassModal = true;
    } catch (error) {
      console.error("Failed to load driver classes:", error);
    } finally {
      this.loadingDriverClasses = false;
    }
  }

  getDriverClassesBySeries(seriesId: Id<"series">): any[] {
    // Return cached driver classes for display in series card
    return this.driverClassesBySeries().get(seriesId) || [];
  }

  private subscribeToDriverClassesForSeries(seriesId: Id<"series">): void {
    // Avoid duplicate subscriptions
    if (this.driverClassesSubscriptions.has(seriesId)) {
      return;
    }

    const query = this.convex.createReactiveQuery(
      this.convex.api.driverClasses.getDriverClassesWithUsage,
      { seriesId },
    );

    const checkData = setInterval(() => {
      const data = query.data();
      if (data !== undefined) {
        this.driverClassesBySeries.update((map) => {
          const newMap = new Map(map);
          newMap.set(seriesId, data);
          return newMap;
        });
      }
    }, 100);

    // Store cleanup function
    this.driverClassesSubscriptions.set(seriesId, () => {
      clearInterval(checkData);
      query.unsubscribe();
    });
    this.unsubscribes.push(() => {
      clearInterval(checkData);
      query.unsubscribe();
    });
  }

  editDriverClass(driverClass: any): void {
    this.editingDriverClassId = driverClass._id;
    this.editingDriverClassName = driverClass.displayName;
  }

  cancelEditDriverClass(): void {
    this.editingDriverClassId = null;
    this.editingDriverClassName = "";
  }

  async saveDriverClassDisplayName(): Promise<void> {
    if (!this.editingDriverClassId || !this.editingDriverClassName.trim())
      return;

    try {
      await this.convex.mutation(
        this.convex.api.driverClasses.updateDisplayName,
        {
          id: this.editingDriverClassId,
          displayName: this.editingDriverClassName.trim(),
        },
      );

      // Refresh the list
      if (this.editingDriverClassSeriesId) {
        await this.loadDriverClassesForManagement(
          this.editingDriverClassSeriesId,
        );
      }

      this.cancelEditDriverClass();
    } catch (error) {
      console.error("Failed to update driver class:", error);
    }
  }

  closeDriverClassModal(): void {
    this.showDriverClassModal = false;
    this.editingDriverClassSeriesId = null;
    this.driverClassesForManagement.set([]);
    this.cancelEditDriverClass();
  }
}
