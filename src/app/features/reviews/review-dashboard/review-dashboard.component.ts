import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ConvexService } from '@core/services/convex.service';
import { AuthService } from '@core/services/auth.service';
import { CardComponent } from '@shared/components/card/card.component';
import { ButtonComponent } from '@shared/components/button/button.component';
import { BadgeComponent } from '@shared/components/badge/badge.component';
import { LoadingComponent } from '@shared/components/loading/loading.component';
import { DateFormatPipe, TimeAgoPipe } from '@shared/pipes/date-format.pipe';

@Component({
  selector: 'app-review-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    CardComponent,
    ButtonComponent,
    BadgeComponent,
    LoadingComponent,
    DateFormatPipe,
    TimeAgoPipe
  ],
  template: `
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Review Queue</h1>
          <p class="text-gray-500 mt-1">Reports pending your review</p>
        </div>
        <a routerLink="/reviews/steward-incident">
          <app-button variant="primary">
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
            </svg>
            Create Incident
          </app-button>
        </a>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <app-card>
          <div class="text-center">
            <p class="text-3xl font-bold text-amber-600">{{ pendingReports().length }}</p>
            <p class="text-sm text-gray-500 mt-1">Pending Review</p>
          </div>
        </app-card>
        <app-card>
          <div class="text-center">
            <p class="text-3xl font-bold text-gray-900">{{ reviewStats()?.total || 0 }}</p>
            <p class="text-sm text-gray-500 mt-1">Your Total Reviews</p>
          </div>
        </app-card>
        <app-card>
          <div class="text-center">
            <p class="text-3xl font-bold text-green-600">{{ reviewStats()?.today || 0 }}</p>
            <p class="text-sm text-gray-500 mt-1">Reviewed Today</p>
          </div>
        </app-card>
        <app-card>
          <div class="text-center">
            <p class="text-3xl font-bold text-blue-600">{{ reviewedReports().length }}</p>
            <p class="text-sm text-gray-500 mt-1">Ready to Finalize</p>
          </div>
        </app-card>
      </div>

      <!-- Pending reports -->
      <app-card title="Pending Reviews" [noPadding]="true">
        @if (loading()) {
          <div class="py-12">
            <app-loading text="Loading reports..." />
          </div>
        } @else if (pendingReports().length > 0) {
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-gray-50">
                <tr class="text-left text-sm text-gray-500">
                  <th class="px-6 py-3 font-medium">At Fault Driver</th>
                  <th class="px-6 py-3 font-medium">Event</th>
                  <th class="px-6 py-3 font-medium">Incident</th>
                  <th class="px-6 py-3 font-medium">Filed</th>
                  <th class="px-6 py-3 font-medium">Reviews</th>
                  <th class="px-6 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                 @for (report of pendingReports(); track report._id) {
                  <tr class="hover:bg-gray-50">
                    <td class="px-6 py-4">
                      <p class="font-medium text-gray-900">{{ report.atFaultDriver?.driverName || report.reportedDriver?.driverName }}</p>
                      <p class="text-sm text-gray-500">#{{ report.atFaultDriver?.driverNumber || report.reportedDriver?.driverNumber }}</p>
                    </td>
                    <td class="px-6 py-4">
                      <p class="text-gray-900">{{ report.event?.trackName }}</p>
                      <p class="text-sm text-gray-500">Race {{ report.race?.raceNumber }}</p>
                    </td>
                    <td class="px-6 py-4">
                      <p class="text-gray-900">Turn {{ report.turn }}</p>
                      <p class="text-sm text-gray-500 truncate max-w-xs">
                        {{ report.description }}
                      </p>
                    </td>
                    <td class="px-6 py-4 text-gray-500 text-sm">
                      {{ report.reportDate | timeAgo }}
                    </td>
                    <td class="px-6 py-4">
                      <app-badge [variant]="report.reviewCount > 0 ? 'info' : 'default'">
                        {{ report.reviewCount || 0 }} review(s)
                      </app-badge>
                    </td>
                    <td class="px-6 py-4">
                      <a
                        [routerLink]="['/reviews', report._id]"
                        class="text-primary-600 hover:text-primary-700 font-medium text-sm"
                      >
                        Review
                      </a>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <div class="text-center py-12">
            <svg class="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <p class="text-gray-500">No reports pending review</p>
            <p class="text-sm text-gray-400 mt-1">All caught up!</p>
          </div>
        }
      </app-card>

      <!-- Already reviewed (ready for finalization) -->
      @if (reviewedReports().length > 0) {
        <app-card title="Ready for Finalization" subtitle="These reports have been reviewed and await final decision" [noPadding]="true">
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-gray-50">
                <tr class="text-left text-sm text-gray-500">
                  <th class="px-6 py-3 font-medium">At Fault Driver</th>
                  <th class="px-6 py-3 font-medium">Event</th>
                  <th class="px-6 py-3 font-medium">Reviews</th>
                  <th class="px-6 py-3 font-medium">Status</th>
                  <th class="px-6 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                 @for (report of reviewedReports(); track report._id) {
                  <tr class="hover:bg-gray-50">
                    <td class="px-6 py-4">
                      <p class="font-medium text-gray-900">{{ report.atFaultDriver?.driverName || report.reportedDriver?.driverName }}</p>
                      <p class="text-sm text-gray-500">#{{ report.atFaultDriver?.driverNumber || report.reportedDriver?.driverNumber }}</p>
                    </td>
                    <td class="px-6 py-4">
                      <p class="text-gray-900">{{ report.event?.trackName }}</p>
                      <p class="text-sm text-gray-500">Race {{ report.race?.raceNumber }}, Turn {{ report.turn }}</p>
                    </td>
                    <td class="px-6 py-4">
                      <app-badge variant="info">
                        {{ report.reviewCount || 0 }} review(s)
                      </app-badge>
                    </td>
                    <td class="px-6 py-4">
                      <app-badge variant="info">Reviewed</app-badge>
                    </td>
                    <td class="px-6 py-4">
                      <a
                        [routerLink]="['/reports', report._id]"
                        class="text-primary-600 hover:text-primary-700 font-medium text-sm"
                      >
                        View
                      </a>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </app-card>
      }
    </div>
  `
})
export class ReviewDashboardComponent implements OnInit, OnDestroy {
  private convex = inject(ConvexService);
  private authService = inject(AuthService);

  pendingReports = signal<any[]>([]);
  reviewedReports = signal<any[]>([]);
  reviewStats = signal<any>(null);
  loading = signal(true);

  private unsubscribes: (() => void)[] = [];

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    this.unsubscribes.forEach(unsub => unsub());
  }

  private loadData(): void {
    // Load pending reports
    const pendingQuery = this.convex.createReactiveQuery(
      this.convex.api.reports.getPendingForReview,
      {}
    );
    this.unsubscribes.push(pendingQuery.unsubscribe);

    const checkPending = setInterval(() => {
      const data = pendingQuery.data();
      if (data !== undefined) {
        this.pendingReports.set(data);
        this.loading.set(false);
      }
    }, 100);
    this.unsubscribes.push(() => clearInterval(checkPending));

    // Load reviewed reports (ready for finalization)
    const reviewedQuery = this.convex.createReactiveQuery(
      this.convex.api.reports.getReadyForFinalization,
      {}
    );
    this.unsubscribes.push(reviewedQuery.unsubscribe);

    const checkReviewed = setInterval(() => {
      const data = reviewedQuery.data();
      if (data !== undefined) {
        this.reviewedReports.set(data);
      }
    }, 100);
    this.unsubscribes.push(() => clearInterval(checkReviewed));

    // Load review stats for current user
    const userId = this.authService.getUserId();
    if (userId) {
      const statsQuery = this.convex.createReactiveQuery(
        this.convex.api.reviews.getStats,
        { userId }
      );
      this.unsubscribes.push(statsQuery.unsubscribe);

      const checkStats = setInterval(() => {
        const data = statsQuery.data();
        if (data !== undefined) {
          this.reviewStats.set(data);
        }
      }, 100);
      this.unsubscribes.push(() => clearInterval(checkStats));
    }
  }
}
