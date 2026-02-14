import {
  Component,
  inject,
  OnInit,
  OnDestroy,
  signal,
  computed,
  Input,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { Router, RouterLink } from "@angular/router";
import { ConvexService } from "@core/services/convex.service";
import { AuthService } from "@core/services/auth.service";
import { CardComponent } from "@shared/components/card/card.component";
import { ButtonComponent } from "@shared/components/button/button.component";
import { BadgeComponent } from "@shared/components/badge/badge.component";
import { LoadingComponent } from "@shared/components/loading/loading.component";
import { HasRoleDirective } from "@shared/directives/has-role.directive";
import { DateFormatPipe, TimeAgoPipe } from "@shared/pipes/date-format.pipe";
import { ModalComponent } from "@shared/components/modal/modal.component";
import { EditDecisionComponent } from "../edit-decision/edit-decision.component";

@Component({
  selector: "app-report-detail",
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    CardComponent,
    ButtonComponent,
    BadgeComponent,
    LoadingComponent,
    HasRoleDirective,
    DateFormatPipe,
    TimeAgoPipe,
    ModalComponent,
    EditDecisionComponent,
  ],
  template: `
    <div class="space-y-6">
      @if (loading()) {
        <app-loading text="Loading report..." />
      } @else if (report()) {
        <!-- Header -->
        <div
          class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4"
        >
          <div>
            <div class="flex items-center gap-3 mb-2">
              <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Incident Report
              </h1>
              <app-badge [variant]="getStatusVariant(report()?.status)">
                {{ formatReportStatus(report()?.status) }}
              </app-badge>
            </div>
            <p class="text-gray-500 dark:text-gray-400">
              Filed {{ report()?.reportDate | timeAgo }} at
              {{ report()?.event?.trackName }}
            </p>
          </div>
          <div class="flex gap-3">
            @if (!report()?.isFinalized) {
              <a [routerLink]="['/reports', report()?._id, 'edit']">
                <app-button variant="secondary">
                  <svg
                    class="w-4 h-4 mr-2"
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
                  Edit
                </app-button>
              </a>
            }
            <div *appHasRole="['steward', 'head_steward', 'league_manager']">
              @if (!report()?.isFinalized) {
                <a [routerLink]="['/reviews', report()?._id]">
                  <app-button variant="primary">
                    @if (hasUserReviewed()) {
                      <svg
                        class="w-4 h-4 mr-2"
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
                      Edit Review
                    } @else {
                      <svg
                        class="w-4 h-4 mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                        ></path>
                      </svg>
                      Review
                    }
                  </app-button>
                </a>
              }
            </div>
          </div>
        </div>

        <div class="grid lg:grid-cols-3 gap-6">
          <!-- Main content -->
          <div class="lg:col-span-2 space-y-6">
            <!-- Incident details -->
            <app-card title="Incident Details">
              <dl class="grid sm:grid-cols-2 gap-4">
                <div>
                  <dt class="text-sm text-gray-500 dark:text-gray-400">
                    Event
                  </dt>
                  <dd class="font-medium text-gray-900 dark:text-gray-100">
                    {{ report()?.event?.trackName }}
                  </dd>
                  <dd class="text-sm text-gray-500 dark:text-gray-400">
                    {{ report()?.event?.series?.name }} Round
                    {{ report()?.event?.eventNumber }}
                  </dd>
                </div>
                <div>
                  <dt class="text-sm text-gray-500 dark:text-gray-400">
                    Race & Location
                  </dt>
                  <dd class="font-medium text-gray-900 dark:text-gray-100">
                    Race {{ report()?.race?.raceNumber }}, Lap
                    {{ report()?.lap }}, Turn {{ report()?.turn }}
                  </dd>
                </div>
                <div>
                  <dt class="text-sm text-gray-500 dark:text-gray-400">
                    Video Timestamp
                  </dt>
                  <dd class="font-medium text-gray-900 dark:text-gray-100">
                    {{ report()?.videoTimestamp || "Not specified" }}
                  </dd>
                </div>
                <div>
                  <dt class="text-sm text-gray-500 dark:text-gray-400">
                    Reported Driver
                  </dt>
                  <dd class="font-medium text-gray-900 dark:text-gray-100">
                    {{
                      report()?.reportedDriver?.displayName ||
                        report()?.reportedDriver?.officialName ||
                        report()?.reportedDriver?.driverName
                    }}
                  </dd>
                  <dd class="text-sm text-gray-500 dark:text-gray-400">
                    #{{ report()?.reportedDriver?.driverNumber }} -
                    {{ report()?.reportedDriver?.driverClass }}
                  </dd>
                </div>
                <div>
                  <dt class="text-sm text-gray-500 dark:text-gray-400">
                    Reported By
                  </dt>
                  <dd class="font-medium text-gray-900 dark:text-gray-100">
                    {{
                      report()?.reportingUser?.officialName ||
                        report()?.reportingUser?.name ||
                        "Unknown User"
                    }}
                  </dd>
                  @if (report()?.isStewardReported) {
                    <app-badge variant="info" size="sm">Steward</app-badge>
                  }
                </div>
              </dl>

              <div
                class="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700"
              >
                <dt class="text-sm text-gray-500 mb-2 dark:text-gray-400">
                  Description
                </dt>
                <dd
                  class="text-gray-900 whitespace-pre-wrap dark:text-gray-100"
                >
                  {{ report()?.description }}
                </dd>
              </div>
            </app-card>

            <!-- Final decision (if finalized) -->
            @if (report()?.isFinalized) {
              <app-card>
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <h3
                      class="text-lg font-semibold text-gray-900 dark:text-gray-100"
                    >
                      Official Decision
                    </h3>
                    @if (report()?.isEdited) {
                      <app-badge variant="warning" size="sm">Edited</app-badge>
                    }
                  </div>
                  @if (authService.hasRole("head_steward", "league_manager")) {
                    <app-button
                      variant="secondary"
                      size="sm"
                      (onClick)="openEditDecisionModal()"
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
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        ></path>
                      </svg>
                      Edit
                    </app-button>
                  }
                </div>
                <div class="space-y-4 mt-4">
                  <div>
                    <dt class="text-sm text-gray-500 dark:text-gray-400">
                      Decision
                    </dt>
                    <dd class="font-medium text-gray-900 dark:text-gray-100">
                      {{ report()?.finalDecision }}
                    </dd>
                  </div>
                  <div>
                    <dt class="text-sm text-gray-500 dark:text-gray-400">
                      At Fault Driver
                    </dt>
                    @if (report()?.atFaultDriver) {
                      <dd class="font-medium text-gray-900 dark:text-gray-100">
                        {{
                          report()?.atFaultDriver?.displayName ||
                            report()?.atFaultDriver?.officialName ||
                            report()?.atFaultDriver?.driverName
                        }}
                      </dd>
                      <dd class="text-sm text-gray-500 dark:text-gray-400">
                        #{{ report()?.atFaultDriver?.driverNumber }} -
                        {{ report()?.atFaultDriver?.driverClass }}
                      </dd>
                    } @else {
                      <dd
                        class="text-sm text-gray-500 italic dark:text-gray-400"
                      >
                        Not assigned
                      </dd>
                    }
                  </div>
                  @if (report()?.appliedPenaltyObj) {
                    <div>
                      <dt class="text-sm text-gray-500 dark:text-gray-400">
                        Penalty Applied
                      </dt>
                      <dd class="font-medium text-gray-900 dark:text-gray-100">
                        {{ report()?.appliedPenaltyObj?.name }}
                      </dd>
                      <dd class="text-sm text-gray-500 mt-1 dark:text-gray-400">
                        Time: {{ report()?.appliedPenaltyObj?.timePenalty }}s /
                        Lap 1:
                        {{ report()?.appliedPenaltyObj?.timePenaltyLap1 }}s / SR
                        Reduction:
                        {{
                          report()?.appliedPenaltyObj?.selfReportReduction ?? 0
                        }}s | License Points:
                        {{ report()?.appliedPenaltyObj?.licensePoints }}
                      </dd>
                    </div>
                  }
                  @if (report()?.officialNotes) {
                    <div>
                      <dt class="text-sm text-gray-500 dark:text-gray-400">
                        Official Notes
                      </dt>
                      <dd
                        class="text-gray-900 whitespace-pre-wrap dark:text-gray-100"
                      >
                        {{ report()?.officialNotes }}
                      </dd>
                    </div>
                  }
                  @if (adjustedReviews().length > 0) {
                    <div
                      class="pt-4 border-t border-gray-200 dark:border-gray-700"
                    >
                      <dt class="text-sm text-gray-500 mb-2 dark:text-gray-400">
                        Review Adjustments
                      </dt>
                      <div class="space-y-2">
                        @for (
                          adjustedReview of adjustedReviews();
                          track adjustedReview._id
                        ) {
                          <div
                            class="bg-amber-50 border border-amber-200 rounded-lg p-3"
                          >
                            <div class="flex items-center justify-between mb-1">
                              <span
                                class="font-medium text-gray-900 dark:text-gray-100"
                                >{{
                                  adjustedReview.reviewer?.officialName ||
                                    adjustedReview.reviewer?.name
                                }}</span
                              >
                            </div>
                            <p class="text-sm text-amber-800">
                              {{ adjustedReview.adjustedReason }}
                            </p>
                          </div>
                        }
                      </div>
                    </div>
                  }
                  <div class="text-sm text-gray-500 dark:text-gray-400">
                    Finalized {{ report()?.finalizedAt | dateFormat: "PPp" }}
                  </div>
                  @if (report()?.isEdited) {
                    <div class="text-sm text-gray-500 dark:text-gray-400">
                      Edited by
                      {{
                        report()?.editedByUser?.officialName ||
                          report()?.editedByUser?.name ||
                          report()?.finalizedByUser?.officialName ||
                          report()?.finalizedByUser?.name ||
                          "Unknown User"
                      }}
                      @if (report()?.editedAt) {
                        on {{ report()?.editedAt | dateFormat: "PPp" }}
                      }
                    </div>
                  }
                </div>
              </app-card>
            }

            <!-- Reviews -->
            @if (reviews().length > 0) {
              <app-card title="Steward Reviews">
                <div class="space-y-4">
                  @for (review of reviews(); track review._id) {
                    <div class="p-4 bg-gray-50 rounded-lg dark:bg-gray-800">
                      <div class="flex items-start justify-between mb-3">
                        <div>
                          @if (review.linkedReview) {
                            <div class="flex items-center gap-2">
                              <app-badge variant="success" size="sm"
                                >Joint Review</app-badge
                              >
                              <p
                                class="font-medium text-gray-900 dark:text-gray-100"
                              >
                                {{
                                  review.reviewer?.officialName ||
                                    review.reviewer?.name
                                }}
                                &
                                {{
                                  review.linkedReview.reviewer?.officialName ||
                                    review.linkedReview.reviewer?.name
                                }}
                              </p>
                            </div>
                          } @else {
                            <p
                              class="font-medium text-gray-900 dark:text-gray-100"
                            >
                              {{
                                review.reviewer?.officialName ||
                                  review.reviewer?.name
                              }}
                            </p>
                          }
                          <p class="text-sm text-gray-500 dark:text-gray-400">
                            {{ review.reviewDate | timeAgo }}
                          </p>
                        </div>
                        @if (review.recommendedPenaltyObj) {
                          <app-badge variant="info">
                            {{ review.recommendedPenaltyObj.name }}
                          </app-badge>
                        }
                      </div>
                      <div *appHasRole="['steward', 'head_steward', 'league_manager']">
                        <p class="text-gray-700 text-sm dark:text-gray-300">
                          {{ review.reviewNotes }}
                        </p>
                        @if (review.videoTimestamp) {
                          <p
                            class="text-sm text-gray-500 mt-2 dark:text-gray-400"
                          >
                            Video timestamp: {{ review.videoTimestamp }}
                          </p>
                        }
                      </div>
                    </div>
                  }
                </div>
              </app-card>
            }
          </div>

          <!-- Sidebar -->
          <div class="space-y-6">
            <!-- Status card -->
            <app-card title="Status">
              <div class="space-y-4">
                <div class="flex items-center gap-3">
                  <div
                    class="w-10 h-10 rounded-full flex items-center justify-center"
                    [class.bg-amber-100]="report()?.status === 'pending'"
                    [class.bg-blue-100]="report()?.status === 'reviewed'"
                    [class.bg-green-100]="report()?.status === 'finalized'"
                    [class.bg-red-100]="report()?.status === 'rejected'"
                  >
                    @switch (report()?.status) {
                      @case ("pending") {
                        <svg
                          class="w-5 h-5 text-amber-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          ></path>
                        </svg>
                      }
                      @case ("reviewed") {
                        <svg
                          class="w-5 h-5 text-blue-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          ></path>
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          ></path>
                        </svg>
                      }
                      @case ("finalized") {
                        <svg
                          class="w-5 h-5 text-green-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          ></path>
                        </svg>
                      }
                      @case ("rejected") {
                        <svg
                          class="w-5 h-5 text-red-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                          ></path>
                        </svg>
                      }
                    }
                  </div>
                  <div>
                    <p
                      class="font-medium text-gray-900 capitalize dark:text-gray-100"
                    >
                      {{ formatReportStatus(report()?.status) }}
                    </p>
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                      @switch (report()?.status) {
                        @case ("pending") {
                          Awaiting steward review
                        }
                        @case ("reviewed") {
                          Ready for finalization
                        }
                        @case ("finalized") {
                          Decision published
                        }
                        @case ("rejected") {
                          Report dismissed
                        }
                      }
                    </p>
                  </div>
                </div>

                <div class="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    {{ report()?.reviews?.length || 0 }} review(s) submitted
                  </p>
                </div>
              </div>
            </app-card>

            <!-- Quick actions -->
            <div *appHasRole="['head_steward', 'league_manager']">
              @if (report()?.status === "reviewed" && !report()?.isFinalized) {
                <app-card title="Actions">
                  <a [routerLink]="['/finalize', report()?._id]" class="block">
                    <app-button variant="success" [fullWidth]="true">
                      Finalize Report
                    </app-button>
                  </a>
                </app-card>
              }
            </div>
          </div>
        </div>
      } @else {
        <app-card>
          <div class="text-center py-12">
            <p class="text-gray-500 dark:text-gray-400">Report not found</p>
            <a routerLink="/reports" class="mt-4 inline-block">
              <app-button variant="primary">Back to Reports</app-button>
            </a>
          </div>
        </app-card>
      }
    </div>

    <!-- Edit decision modal -->
    <app-modal
      [isOpen]="showEditDecisionModal()"
      title="Edit Finalized Decision"
      size="lg"
      (close)="showEditDecisionModal.set(false)"
    >
      @if (report()) {
        <app-edit-decision
          [report]="report()"
          (success)="editDecisionSuccess()"
          (close)="showEditDecisionModal.set(false)"
        />
      }
    </app-modal>
  `,
})
export class ReportDetailComponent implements OnInit, OnDestroy {
  @Input() id!: string;

  private convex = inject(ConvexService);
  authService = inject(AuthService);

  report = signal<any>(null);
  loading = signal(true);
  showEditDecisionModal = signal(false);

  hasUserReviewed = computed(() => {
    const reportData = this.report();
    const currentUserId = this.authService.getUserId();
    if (!reportData?.reviews || !currentUserId) return false;
    return reportData.reviews.some(
      (review: any) => String(review.userId) === String(currentUserId),
    );
  });

  private unsubscribes: (() => void)[] = [];

  reviews = computed(() => {
    const allReviews = this.report()?.reviews || [];
    const seen = new Set<string>();
    const result: any[] = [];

    for (const review of allReviews) {
      const id = String(review._id);

      if (seen.has(id)) continue;

      if (review.linkedReviewId) {
        seen.add(id);
        const linkedId = String(review.linkedReviewId);
        seen.add(linkedId);
      }

      result.push(review);
    }

    return result;
  });

  adjustedReviews = computed(() => {
    const allReviews = this.report()?.reviews || [];

    if (allReviews.length === 0) return [];

    const latestReview = allReviews.reduce((latest: any, current: any) => {
      const latestDate = latest.reviewDate || latest.createdAt || 0;
      const currentDate = current.reviewDate || current.createdAt || 0;
      return currentDate > latestDate ? current : latest;
    });

    if (latestReview.isAdjusted && latestReview.adjustedReason) {
      return [latestReview];
    }

    return [];
  });

  ngOnInit(): void {
    this.loadReport();
  }

  ngOnDestroy(): void {
    this.unsubscribes.forEach((unsub) => unsub());
  }

  private loadReport(): void {
    if (!this.id) {
      this.loading.set(false);
      return;
    }

    const reportQuery = this.convex.createReactiveQuery(
      this.convex.api.reports.getById,
      { reportId: this.id as any },
    );
    this.unsubscribes.push(reportQuery.unsubscribe);

    const checkReport = setInterval(() => {
      const data = reportQuery.data();
      if (data !== undefined) {
        this.report.set(data);
        this.loading.set(false);
      }
    }, 100);
    this.unsubscribes.push(() => clearInterval(checkReport));
  }

  getStatusVariant(
    status: string | undefined,
  ): "warning" | "info" | "success" | "danger" {
    switch (status) {
      case "pending":
        return "warning";
      case "reviewed":
        return "info";
      case "finalized":
        return "success";
      case "rejected":
        return "danger";
      default:
        return "info";
    }
  }

  formatReportStatus(status: string | undefined): string {
    if (!status) return "";
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  editDecisionSuccess(): void {
    this.showEditDecisionModal.set(false);
    this.loadReport();
  }

  openEditDecisionModal(): void {
    this.showEditDecisionModal.set(true);
  }
}
