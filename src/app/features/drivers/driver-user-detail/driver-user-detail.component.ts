import { CommonModule } from "@angular/common";
import {
  Component,
  Input,
  OnInit,
  computed,
  inject,
  signal,
  DestroyRef,
  untracked,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterLink, ActivatedRoute } from "@angular/router";
import { ConvexService } from "@core/services/convex.service";
import { AuthService } from "@core/services/auth.service";
import { ToastService } from "@core/services/toast.service";
import { BadgeComponent } from "@shared/components/badge/badge.component";
import { ButtonComponent } from "@shared/components/button/button.component";
import { CardComponent } from "@shared/components/card/card.component";
import { LoadingComponent } from "@shared/components/loading/loading.component";
import {
  SelectComponent,
  SelectOption,
} from "@shared/components/select/select.component";
import { DriverSeriesPenaltyDetails } from "@core/models";
import { debounceTime, Subject } from "rxjs";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { effect } from "@angular/core";

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
  selector: "app-driver-user-detail",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    BadgeComponent,
    ButtonComponent,
    CardComponent,
    LoadingComponent,
    SelectComponent,
  ],
  template: `
    <div class="space-y-6">
      @if (loading()) {
        <app-loading text="Loading..." />
      } @else if (!profile() && !driver()) {
        <app-card>
          <p class="text-center py-8 text-gray-500 dark:text-gray-400">
            @if (isDriverMode()) {
              Driver not found.
            } @else {
              User profile not found.
            }
          </p>
          <div class="text-center">
            <a routerLink="/drivers">
              <app-button variant="secondary">Back to Drivers</app-button>
            </a>
          </div>
        </app-card>
      } @else {
        <!-- Header -->
        <div
          class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4"
        >
          <div class="flex items-center gap-4">
            @if (isDriverMode()) {
              <div
                class="w-20 h-20 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center"
              >
                <span class="text-3xl font-bold text-primary-700 dark:text-primary-100">{{
                  driver()?.driverNumber
                }}</span>
              </div>
              <div>
                <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {{ driver()?.displayName ?? driver()?.driverName }}
                </h1>
                @if (
                  driver()?.displayName &&
                  driver()?.displayName !== driver()?.driverName
                ) {
                  <p class="text-sm text-gray-600 dark:text-gray-300">
                    {{ driver()?.driverName }}
                  </p>
                }
              </div>
            } @else {
              <div>
                <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {{ profile()?.user?.name }}
                </h1>
                @if (profile()?.user?.officialName) {
                  <p class="text-gray-600 dark:text-gray-300">
                    Official: {{ profile()?.user?.officialName }}
                  </p>
                }
                @if (profile()?.user?.discordUsername) {
                  <p class="text-gray-500 dark:text-gray-400">
                    Discord: {{ profile()?.user?.discordUsername }}
                  </p>
                }
              </div>
            }
          </div>
          <a routerLink="/drivers">
            <app-button variant="secondary">Back to Drivers</app-button>
          </a>
        </div>

        <!-- Stats Cards -->
        @if (statsToShow()) {
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <app-card>
              <div class="text-center">
                <p class="text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {{ statsToShow()?.reportsFiledCount || 0 }}
                </p>
                <p class="text-sm text-gray-500 mt-1 dark:text-gray-400">
                  Reports Filed
                </p>
              </div>
            </app-card>
            <app-card>
              <div class="text-center">
                <p class="text-3xl font-bold text-amber-600">
                  {{ statsToShow()?.reportsAgainstCount || 0 }}
                </p>
                <p class="text-sm text-gray-500 mt-1 dark:text-gray-400">
                  Reports Against
                </p>
              </div>
            </app-card>
            <app-card>
              <div class="text-center">
                <p class="text-3xl font-bold text-blue-600">
                  {{ statsToShow()?.pendingReports || 0 }}
                </p>
                <p class="text-sm text-gray-500 mt-1 dark:text-gray-400">
                  Pending
                </p>
              </div>
            </app-card>
            <app-card>
              <div class="text-center">
                <p class="text-3xl font-bold text-green-600">
                  {{ statsToShow()?.finalizedReports || 0 }}
                </p>
                <p class="text-sm text-gray-500 mt-1 dark:text-gray-400">
                  Finalized
                </p>
              </div>
            </app-card>
          </div>
        }

        <!-- Information Card -->
        <app-card title="Information">
          <dl class="grid sm:grid-cols-2 gap-4">
            @if (isDriverMode()) {
              <div>
                <dt class="text-sm text-gray-500 dark:text-gray-400">
                  Driver Number
                </dt>
                <dd class="font-medium text-gray-900 dark:text-gray-100">
                  #{{ driver()?.driverNumber }}
                </dd>
              </div>
              <div>
                <dt class="text-sm text-gray-500 dark:text-gray-400">
                  Full Name
                </dt>
                <dd class="font-medium text-gray-900 dark:text-gray-100">
                  {{ driver()?.driverName }}
                </dd>
              </div>
            }
            <div>
              <dt class="text-sm text-gray-500 dark:text-gray-400">
                Discord Username
              </dt>
              <dd class="font-medium text-gray-900 dark:text-gray-100">
                {{
                  isDriverMode()
                    ? driver()?.username
                    : profile()?.user?.discordUsername || "Not set"
                }}
              </dd>
            </div>
            <div>
              <dt class="text-sm text-gray-500 dark:text-gray-400">
                Official Name
              </dt>
              @if (editingOfficialName() && canManageProfiles()) {
                <div class="flex items-center gap-2">
                  <input
                    type="text"
                    class="input flex-1"
                    [ngModel]="pendingOfficialName()"
                    (ngModelChange)="setPendingOfficialName($event)"
                    placeholder="Enter official name"
                  />
                  <app-button
                    variant="primary"
                    size="sm"
                    [loading]="savingOfficialName()"
                    (onClick)="saveInlineOfficialName()"
                    >Save</app-button
                  >
                  <app-button
                    variant="secondary"
                    size="sm"
                    (onClick)="cancelEditOfficialName()"
                    >Cancel</app-button
                  >
                    </div>
                  } @else {
                <dd class="font-medium text-gray-900 dark:text-gray-100">
                  {{
                    isDriverMode()
                      ? driver()?.officialName ?? driver()?.driverName
                      : profile()?.user?.officialName || "Not set"
                  }}
                  @if (canManageProfiles()) {
                    <a
                      href="#"
                      (click)="
                        toggleEditOfficialName();
                        $event.preventDefault()
                      "
                      class="ml-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                      >Edit</a
                    >
                  }
                </dd>
              }
            </div>
            @if (isDriverMode()) {
              <div>
                <dt class="text-sm text-gray-500 dark:text-gray-400">
                  Linked User
                </dt>
                @if (editingLinkedUser() && canManageProfiles()) {
                  <div class="flex items-center gap-2">
                    <select
                      class="input flex-1"
                      [ngModel]="pendingLinkedUserId()"
                      (ngModelChange)="setPendingLinkedUserId($event)"
                    >
                      @for (option of userOptions(); track option.value) {
                        <option [value]="option.value">{{ option.label }}</option>
                      }
                    </select>
                    <app-button
                      variant="primary"
                      size="sm"
                      [loading]="savingLinkedUser()"
                      (onClick)="saveInlineLinkedUser()"
                      >Save</app-button
                    >
                    <app-button
                      variant="secondary"
                      size="sm"
                      (onClick)="cancelEditLinkedUser()"
                      >Cancel</app-button
                    >
                  </div>
                } @else {
                  <dd class="font-medium text-gray-900 dark:text-gray-100">
                    {{ linkedUser()?.officialName || linkedUser()?.name || "Not linked" }}
                    @if (canManageProfiles()) {
                      <a
                        href="#"
                        (click)="toggleEditLinkedUser(); $event.preventDefault()"
                        class="ml-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                        >Edit</a
                      >
                    }
                  </dd>
                }
              </div>
              @if (driver()?.externalId) {
                <div>
                  <dt class="text-sm text-gray-500 dark:text-gray-400">
                    External ID
                  </dt>
                  <dd class="font-medium text-gray-900 dark:text-gray-100">
                    {{ driver()?.externalId }}
                  </dd>
                </div>
              }
            }
          </dl>
        </app-card>

        <!-- Staff Notes - User Mode Only -->
        @if (!isDriverMode() && canViewStaffNotes()) {
          <app-card>
            <label class="label">Staff Notes</label>
            <textarea
              class="input min-h-[120px]"
              [ngModel]="staffNoteDraft()"
              (ngModelChange)="setStaffNoteDraft($event)"
              placeholder="Add internal notes for staff only..."
            ></textarea>
            <div class="flex items-center justify-between mt-3">
              <p class="text-xs text-gray-500 dark:text-gray-400">
                Visible to stewards and above only.
              </p>
              <app-button
                variant="primary"
                size="sm"
                [loading]="savingStaffNote()"
                (onClick)="saveStaffNote()"
              >
                Save Note
              </app-button>
            </div>
          </app-card>
        }

        <!-- Visible Series Profiles - User Mode Only -->
        @if (!isDriverMode()) {
          <app-card>
            <label class="label">Visible Series Profiles</label>
            <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              @for (
                seriesProfile of profile()!.profiles;
                track seriesProfile.driverId
              ) {
                <label
                  class="inline-flex items-center gap-2 rounded-md border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    [checked]="
                      selectedDriverIds().includes(seriesProfile.driverId)
                    "
                    (change)="toggleDriverSelection(seriesProfile.driverId)"
                  />
                  <span
                    >#{{ seriesProfile.driverNumber }} -
                    {{ seriesProfile.seriesName }}</span
                  >
                </label>
              }
            </div>
          </app-card>
        }

        <!-- Series Profile Cards -->
        <div class="space-y-4">
          @for (profile of profilesToShow(); track profile.driverId) {
            <app-card>
              <div class="flex items-center justify-between gap-3">
                <div>
                  <h3
                    class="text-lg font-semibold text-gray-900 dark:text-gray-100"
                  >
                    {{ profile.seriesName || "No Series" }} - #{{
                      profile.driverNumber
                    }}
                  </h3>
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    {{ profile.displayName || profile.driverName }}
                  </p>
                </div>
                @if (profile.isActive === false) {
                  <app-badge variant="warning">Withdrawn</app-badge>
                }
              </div>

              <div class="grid md:grid-cols-3 gap-4 mt-4">
                <div>
                  <p class="text-xs uppercase text-gray-500 dark:text-gray-400">
                    Driver Class
                  </p>
                  @if (
                    editingDriverClass()[profile.driverId] &&
                    canManageProfiles()
                  ) {
                    <div class="flex items-center gap-2">
                      <select
                        class="input flex-1"
                        [ngModel]="
                          pendingDriverClass()[profile.driverId] || ''
                        "
                        (ngModelChange)="
                          setPendingDriverClass(profile.driverId, $event)
                        "
                      >
                        <option value="">Select class</option>
                        @for (
                          driverClass of classOptionsBySeries()[
                            profile.seriesId || ""
                          ];
                          track driverClass._id
                        ) {
                          <option [value]="driverClass._id">
                            {{ driverClass.displayName }}
                          </option>
                        }
                      </select>
                      <app-button
                        variant="primary"
                        size="sm"
                        (onClick)="
                          saveInlineDriverClass(profile.driverId)
                        "
                        >Save</app-button
                      >
                      <app-button
                        variant="secondary"
                        size="sm"
                        (onClick)="
                          cancelEditDriverClass(profile.driverId)
                        "
                        >Cancel</app-button
                      >
                    </div>
                  } @else {
                    <p class="font-medium text-gray-900 dark:text-gray-100">
                      {{ profile.driverClassName || profile.driverClass || "No class" }}
                      @if (canManageProfiles()) {
                        <a
                          href="#"
                          (click)="
                            toggleEditDriverClass(profile.driverId);
                            $event.preventDefault()
                          "
                          class="ml-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                          >Edit</a
                        >
                      }
                    </p>
                  }
                </div>
                <div>
                  <p class="text-xs uppercase text-gray-500 dark:text-gray-400">
                    License Points
                  </p>
                  @if (
                    editingLicensePoints()[profile.driverId] &&
                    canManageProfiles()
                  ) {
                    <div class="flex items-center gap-2">
                      <input
                        type="number"
                        class="input flex-1"
                        min="0"
                        [ngModel]="
                          pendingLicensePoints()[profile.driverId] ||
                          profile.accumulatedLicensePoints
                        "
                        (ngModelChange)="
                          setPendingLicensePoints(
                            profile.driverId,
                            $event
                          )
                        "
                      />
                      <app-button
                        variant="primary"
                        size="sm"
                        (onClick)="
                          saveInlineLicensePoints(profile.driverId)
                        "
                        >Save</app-button
                      >
                      <app-button
                        variant="secondary"
                        size="sm"
                        (onClick)="
                          cancelEditLicensePoints(profile.driverId)
                        "
                        >Cancel</app-button
                      >
                    </div>
                  } @else {
                    <p class="font-medium text-gray-900 dark:text-gray-100">
                      {{ profile.accumulatedLicensePoints || 0 }}
                      @if (canManageProfiles()) {
                        <a
                          href="#"
                          (click)="
                            toggleEditLicensePoints(profile.driverId);
                            $event.preventDefault()
                          "
                          class="ml-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                          >Edit</a
                        >
                      }
                    </p>
                  }
                  @if (
                    !isDriverMode() &&
                    (editingDriverClass()[profile.driverId] ||
                      editingLicensePoints()[profile.driverId])
                  ) {
                    <textarea
                      class="input w-full mt-2 border-red-300 dark:border-red-700"
                      rows="3"
                      [ngModel]="
                        seriesData()[profile.seriesId]?.seriesPenaltyNotes || ''
                      "
                      readonly
                      placeholder="No series penalty notes configured for this series"
                    ></textarea>
                  }
                </div>
                <div>
                  <p class="text-xs uppercase text-gray-500 dark:text-gray-400">
                    Steam ID
                  </p>
                  <p class="font-medium text-gray-900 dark:text-gray-100">
                    {{ profile.steamId || "Not set" }}
                  </p>
                </div>
              </div>

              <div class="mt-5">
                <h4 class="font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Penalty History
                </h4>
                @if (
                  isDriverMode()
                    ? !stats()?.finalizedReports
                    : !profile.penalties.length
                ) {
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    No finalized penalties found for this
                    {{ isDriverMode() ? "driver" : "series profile" }}.
                  </p>
                } @else {
                  <div class="space-y-2">
                    @for (
                      penalty of (isDriverMode() ? penaltyHistory() : profile.penalties);
                      track penalty.reportId
                    ) {
                      <a
                        [routerLink]="['/reports', penalty.reportId]"
                        class="block rounded-md border border-gray-200 dark:border-gray-700 p-3 hover:bg-gray-50 dark:hover:bg-gray-800/60"
                      >
                        <div class="flex items-center justify-between gap-3">
                          <div>
                            <p
                              class="text-sm font-medium text-gray-900 dark:text-gray-100"
                            >
                              {{ penalty.penaltyName || "No penalty" }} ({{
                                penalty.licensePoints
                              }}
                              LP)
                            </p>
                            <p class="text-xs text-gray-500 dark:text-gray-400">
                              {{ penalty.eventName }} - Event
                              {{ penalty.eventNumber }} / Race
                              {{ penalty.raceNumber || "-" }}
                            </p>
                          </div>
                          <span
                            class="text-xs text-gray-500 dark:text-gray-400"
                            >{{ formatDate(penalty.finalizedAt) }}</span
                          >
                        </div>
                      </a>
                    }
                  </div>
                }
              </div>
            </app-card>
          }
        </div>

        <!-- Series Penalties - Driver Mode Only -->
        @if (isDriverMode()) {
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
                @for (
                  seriesGroup of filteredAndSortedSeriesPenalties();
                  track seriesGroup.seriesId
                ) {
                  <div class="space-y-4">
                    <div class="flex items-center gap-2 pt-4">
                      <h3
                        class="text-lg font-semibold text-gray-900 dark:text-gray-100"
                      >
                        {{ seriesGroup.seriesName }}
                      </h3>
                    </div>
                    @if (getSeriesPenalties(seriesGroup.seriesId).length > 0) {
                      <div class="overflow-x-auto">
                        <table class="w-full text-sm">
                          <thead
                            class="bg-gray-50 dark:bg-gray-800"
                          >
                            <tr class="text-left">
                              <th
                                class="px-4 py-2 font-medium text-gray-500 cursor-pointer hover:text-gray-700 align-middle leading-tight dark:text-gray-400 dark:hover:text-gray-200"
                                (click)="
                                  sortSeriesPenalties(
                                    seriesGroup.seriesId,
                                    'penaltyName'
                                  )
                                "
                              >
                                Penalty
                                {{
                                  getSortIcon(
                                    "penaltyName",
                                    getSeriesSortColumn(seriesGroup.seriesId),
                                    getSeriesSortDirection(seriesGroup.seriesId)
                                  )
                                }}
                              </th>
                              <th
                                class="px-4 py-2 font-medium text-gray-500 cursor-pointer hover:text-gray-700 align-middle leading-tight dark:text-gray-400 dark:hover:text-gray-200"
                                (click)="
                                  sortSeriesPenalties(
                                    seriesGroup.seriesId,
                                    'threshold'
                                  )
                                "
                              >
                                Threshold
                                {{
                                  getSortIcon(
                                    "threshold",
                                    getSeriesSortColumn(seriesGroup.seriesId),
                                    getSeriesSortDirection(seriesGroup.seriesId)
                                  )
                                }}
                              </th>
                              <th
                                class="px-4 py-2 font-medium text-gray-500 cursor-pointer hover:text-gray-700 align-middle leading-tight dark:text-gray-400 dark:hover:text-gray-200"
                                (click)="
                                  sortSeriesPenalties(
                                    seriesGroup.seriesId,
                                    'pointsAtAssignment'
                                  )
                                "
                              >
                                Points at Assignment
                                {{
                                  getSortIcon(
                                    "pointsAtAssignment",
                                    getSeriesSortColumn(seriesGroup.seriesId),
                                    getSeriesSortDirection(seriesGroup.seriesId)
                                  )
                                }}
                              </th>
                              <th
                                class="px-4 py-2 font-medium text-gray-500 cursor-pointer hover:text-gray-700 align-middle leading-tight dark:text-gray-400 dark:hover:text-gray-200"
                                (click)="
                                  sortSeriesPenalties(
                                    seriesGroup.seriesId,
                                    'assignedAt'
                                  )
                                "
                              >
                                Assigned Date
                                {{
                                  getSortIcon(
                                    "assignedAt",
                                    getSeriesSortColumn(seriesGroup.seriesId),
                                    getSeriesSortDirection(seriesGroup.seriesId)
                                  )
                                }}
                              </th>
                              <th
                                class="px-4 py-2 font-medium text-gray-500 cursor-pointer hover:text-gray-700 align-middle leading-tight dark:text-gray-400 dark:hover:text-gray-200"
                                (click)="
                                  sortSeriesPenalties(
                                    seriesGroup.seriesId,
                                    'isServed'
                                  )
                                "
                              >
                                Status
                                {{
                                  getSortIcon(
                                    "isServed",
                                    getSeriesSortColumn(seriesGroup.seriesId),
                                    getSeriesSortDirection(seriesGroup.seriesId)
                                  )
                                }}
                              </th>
                              <th
                                class="px-4 py-2 font-medium text-gray-500 align-middle leading-tight dark:text-gray-400"
                              >
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody
                            class="divide-y divide-gray-100 dark:divide-gray-800"
                          >
                            @for (
                              penalty of getSeriesPenalties(seriesGroup.seriesId);
                              track penalty._id
                            ) {
                              <tr class="hover:bg-gray-50 dark:hover:bg-gray-800">
                                <td
                                  class="px-4 py-3 font-medium text-gray-900 dark:text-gray-100"
                                >
                                  {{ penalty.penaltyName ?? "-" }}
                                </td>
                                <td
                                  class="px-4 py-3 text-gray-600 dark:text-gray-300"
                                >
                                  {{ penalty.threshold ?? "-" }} pts
                                </td>
                                <td
                                  class="px-4 py-3 text-gray-600 dark:text-gray-300"
                                >
                                  {{ penalty.pointsAtAssignment }} pts
                                </td>
                                <td
                                  class="px-4 py-3 text-gray-600 dark:text-gray-300"
                                >
                                  {{ formatDate(penalty.assignedAt) }}
                                </td>
                                <td class="px-4 py-3">
                                  @if (penalty.isServed) {
                                    <app-badge variant="success"
                                      >Served</app-badge
                                    >
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
                                  } @else if (
                                    penalty.isServed && penalty.servedByUserName
                                  ) {
                                    <span
                                      class="text-sm text-gray-500 dark:text-gray-400"
                                    >
                                      By {{ penalty.servedByUserName }} on
                                      {{ formatDate(penalty.servedAt!) }}
                                    </span>
                                  }
                                </td>
                              </tr>
                            }
                          </tbody>
                        </table>
                      </div>
                    } @else {
                      <p
                        class="text-gray-500 text-center py-4 dark:text-gray-400"
                      >
                        No penalties for this series
                      </p>
                    }
                  </div>
                }
              } @else if (selectedSeriesId || seriesOptions().length === 1) {
                <p class="text-gray-500 text-center py-4 dark:text-gray-400">
                  No series penalties assigned to this driver
                </p>
              } @else {
                <p class="text-gray-500 text-center py-4 dark:text-gray-400">
                  Select a series to view penalties
                </p>
              }
            </div>
          </app-card>
        }
      }
    </div>
  `,
})
export class DriverUserDetailComponent implements OnInit {
  private readonly convex = inject(ConvexService);
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);

  @Input() driverId?: string;
  @Input() userId?: string;

  private readonly _driverId = signal<string | undefined>(undefined);
  private readonly _userId = signal<string | undefined>(undefined);

  loading = signal(true);
  profile = signal<any>(null);
  selectedDriverIds = signal<string[]>([]);
  staffNoteDraft = signal<string>("");
  savingStaffNote = signal(false);
  seriesData = signal<Record<string, any>>({});

  classOptionsBySeries = signal<Record<string, any[]>>({});
  classSelection = signal<Record<string, string>>({});
  pendingLicensePoints = signal<Record<string, number>>({});
  adjustPointsOnClassChange = signal<Record<string, boolean>>({});

  editingDriverClass = signal<Record<string, boolean>>({});
  editingLicensePoints = signal<Record<string, boolean>>({});
  pendingDriverClass = signal<Record<string, string>>({});
  editingOfficialName = signal(false);
  pendingOfficialName = signal("");
  savingOfficialName = signal(false);
  editingLinkedUser = signal(false);
  pendingLinkedUserId = signal("");
  savingLinkedUser = signal(false);

  readonly isDriverMode = computed(() =>
    !!this._driverId() && !this._userId()
  );

  // Driver Mode signals
  driver = signal<any>(null);
  linkedUser = signal<any>(null);
  stats = signal<any>(null);
  penalties = signal<DriverSeriesPenaltyDetails[]>([]);
  penaltyHistory = signal<any[]>([]);
  penaltiesLoading = signal(false);
  selectedSeriesId = "";
  series = signal<any[]>([]);
  driverClassOptions = signal<any[]>([]);
  allUsers = signal<any[]>([]);
  seriesFilterText = signal("");
  seriesSortColumn = signal<Record<string, keyof SeriesPenaltyRow>>({});
  seriesSortDirection = signal<Record<string, "asc" | "desc">>({});
  private seriesFilterSubject = new Subject<string>();
  private unsubscribes: (() => void)[] = [];

  private seriesFilterEffect = effect(
    () => {
      const filterText = this.seriesFilterText();
      this.seriesFilterSubject.next(filterText);
    },
    { allowSignalWrites: true },
  );

  visibleProfiles = computed(() => {
    const current = this.profile();
    if (!current) return [];

    const selected = this.selectedDriverIds();
    return current.profiles.filter((seriesProfile: any) =>
      selected.includes(seriesProfile.driverId),
    );
  });

  profilesToShow = computed(() => {
    if (this.isDriverMode()) {
      const drv = this.driver();
      return drv ? [{ ...drv, _isSingleDriver: true }] : [];
    }
    return this.visibleProfiles();
  });

  aggregatedStats = computed(() => {
    const profiles = this.profile()?.profiles || [];
    return {
      reportsFiledCount: profiles.reduce(
        (sum: number, p: any) => sum + (p.reportsFiledCount || 0),
        0
      ),
      reportsAgainstCount: profiles.reduce(
        (sum: number, p: any) => sum + (p.reportsAgainstCount || 0),
        0
      ),
      pendingReports: profiles.reduce(
        (sum: number, p: any) => sum + (p.pendingReports || 0),
        0
      ),
      finalizedReports: profiles.reduce(
        (sum: number, p: any) => sum + (p.finalizedReports || 0),
        0
      ),
    };
  });

  statsToShow = computed(() => {
    return this.isDriverMode() ? this.stats() : this.aggregatedStats();
  });

  groupedPenalties = computed((): SeriesPenaltyGroup[] => {
    const penalties = this.penalties();
    const grouped: Record<string, SeriesPenaltyGroup> = {};

    for (const penalty of penalties) {
      const seriesId = penalty.seriesId as string;
      const seriesName = penalty.seriesName ?? "Unknown Series";

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
      groups = groups.filter((g) => g.seriesId === this.selectedSeriesId);
    }

    if (this.seriesFilterText()) {
      const filter = this.seriesFilterText().toLowerCase();

      groups = groups.map((group) => ({
        ...group,
        penalties: group.penalties.filter((penalty) => {
          const penaltyName = penalty.penaltyName?.toLowerCase() ?? "";
          const penaltyDescription =
            penalty.penaltyDescription?.toLowerCase() ?? "";
          const threshold = penalty.threshold?.toString() ?? "";
          const points = penalty.pointsAtAssignment?.toString() ?? "";
          const assignedDate = new Date(penalty.assignedAt)
            .toLocaleDateString()
            .toLowerCase();
          const status = penalty.isServed ? "served" : "active";

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
    this.route.params.subscribe((params) => {
      if (params["userId"]) {
        this._userId.set(params["userId"]);
      } else if (params["id"]) {
        this._driverId.set(params["id"]);
      }
      void this.load();
    });
  }

  canManageProfiles(): boolean {
    return this.authService.hasMinimumRole("event_manager");
  }

  canViewStaffNotes(): boolean {
    return this.authService.hasMinimumRole("steward");
  }

  setStaffNoteDraft(value: string): void {
    this.staffNoteDraft.set(value);
  }

  async saveStaffNote(): Promise<void> {
    const currentUserId = this.authService.getUserId();
    if (!currentUserId || !this.userId) return;

    this.savingStaffNote.set(true);
    try {
      await this.convex.mutation(this.convex.api.users.updateNote, {
        userId: this.userId as any,
        note: this.staffNoteDraft(),
        currentUserId,
      });
      this.toast.success("Staff note updated");
      await this.load();
    } catch (error: any) {
      console.error("Failed to update staff note:", error);
      this.toast.error(error?.message || "Failed to update staff note");
    } finally {
      this.savingStaffNote.set(false);
    }
  }

  async load(): Promise<void> {
    if (!this._driverId() && !this._userId()) {
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    try {
      if (this.isDriverMode()) {
        await this.loadDriverMode();
      } else if (this._userId()) {
        await this.loadUserMode();
      }
    } catch (error) {
      console.error("Failed to load data:", error);
      this.toast.error("Failed to load data");
    } finally {
      this.loading.set(false);
    }
  }

  private async loadDriverMode(): Promise<void> {
    if (!this._driverId()) return;

    const driver = await this.convex.query(
      this.convex.api.drivers.getByIdWithUser,
      { driverId: this._driverId() as any }
    );

    this.driver.set(driver);
    this.linkedUser.set(driver.linkedUser);

    const stats = await this.convex.query(
      this.convex.api.drivers.getDriverStats,
      { driverId: this._driverId() as any }
    );
    this.stats.set(stats);

    if (driver.championshipId) {
      const classes = await this.convex.query(
        this.convex.api.drivers.getDriverClassesBySeries,
        { seriesId: driver.championshipId as any }
      );
      this.classOptionsBySeries.set({ [driver.championshipId]: classes || [] });
    } else {
      this.classOptionsBySeries.set({});
    }

    if (this.authService.hasMinimumRole("event_manager")) {
      const users = await this.convex.query(this.convex.api.users.list, {});
      this.allUsers.set(users || []);
    }

    const history = await this.convex.query(
      this.convex.api.drivers.getPenaltyHistory,
      {
        driverId: this._driverId() as any,
        championshipId: driver.championshipId ?? undefined,
      }
    );
    this.penaltyHistory.set(history || []);

    await this.loadSeries();
    await this.loadPenalties();
  }

  private async loadUserMode(): Promise<void> {
    if (!this._userId()) return;

    const profile = await this.convex.query(
      this.convex.api.drivers.getUserProfile,
      {
        userId: this._userId() as any,
        currentUserId: this.authService.getUserId() ?? undefined,
      }
    );
    this.profile.set(profile);
    this.staffNoteDraft.set(profile?.user?.note || "");

    if (profile?.profiles?.length) {
      const defaultDriverIds = profile.profiles
        .slice(0, 2)
        .map((p: any) => p.driverId);
      this.selectedDriverIds.set(defaultDriverIds);
      await this.loadClassOptions(profile.profiles);
      await this.loadSeriesDataForProfiles(profile.profiles);
    }
  }

  private async loadClassOptions(seriesProfiles: any[]): Promise<void> {
    const uniqueSeriesIds = [
      ...new Set(seriesProfiles.map((p) => p.seriesId).filter(Boolean)),
    ];
    const entries = await Promise.all(
      uniqueSeriesIds.map(async (seriesId) => {
        const options = await this.convex.query(
          this.convex.api.drivers.getDriverClassesBySeries,
          {
            seriesId: seriesId as any,
          },
        );
        return [seriesId, options || []] as const;
      })
    );

    const map: Record<string, any[]> = {};
    for (const [seriesId, options] of entries) {
      map[String(seriesId)] = options;
    }
    this.classOptionsBySeries.set(map);
  }

  private async loadSeriesDataForProfiles(
    seriesProfiles: any[]
  ): Promise<void> {
    const uniqueSeriesIds = [
      ...new Set(seriesProfiles.map((p) => p.seriesId).filter(Boolean)),
    ];

    const map: Record<string, any> = {};
    for (const seriesId of uniqueSeriesIds) {
      try {
        const series = await this.convex.query(this.convex.api.series.getById, {
          id: seriesId as any,
        });
        if (series) {
          map[String(seriesId)] = series;
        }
      } catch (error) {
        console.error(`Failed to load series data for ${seriesId}:`, error);
      }
    }
    this.seriesData.set(map);
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
          driverId: this._driverId() as any,
          seriesId: this.selectedSeriesId
            ? (this.selectedSeriesId as any)
            : undefined,
        }
      );
      this.penalties.set(data || []);
    } catch (error: any) {
      console.error("Failed to load penalties:", error);
      this.penalties.set([]);
    } finally {
      this.penaltiesLoading.set(false);
    }
  }

  async markAsServed(penaltyId: string): Promise<void> {
    try {
      const userId = this.authService.getUserId();
      if (!userId) {
        console.error("User not authenticated");
        return;
      }

      await this.convex.mutation(
        this.convex.api.driverSeriesPenalties.markAsServed,
        {
          id: penaltyId as any,
          servedBy: userId,
        }
      );

      await this.loadPenalties();
    } catch (error: any) {
      console.error("Failed to mark penalty as served:", error);
    }
  }

  canMarkAsServed(): boolean {
    return this.authService.hasMinimumRole("head_steward");
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
      this.toast.warning("Pick a class first");
      return;
    }

    const shouldAdjustPoints =
      this.adjustPointsOnClassChange()[driverId] || false;
    const points = this.pendingLicensePoints()[driverId];

    try {
      await this.convex.mutation(this.convex.api.drivers.updateDriverClass, {
        driverId: driverId as any,
        newDriverClassId: classId as any,
        userId: currentUserId,
        adjustLicensePoints: shouldAdjustPoints,
        newLicensePoints: shouldAdjustPoints ? (points ?? 0) : undefined,
      });

      this.toast.success("Driver class updated");
      await this.load();
    } catch (error: any) {
      console.error("Failed to update driver class:", error);
      this.toast.error(error?.message || "Failed to update class");
    }
  }

  async saveLicensePoints(driverId: string): Promise<void> {
    const currentUserId = this.authService.getUserId();
    if (!currentUserId) return;

    const points = this.pendingLicensePoints()[driverId];
    if (points === undefined) {
      this.toast.warning("Enter a points value first");
      return;
    }

    try {
      await this.convex.mutation(
        this.convex.api.drivers.updateDriverLicensePoints,
        {
          driverId: driverId as any,
          newPoints: points,
          userId: currentUserId,
        }
      );
      this.toast.success("License points updated");
      await this.load();
    } catch (error: any) {
      console.error("Failed to update license points:", error);
      this.toast.error(error?.message || "Failed to update points");
    }
  }

  formatDate(value: number): string {
    return new Date(value).toLocaleDateString();
  }

  toggleEditDriverClass(driverId: string): void {
    if (this.isDriverMode()) {
      const driver = this.driver();
      if (driver) {
        const currentClassName = driver.driverClass || "";
        const currentClass = this.classOptionsBySeries()[
          driver.championshipId || ""
        ]?.find((c: any) => c.displayName === currentClassName);
        const currentClassId = currentClass?._id || "";
        this.pendingDriverClass.update((state) => ({
          ...state,
          [driverId]: currentClassId,
        }));
      }
    } else {
      const profile = this.visibleProfiles().find(
        (p: any) => p.driverId === driverId,
      );
      if (profile) {
        this.pendingDriverClass.update((state) => ({
          ...state,
          [driverId]: profile.driverClass || "",
        }));
      }
    }
    this.editingDriverClass.update((state) => ({
      ...state,
      [driverId]: true,
    }));
  }

  toggleEditLicensePoints(driverId: string): void {
    if (this.isDriverMode()) {
      const driver = this.driver();
      if (driver) {
        this.pendingLicensePoints.update((state) => ({
          ...state,
          [driverId]: driver.accumulatedLicensePoints || 0,
        }));
      }
    } else {
      const profile = this.visibleProfiles().find(
        (p: any) => p.driverId === driverId,
      );
      if (profile) {
        this.pendingLicensePoints.update((state) => ({
          ...state,
          [driverId]: profile.accumulatedLicensePoints || 0,
        }));
      }
    }
    this.editingLicensePoints.update((state) => ({
      ...state,
      [driverId]: true,
    }));
  }

  cancelEditDriverClass(driverId: string): void {
    this.editingDriverClass.update((state) => ({
      ...state,
      [driverId]: false,
    }));
    this.pendingDriverClass.update((state) => {
      const newState = { ...state };
      delete newState[driverId];
      return newState;
    });
  }

  cancelEditLicensePoints(driverId: string): void {
    this.editingLicensePoints.update((state) => ({
      ...state,
      [driverId]: false,
    }));
    this.pendingLicensePoints.update((state) => {
      const newState = { ...state };
      delete newState[driverId];
      return newState;
    });
  }

  toggleEditOfficialName(): void {
    if (this.isDriverMode()) {
      const linkedUser = this.linkedUser();
      this.pendingOfficialName.set(linkedUser?.officialName || "");
    } else {
      this.pendingOfficialName.set(this.profile()?.user?.officialName || "");
    }
    this.editingOfficialName.set(true);
  }

  cancelEditOfficialName(): void {
    this.editingOfficialName.set(false);
    this.pendingOfficialName.set("");
  }

  setPendingOfficialName(value: string): void {
    this.pendingOfficialName.set(value);
  }

  async saveInlineOfficialName(): Promise<void> {
    const currentUserId = this.authService.getUserId();
    if (!currentUserId) return;

    let targetUserId: string | undefined;
    if (this.isDriverMode()) {
      targetUserId = this.linkedUser()?._id;
    } else {
      targetUserId = this._userId();
    }

    if (!targetUserId) {
      this.toast.error("No linked user found");
      return;
    }

    this.savingOfficialName.set(true);
    try {
      await this.convex.mutation(this.convex.api.users.updateOfficialName, {
        userId: targetUserId as any,
        officialName: this.pendingOfficialName(),
        currentUserId,
      });

      this.toast.success("Official name updated");
      this.editingOfficialName.set(false);
      await this.load();
    } catch (error: any) {
      console.error("Failed to update official name:", error);
      this.toast.error(error?.message || "Failed to update official name");
    } finally {
      this.savingOfficialName.set(false);
    }
  }

  toggleEditLinkedUser(): void {
    const linkedUser = this.linkedUser();
    this.pendingLinkedUserId.set(linkedUser?._id || "");
    this.editingLinkedUser.set(true);
  }

  cancelEditLinkedUser(): void {
    this.editingLinkedUser.set(false);
    this.pendingLinkedUserId.set("");
  }

  setPendingLinkedUserId(value: string): void {
    this.pendingLinkedUserId.set(value);
  }

  async saveInlineLinkedUser(): Promise<void> {
    const currentUserId = this.authService.getUserId();
    if (!currentUserId) return;

    const driverId = this._driverId();
    if (!driverId) return;

    const newUserId = this.pendingLinkedUserId();

    this.savingLinkedUser.set(true);
    try {
      await this.convex.mutation(this.convex.api.drivers.updateUserAssociation, {
        driverId: driverId as any,
        newUserId: newUserId ? (newUserId as any) : undefined,
        userId: currentUserId,
      });

      this.toast.success("Linked user updated");
      this.editingLinkedUser.set(false);
      await this.load();
    } catch (error: any) {
      console.error("Failed to update linked user:", error);
      this.toast.error(error?.message || "Failed to update linked user");
    } finally {
      this.savingLinkedUser.set(false);
    }
  }

  async saveInlineDriverClass(driverId: string): Promise<void> {
    const currentUserId = this.authService.getUserId();
    if (!currentUserId) return;

    const classId = this.pendingDriverClass()[driverId];
    if (!classId) {
      this.toast.warning("Pick a class first");
      return;
    }

    try {
      await this.convex.mutation(this.convex.api.drivers.updateDriverClass, {
        driverId: driverId as any,
        newDriverClassId: classId as any,
        userId: currentUserId,
        adjustLicensePoints: false,
      });

      this.toast.success("Driver class updated");
      this.editingDriverClass.update((state) => ({
        ...state,
        [driverId]: false,
      }));
      await this.load();
    } catch (error: any) {
      console.error("Failed to update driver class:", error);
      this.toast.error(error?.message || "Failed to update class");
    }
  }

  async saveInlineLicensePoints(driverId: string): Promise<void> {
    const currentUserId = this.authService.getUserId();
    if (!currentUserId) return;

    const points = this.pendingLicensePoints()[driverId];
    if (points === undefined) {
      this.toast.warning("Enter a points value first");
      return;
    }

    try {
      await this.convex.mutation(
        this.convex.api.drivers.updateDriverLicensePoints,
        {
          driverId: driverId as any,
          newPoints: points,
          userId: currentUserId,
        }
      );

      this.toast.success("License points updated");
      this.editingLicensePoints.update((state) => ({
        ...state,
        [driverId]: false,
      }));
      await this.load();
    } catch (error: any) {
      console.error("Failed to update license points:", error);
      this.toast.error(error?.message || "Failed to update points");
    }
  }

  setPendingDriverClass(driverId: string, classId: string): void {
    this.pendingDriverClass.update((state) => ({
      ...state,
      [driverId]: classId,
    }));
  }

  seriesOptions = computed(() => {
    return [
      { value: "", label: "All Series" },
      ...this.series().map((s: any) => ({
        value: s._id,
        label: s.name,
      })),
    ];
  });

  userOptions = computed(() => {
    const users = this.allUsers();
    return [
      { value: "", label: "No user linked" },
      ...users.map((u: any) => ({
        value: u._id,
        label: u.officialName || u.name,
      })),
    ];
  });

  private setupFilterDebounce(): void {
    this.seriesFilterSubject
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {});
  }

  getSeriesPenalties(seriesId: string): SeriesPenaltyRow[] {
    const group = this.filteredAndSortedSeriesPenalties().find(
      (g) => g.seriesId === seriesId
    );
    if (!group) return [];

    const column = this.seriesSortColumn()[seriesId] as keyof SeriesPenaltyRow | undefined;
    const direction = this.seriesSortDirection()[seriesId];

    if (!column) return group.penalties;

    return [...group.penalties].sort((a, b) => {
      const aVal = a[column] ?? "";
      const bVal = b[column] ?? "";

      if (typeof aVal === "string" && typeof bVal === "string") {
        return direction === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      if (typeof aVal === "number" && typeof bVal === "number") {
        return direction === "asc" ? aVal - bVal : bVal - aVal;
      }

      if (typeof aVal === "boolean" && typeof bVal === "boolean") {
        return direction === "asc"
          ? (aVal ? 1 : 0) - (bVal ? 1 : 0)
          : (bVal ? 1 : 0) - (aVal ? 1 : 0);
      }

      return 0;
    });
  }

  getSeriesSortColumn(seriesId: string): keyof SeriesPenaltyRow | "" {
    return this.seriesSortColumn()[seriesId] ?? "";
  }

  getSeriesSortDirection(seriesId: string): "asc" | "desc" {
    return this.seriesSortDirection()[seriesId] ?? "asc";
  }

  sortSeriesPenalties(seriesId: string, column: keyof SeriesPenaltyRow): void {
    const currentSortColumn = this.seriesSortColumn();
    const currentSortDirection = this.seriesSortDirection();

    const newDirection =
      currentSortColumn[seriesId] === column
        ? currentSortDirection[seriesId] === "asc"
          ? "desc"
          : "asc"
        : "asc";

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
    if (column !== activeColumn) return "→";
    return direction === "asc" ? "↑" : "↓";
  }

  getClassOptions(championshipId: any): any[] {
    if (!championshipId) return [];
    const options = this.classOptionsBySeries()[championshipId];
    return options || [];
  }
}
