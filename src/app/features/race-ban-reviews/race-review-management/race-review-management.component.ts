import { Component, OnInit, computed, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { ConvexService } from "@core/services/convex.service";
import { AuthService } from "@core/services/auth.service";
import { CardComponent } from "@shared/components/card/card.component";
import { ButtonComponent } from "@shared/components/button/button.component";
import { BadgeComponent } from "@shared/components/badge/badge.component";
import { LoadingComponent } from "@shared/components/loading/loading.component";
import { DateFormatPipe } from "@shared/pipes/date-format.pipe";

interface SlotOption {
  value: string;
  startAt: number;
  endAt: number;
}

@Component({
  selector: "app-race-review-management",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    CardComponent,
    ButtonComponent,
    BadgeComponent,
    LoadingComponent,
    DateFormatPipe,
  ],
  template: `
    <div class="max-w-5xl mx-auto space-y-6">
      @if (loading()) {
        <app-loading text="Loading race review..." />
      } @else if (!review()) {
        <app-card>
          <div class="py-8 text-center">
            <h1 class="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Race review not found
            </h1>
            <p class="mt-2 text-gray-500 dark:text-gray-400">
              The requested race review could not be loaded.
            </p>
            <a routerLink="/" class="mt-4 inline-block">
              <app-button variant="secondary">Back to Dashboard</app-button>
            </a>
          </div>
        </app-card>
      } @else {
        <div class="flex items-start justify-between gap-4">
          <div>
            <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Race Review Management
            </h1>
            <p class="mt-1 text-gray-500 dark:text-gray-400">
              {{ review()!.driver?.driverName }} #{{ review()!.driver?.driverNumber }}
              - {{ review()!.seriesPenalty?.penaltyName }}
            </p>
          </div>
          <app-badge [variant]="statusVariant(review()!.status)">
            {{ statusLabel(review()!.status) }}
          </app-badge>
        </div>

        <app-card title="Request Details">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p class="text-gray-500 dark:text-gray-400">Series</p>
              <p class="font-medium text-gray-900 dark:text-gray-100">
                {{ review()!.series?.name || "Unknown Series" }}
              </p>
            </div>
            <div>
              <p class="text-gray-500 dark:text-gray-400">Threshold</p>
              <p class="font-medium text-gray-900 dark:text-gray-100">
                {{ review()!.threshold?.threshold || "-" }} points
              </p>
            </div>
            <div>
              <p class="text-gray-500 dark:text-gray-400">Submitted</p>
              <p class="font-medium text-gray-900 dark:text-gray-100">
                {{ review()!.createdAt | dateFormat: "PPp" }}
              </p>
            </div>
            <div>
              <p class="text-gray-500 dark:text-gray-400">Penalty Served</p>
              <p class="font-medium text-gray-900 dark:text-gray-100">
                {{ review()!.driverPenalty?.isServed ? "Yes" : "No" }}
              </p>
            </div>
          </div>

          @if (review()!.selectedMeetingStartAt) {
            <div class="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900/30 dark:bg-blue-950/20">
              <p class="text-sm text-blue-800 dark:text-blue-200">
                Scheduled meeting:
                {{ review()!.selectedMeetingStartAt | dateFormat: "PPp" }}
                @if (review()!.selectedMeetingEndAt) {
                  to {{ review()!.selectedMeetingEndAt | dateFormat: "p" }}
                }
              </p>
            </div>
          }

          @if (review()!.notificationError) {
            <div class="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/30 dark:bg-amber-950/20">
              <p class="text-sm text-amber-800 dark:text-amber-200">
                Discord notification warning: {{ review()!.notificationError }}
              </p>
            </div>
          }
        </app-card>

        <app-card title="Driver Availability">
          @if (slotOptions().length === 0) {
            <p class="text-gray-500 dark:text-gray-400">
              No availability windows were submitted.
            </p>
          } @else {
            <div class="space-y-3">
              @for (slot of slotOptions(); track slot.value) {
                <label
                  class="flex items-start gap-3 rounded-lg border border-gray-200 p-3 cursor-pointer hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  <input
                    type="radio"
                    name="slotSelection"
                    [value]="slot.value"
                    [(ngModel)]="selectedSlotValue"
                    class="mt-1 h-4 w-4 border-gray-300 text-primary-600 focus:ring-primary-500"
                    [disabled]="!canManage() || review()!.status === 'completed'"
                  />
                  <div>
                    <p class="font-medium text-gray-900 dark:text-gray-100">
                      {{ slot.startAt | dateFormat: "PPp" }}
                    </p>
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                      Ends {{ slot.endAt | dateFormat: "p" }}
                    </p>
                  </div>
                </label>
              }
            </div>
          }

          @if (canManage() && review()!.status !== "completed") {
            <div class="mt-4 flex flex-wrap gap-2">
              <app-button
                [loading]="scheduling() || notifying()"
                [disabled]="!selectedSlotValue"
                (onClick)="scheduleSelectedSlot()"
              >
                {{ review()!.status === "scheduled" ? "Reschedule" : "Confirm Meeting Time" }}
              </app-button>

              @if (!review()!.driverPenalty?.isServed) {
                <app-button
                  variant="secondary"
                  [loading]="markingServed()"
                  (onClick)="markPenaltyAsServed()"
                >
                  Mark Penalty as Served
                </app-button>
              }

              <app-button
                variant="success"
                [loading]="markingCompleted()"
                (onClick)="markCompleted()"
              >
                Mark Review Completed
              </app-button>
            </div>
          }
        </app-card>

        <app-card title="At-Fault Reports">
          @if (review()!.reports?.length === 0) {
            <p class="text-gray-500 dark:text-gray-400">
              No finalized at-fault reports found for this series.
            </p>
          } @else {
            <div class="overflow-x-auto">
              <table class="w-full">
                <thead class="bg-gray-50 dark:bg-gray-800">
                  <tr class="text-left text-sm text-gray-500 dark:text-gray-400">
                    <th class="px-4 py-3 font-medium">Ticket #</th>
                    <th class="px-4 py-3 font-medium">Event / Race</th>
                    <th class="px-4 py-3 font-medium">Penalty</th>
                    <th class="px-4 py-3 font-medium">Date</th>
                    <th class="px-4 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
                  @for (report of review()!.reports; track report._id) {
                    <tr class="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td class="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                        {{ report.reportId ?? "-" }}
                      </td>
                      <td class="px-4 py-3 text-gray-700 dark:text-gray-300">
                        {{ report.eventName }} - Race {{ report.raceNumber ?? "-" }}
                      </td>
                      <td class="px-4 py-3 text-gray-700 dark:text-gray-300">
                        {{ report.appliedPenaltyName || "No Penalty" }}
                      </td>
                      <td class="px-4 py-3 text-gray-500 dark:text-gray-400">
                        {{ report.finalizedAt | dateFormat: "PP" }}
                      </td>
                      <td class="px-4 py-3">
                        <a
                          [routerLink]="['/reports', report._id]"
                          class="text-primary-600 hover:text-primary-700 font-medium text-sm dark:text-primary-400 dark:hover:text-primary-300"
                        >
                          Open Report
                        </a>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </app-card>
      }
    </div>
  `,
})
export class RaceReviewManagementComponent implements OnInit {
  private readonly convex = inject(ConvexService);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(true);
  readonly review = signal<any | null>(null);
  readonly scheduling = signal(false);
  readonly notifying = signal(false);
  readonly markingCompleted = signal(false);
  readonly markingServed = signal(false);
  selectedSlotValue = "";

  readonly slotOptions = computed<SlotOption[]>(() => {
    const review = this.review();
    if (!review?.availabilityWindows) {
      return [];
    }
    return review.availabilityWindows.map((window: any) => ({
      value: `${window.startAt}|${window.endAt}`,
      startAt: window.startAt,
      endAt: window.endAt,
    }));
  });

  ngOnInit(): void {
    void this.loadReview();
  }

  canManage(): boolean {
    return this.authService.hasRole("head_steward", "league_manager");
  }

  statusLabel(status: "open" | "scheduled" | "completed"): string {
    switch (status) {
      case "scheduled":
        return "Scheduled";
      case "completed":
        return "Completed";
      default:
        return "Open";
    }
  }

  statusVariant(
    status: "open" | "scheduled" | "completed",
  ): "warning" | "info" | "success" {
    switch (status) {
      case "scheduled":
        return "info";
      case "completed":
        return "success";
      default:
        return "warning";
    }
  }

  async scheduleSelectedSlot(): Promise<void> {
    const userId = this.authService.getUserId();
    const review = this.review();
    if (!review || !userId || !this.selectedSlotValue) {
      return;
    }

    const [startString, endString] = this.selectedSlotValue.split("|");
    const selectedMeetingStartAt = Number(startString);
    const selectedMeetingEndAt = Number(endString);

    if (!Number.isFinite(selectedMeetingStartAt) || !Number.isFinite(selectedMeetingEndAt)) {
      alert("Please choose a valid availability slot.");
      return;
    }

    this.scheduling.set(true);
    try {
      await this.convex.mutation(this.convex.api.raceBanReviews.scheduleMeeting, {
        id: review._id,
        scheduledBy: userId,
        selectedMeetingStartAt,
        selectedMeetingEndAt,
      });

      this.notifying.set(true);
      const payload = await this.convex.query(
        this.convex.api.raceBanReviews.getNotificationPayload,
        { id: review._id },
      );

      if (!payload) {
        await this.convex.mutation(this.convex.api.raceBanReviews.recordNotificationResult, {
          id: review._id,
          sent: false,
          error: "No scheduled meeting data found for notification.",
        });
      } else {
        const notificationResult = await this.convex.action(
          this.convex.api.raceBanReviews.sendScheduledMeetingNotification,
          {
            discordId: payload.discordId ?? undefined,
            message: payload.message,
          },
        );

        await this.convex.mutation(this.convex.api.raceBanReviews.recordNotificationResult, {
          id: review._id,
          sent: notificationResult.sent,
          error: notificationResult.error,
        });
      }

      await this.loadReview();
    } catch (error: any) {
      console.error("Failed to schedule meeting:", error);
      alert(error?.message || "Failed to schedule the meeting.");
    } finally {
      this.scheduling.set(false);
      this.notifying.set(false);
    }
  }

  async markCompleted(): Promise<void> {
    const userId = this.authService.getUserId();
    const review = this.review();
    if (!review || !userId) {
      return;
    }

    this.markingCompleted.set(true);
    try {
      await this.convex.mutation(this.convex.api.raceBanReviews.markCompleted, {
        id: review._id,
        completedBy: userId,
      });
      await this.loadReview();
    } catch (error: any) {
      console.error("Failed to mark review completed:", error);
      alert(error?.message || "Failed to complete review.");
    } finally {
      this.markingCompleted.set(false);
    }
  }

  async markPenaltyAsServed(): Promise<void> {
    const userId = this.authService.getUserId();
    const review = this.review();
    if (!review || !userId || !review.driverSeriesPenaltyId) {
      return;
    }

    this.markingServed.set(true);
    try {
      await this.convex.mutation(this.convex.api.driverSeriesPenalties.markAsServed, {
        id: review.driverSeriesPenaltyId,
        servedBy: userId,
      });
      await this.loadReview();
    } catch (error: any) {
      console.error("Failed to mark penalty as served:", error);
      alert(error?.message || "Failed to mark penalty as served.");
    } finally {
      this.markingServed.set(false);
    }
  }

  private async loadReview(): Promise<void> {
    const reviewId = this.route.snapshot.paramMap.get("id");
    const userId = this.authService.getUserId();
    if (!reviewId || !userId) {
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    try {
      const review = await this.convex.query(this.convex.api.raceBanReviews.getById, {
        id: reviewId as any,
        userId,
      });
      this.review.set(review);
      if (review?.selectedMeetingStartAt && review?.selectedMeetingEndAt) {
        this.selectedSlotValue = `${review.selectedMeetingStartAt}|${review.selectedMeetingEndAt}`;
      } else {
        this.selectedSlotValue = "";
      }
    } catch (error) {
      console.error("Failed to load race review:", error);
      this.review.set(null);
    } finally {
      this.loading.set(false);
    }
  }
}
