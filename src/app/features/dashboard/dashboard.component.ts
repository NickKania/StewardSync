import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ConvexService } from '@core/services/convex.service';
import { AuthService } from '@core/services/auth.service';
import { CardComponent } from '@shared/components/card/card.component';
import { ButtonComponent } from '@shared/components/button/button.component';
import { BadgeComponent } from '@shared/components/badge/badge.component';
import { LoadingComponent } from '@shared/components/loading/loading.component';
import { HasRoleDirective } from '@shared/directives/has-role.directive';
import { DateFormatPipe, TimeAgoPipe } from '@shared/pipes/date-format.pipe';

@Component({
  selector: 'app-dashboard',
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
    TimeAgoPipe
  ],
  template: `
    <div class="space-y-6">
      <!-- Welcome header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">
            Welcome back, {{ authService.user()?.name?.split(' ')[0] }}
          </h1>
          <p class="text-gray-500 mt-1">Here's what's happening with your reports</p>
        </div>
        <a routerLink="/reports/new">
          <app-button variant="primary">
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
            </svg>
            New Report
          </app-button>
        </a>
      </div>

      <!-- Stats grid -->
      @if (stats()) {
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <app-card>
            <div class="text-center">
              <p class="text-3xl font-bold text-gray-900">{{ stats()?.total || 0 }}</p>
              <p class="text-sm text-gray-500 mt-1">Total Reports</p>
            </div>
          </app-card>
          <app-card>
            <div class="text-center">
              <p class="text-3xl font-bold text-amber-600">{{ stats()?.pending || 0 }}</p>
              <p class="text-sm text-gray-500 mt-1">Pending Review</p>
            </div>
          </app-card>
          <app-card>
            <div class="text-center">
              <p class="text-3xl font-bold text-blue-600">{{ stats()?.reviewed || 0 }}</p>
              <p class="text-sm text-gray-500 mt-1">Under Review</p>
            </div>
          </app-card>
          <app-card>
            <div class="text-center">
              <p class="text-3xl font-bold text-green-600">{{ stats()?.finalized || 0 }}</p>
              <p class="text-sm text-gray-500 mt-1">Finalized</p>
            </div>
          </app-card>
        </div>
      } @else {
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          @for (i of [1,2,3,4]; track i) {
            <app-card>
              <div class="animate-pulse text-center">
                <div class="h-8 bg-gray-200 rounded w-16 mx-auto"></div>
                <div class="h-4 bg-gray-200 rounded w-24 mx-auto mt-2"></div>
              </div>
            </app-card>
          }
        </div>
      }

      <!-- Quick actions for stewards -->
      <div *appHasRole="['steward', 'head_steward', 'event_manager']" class="grid md:grid-cols-2 gap-6">
        <app-card title="Pending Reviews" subtitle="Reports waiting for your review">
          @if (pendingReports().length > 0) {
            <div class="space-y-3">
              @for (report of pendingReports().slice(0, 5); track report._id) {
                <a
                  [routerLink]="['/reviews', report._id]"
                  class="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <p class="font-medium text-gray-900">
                      {{ report.reportedDriver?.driverName }} - Turn {{ report.turn }}
                    </p>
                    <p class="text-sm text-gray-500">
                      {{ report.event?.trackName }} - Race {{ report.race?.raceNumber }}
                    </p>
                  </div>
                  <app-badge variant="warning">Pending</app-badge>
                </a>
              }
            </div>
            @if (pendingReports().length > 5) {
              <div class="mt-4 pt-4 border-t border-gray-200">
                <a routerLink="/reviews" class="text-sm text-primary-600 hover:text-primary-700 font-medium">
                  View all {{ pendingReports().length }} pending reports →
                </a>
              </div>
            }
          } @else {
            <p class="text-gray-500 text-center py-8">No reports pending review</p>
          }
        </app-card>

        <app-card title="Recent Activity">
          @if (recentReports().length > 0) {
            <div class="space-y-3">
              @for (report of recentReports().slice(0, 5); track report._id) {
                <a
                  [routerLink]="['/reports', report._id]"
                  class="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <p class="font-medium text-gray-900">
                      {{ report.reportedDriver?.driverName }}
                    </p>
                    <p class="text-sm text-gray-500">
                      {{ report.reportDate | timeAgo }}
                    </p>
                  </div>
                  <app-badge [variant]="getStatusVariant(report.status)">
                    {{ report.status }}
                  </app-badge>
                </a>
              }
            </div>
          } @else {
            <p class="text-gray-500 text-center py-8">No recent activity</p>
          }
        </app-card>
      </div>

      <!-- Recent reports for drivers -->
      <app-card title="Recent Reports" subtitle="Your latest incident reports">
        @if (recentReports().length > 0) {
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead>
                <tr class="text-left text-sm text-gray-500 border-b border-gray-200">
                  <th class="pb-3 font-medium">Reported Driver</th>
                  <th class="pb-3 font-medium">Event</th>
                  <th class="pb-3 font-medium">Date</th>
                  <th class="pb-3 font-medium">Status</th>
                  <th class="pb-3 font-medium"></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                @for (report of recentReports(); track report._id) {
                  <tr class="hover:bg-gray-50">
                    <td class="py-3">
                      <p class="font-medium text-gray-900">{{ report.reportedDriver?.driverName }}</p>
                      <p class="text-sm text-gray-500">#{{ report.reportedDriver?.driverNumber }}</p>
                    </td>
                    <td class="py-3">
                      <p class="text-gray-900">{{ report.event?.trackName }}</p>
                      <p class="text-sm text-gray-500">Race {{ report.race?.raceNumber }}, Turn {{ report.turn }}</p>
                    </td>
                    <td class="py-3 text-gray-500">
                      {{ report.reportDate | dateFormat:'PP' }}
                    </td>
                    <td class="py-3">
                      <app-badge [variant]="getStatusVariant(report.status)">
                        {{ report.status }}
                      </app-badge>
                    </td>
                    <td class="py-3">
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
        } @else {
          <div class="text-center py-12">
            <svg class="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            <p class="text-gray-500 mb-4">No reports filed yet</p>
            <a routerLink="/reports/new">
              <app-button variant="primary">File Your First Report</app-button>
            </a>
          </div>
        }
      </app-card>
    </div>
  `
})
export class DashboardComponent implements OnInit, OnDestroy {
  private convex = inject(ConvexService);
  authService = inject(AuthService);

  stats = signal<any>(null);
  recentReports = signal<any[]>([]);
  pendingReports = signal<any[]>([]);

  private unsubscribes: (() => void)[] = [];

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    this.unsubscribes.forEach(unsub => unsub());
  }

  private loadData(): void {
    // Load stats
    const statsQuery = this.convex.createReactiveQuery(
      this.convex.api.reports.getStats,
      {}
    );
    this.unsubscribes.push(statsQuery.unsubscribe);

    // Subscribe to stats changes
    const checkStats = setInterval(() => {
      const data = statsQuery.data();
      if (data) {
        this.stats.set(data);
      }
    }, 100);
    this.unsubscribes.push(() => clearInterval(checkStats));

    // Load recent reports
    const reportsQuery = this.convex.createReactiveQuery(
      this.convex.api.reports.list,
      { limit: 10 }
    );
    this.unsubscribes.push(reportsQuery.unsubscribe);

    const checkReports = setInterval(() => {
      const data = reportsQuery.data();
      if (data) {
        this.recentReports.set(data);
      }
    }, 100);
    this.unsubscribes.push(() => clearInterval(checkReports));

    // Load pending reports for stewards
    if (this.authService.hasRole('steward', 'head_steward', 'event_manager')) {
      const pendingQuery = this.convex.createReactiveQuery(
        this.convex.api.reports.getPendingForReview,
        {}
      );
      this.unsubscribes.push(pendingQuery.unsubscribe);

      const checkPending = setInterval(() => {
        const data = pendingQuery.data();
        if (data) {
          this.pendingReports.set(data);
        }
      }, 100);
      this.unsubscribes.push(() => clearInterval(checkPending));
    }
  }

  getStatusVariant(status: string): 'warning' | 'info' | 'success' | 'danger' {
    switch (status) {
      case 'pending': return 'warning';
      case 'reviewed': return 'info';
      case 'finalized': return 'success';
      case 'rejected': return 'danger';
      default: return 'info';
    }
  }
}
