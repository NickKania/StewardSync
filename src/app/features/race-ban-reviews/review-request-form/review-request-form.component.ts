import { Component, OnInit, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { ConvexService } from "@core/services/convex.service";
import { AuthService } from "@core/services/auth.service";
import { CardComponent } from "@shared/components/card/card.component";
import { ButtonComponent } from "@shared/components/button/button.component";
import { LoadingComponent } from "@shared/components/loading/loading.component";
import { DateFormatPipe } from "@shared/pipes/date-format.pipe";

interface AvailabilityRow {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
}

@Component({
  selector: "app-race-ban-review-request-form",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    CardComponent,
    ButtonComponent,
    LoadingComponent,
    DateFormatPipe,
  ],
  template: `
    <div class="max-w-3xl mx-auto space-y-6">
      @if (loading()) {
        <app-loading text="Loading review request..." />
      } @else if (!requirement()) {
        <app-card>
          <div class="py-8 text-center">
            <h1 class="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Race review request unavailable
            </h1>
            <p class="mt-2 text-gray-500 dark:text-gray-400">
              This penalty either does not require review, or you do not have access.
            </p>
            <a routerLink="/driver-dashboard" class="mt-4 inline-block">
              <app-button variant="secondary">Back to Dashboard</app-button>
            </a>
          </div>
        </app-card>
      } @else {
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Race Ban Review Request
          </h1>
          <p class="mt-1 text-gray-500 dark:text-gray-400">
            Submit your availability to meet with a head steward or league manager.
          </p>
        </div>

        <app-card>
          <div class="space-y-4">
            <div class="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/30 dark:bg-amber-950/20">
              <p class="text-sm text-amber-900 dark:text-amber-100">
                Please try to provide at least 24 hours notice. Same-day requests may not
                be honored. You will receive a Discord notification once a meeting
                date/time is confirmed.
              </p>
            </div>

            <div class="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
              <h2 class="font-semibold text-gray-900 dark:text-gray-100">
                Penalty Requiring Review
              </h2>
              <p class="mt-1 text-gray-700 dark:text-gray-300">
                {{ requirement()!.penalty.penaltyName }}
              </p>
              <p class="text-sm text-gray-500 dark:text-gray-400">
                Driver: {{ requirement()!.driver.driverName }} #{{ requirement()!.driver.driverNumber }}
              </p>
              @if (requirement()!.existingRequest?.status === "scheduled") {
                <p class="mt-2 text-sm text-blue-700 dark:text-blue-300">
                  Meeting already scheduled for
                  {{
                    requirement()!.existingRequest!.selectedMeetingStartAt
                      | dateFormat: "PPp"
                  }}
                </p>
              }
            </div>

            @if (requirement()!.existingRequest?.status === "completed") {
              <div class="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900/30 dark:bg-green-950/20">
                <p class="text-sm text-green-800 dark:text-green-200">
                  This race review has already been completed.
                </p>
              </div>
            } @else if (requirement()!.existingRequest?.status === "scheduled") {
              <div class="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/30 dark:bg-blue-950/20">
                <p class="text-sm text-blue-800 dark:text-blue-200">
                  This meeting is already scheduled. Contact a head steward if you
                  need to reschedule.
                </p>
              </div>
            } @else {
              <div class="space-y-3">
                <div class="flex items-center justify-between">
                  <h3 class="font-semibold text-gray-900 dark:text-gray-100">
                    Your Available Date/Time Ranges
                  </h3>
                  <app-button variant="secondary" size="sm" (onClick)="addAvailabilityRow()">
                    Add Range
                  </app-button>
                </div>

                @for (row of availabilityRows(); track row.id) {
                  <div class="grid grid-cols-1 md:grid-cols-4 gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                    <div class="md:col-span-2">
                      <label class="label">Date</label>
                      <input
                        type="date"
                        class="input w-full"
                        [(ngModel)]="row.date"
                      />
                    </div>
                    <div>
                      <label class="label">Start</label>
                      <input
                        type="time"
                        class="input w-full"
                        [(ngModel)]="row.startTime"
                      />
                    </div>
                    <div>
                      <div class="flex items-center justify-between">
                        <label class="label">End</label>
                        @if (availabilityRows().length > 1) {
                          <button
                            type="button"
                            class="text-xs text-red-600 hover:text-red-700"
                            (click)="removeAvailabilityRow(row.id)"
                          >
                            Remove
                          </button>
                        }
                      </div>
                      <input
                        type="time"
                        class="input w-full"
                        [(ngModel)]="row.endTime"
                      />
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        </app-card>

        <div class="flex justify-end gap-3">
          <a routerLink="/driver-dashboard">
            <app-button variant="secondary">Cancel</app-button>
          </a>
          @if (
            requirement()!.existingRequest?.status !== "completed" &&
            requirement()!.existingRequest?.status !== "scheduled"
          ) {
            <app-button [loading]="saving()" (onClick)="submit()">
              {{ requirement()!.existingRequest ? "Update Request" : "Submit Request" }}
            </app-button>
          }
        </div>
      }
    </div>
  `,
})
export class ReviewRequestFormComponent implements OnInit {
  private readonly convex = inject(ConvexService);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly requirement = signal<any | null>(null);
  readonly availabilityRows = signal<AvailabilityRow[]>([this.createAvailabilityRow()]);

  ngOnInit(): void {
    void this.loadRequirement();
  }

  addAvailabilityRow(): void {
    this.availabilityRows.update((rows) => [...rows, this.createAvailabilityRow()]);
  }

  removeAvailabilityRow(id: string): void {
    this.availabilityRows.update((rows) =>
      rows.length > 1 ? rows.filter((row) => row.id !== id) : rows,
    );
  }

  async submit(): Promise<void> {
    const userId = this.authService.getUserId();
    const driverSeriesPenaltyId = this.route.snapshot.paramMap.get("driverSeriesPenaltyId");
    if (!userId || !driverSeriesPenaltyId) {
      return;
    }

    const windows = this.availabilityRows()
      .map((row) => this.rowToWindow(row))
      .filter((window) => window !== null) as Array<{ startAt: number; endAt: number }>;

    if (windows.length === 0) {
      alert("Please add at least one valid date/time range.");
      return;
    }

    this.saving.set(true);
    try {
      await this.convex.mutation(this.convex.api.raceBanReviews.createOrUpdateRequest, {
        driverSeriesPenaltyId: driverSeriesPenaltyId as any,
        userId,
        availabilityWindows: windows,
      });

      await this.router.navigate(["/driver-dashboard"]);
    } catch (error: any) {
      console.error("Failed to submit race review request:", error);
      alert(error?.message || "Failed to submit request.");
    } finally {
      this.saving.set(false);
    }
  }

  private async loadRequirement(): Promise<void> {
    const userId = this.authService.getUserId();
    const driverSeriesPenaltyId = this.route.snapshot.paramMap.get("driverSeriesPenaltyId");

    if (!userId || !driverSeriesPenaltyId) {
      this.loading.set(false);
      return;
    }

    try {
      const requirement = await this.convex.query(
        this.convex.api.raceBanReviews.getDriverRequirement,
        {
          driverSeriesPenaltyId: driverSeriesPenaltyId as any,
          userId,
        },
      );

      this.requirement.set(requirement);

      const existingWindows = requirement?.existingRequest?.availabilityWindows ?? [];
      if (existingWindows.length > 0) {
        this.availabilityRows.set(
          existingWindows.map((window: { startAt: number; endAt: number }) =>
            this.windowToRow(window),
          ),
        );
      }
    } catch (error) {
      console.error("Failed to load race review requirement:", error);
      this.requirement.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  private createAvailabilityRow(): AvailabilityRow {
    return {
      id: `availability-${Date.now()}-${Math.random()}`,
      date: "",
      startTime: "",
      endTime: "",
    };
  }

  private rowToWindow(
    row: AvailabilityRow,
  ): { startAt: number; endAt: number } | null {
    if (!row.date || !row.startTime || !row.endTime) {
      return null;
    }

    const start = new Date(`${row.date}T${row.startTime}`);
    const end = new Date(`${row.date}T${row.endTime}`);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return null;
    }

    if (end.getTime() <= start.getTime()) {
      return null;
    }

    return {
      startAt: start.getTime(),
      endAt: end.getTime(),
    };
  }

  private windowToRow(window: { startAt: number; endAt: number }): AvailabilityRow {
    const start = new Date(window.startAt);
    const end = new Date(window.endAt);
    const localDate = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;

    return {
      id: `availability-${start.getTime()}-${end.getTime()}`,
      date: localDate,
      startTime: start.toTimeString().slice(0, 5),
      endTime: end.toTimeString().slice(0, 5),
    };
  }
}
