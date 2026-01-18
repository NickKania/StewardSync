import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ConvexService } from '@core/services/convex.service';
import { AuthService } from '@core/services/auth.service';
import { CardComponent } from '@shared/components/card/card.component';
import { ButtonComponent } from '@shared/components/button/button.component';
import { BadgeComponent } from '@shared/components/badge/badge.component';
import { LoadingComponent } from '@shared/components/loading/loading.component';
import { DateFormatPipe } from '@shared/pipes/date-format.pipe';
import { Id } from '@convex/_generated/dataModel';

@Component({
  selector: 'app-driver-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    CardComponent,
    ButtonComponent,
    BadgeComponent,
    LoadingComponent,
    DateFormatPipe
  ],
  template: `
    <div class="space-y-6">
      @if (loading()) {
        <app-loading text="Loading your dashboard..." />
      } @else if (!driver()) {
        <app-card>
          <div class="text-center py-12">
            <svg class="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
            </svg>
            <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Driver Record Not Found</h2>
            <p class="text-gray-500 dark:text-gray-400 mb-4">
              We couldn't find a driver record linked to your Discord ID. Please contact an administrator to link your account.
            </p>
            <a href="mailto:admin@stewardsync.com" class="text-primary-600 hover:text-primary-700 font-medium dark:text-primary-400 dark:hover:text-primary-300">
              Contact an Admin
            </a>
          </div>
        </app-card>
      } @else {
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Welcome back, {{ authService.user()!.name.split(' ')[0] }}
            </h1>
            <p class="text-gray-500 dark:text-gray-400 mt-1">Here's what's happening with your penalties and reports</p>
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

        <app-card title="Series Penalties" subtitle="Accumulated penalties from license points">
          @if (loadingSeriesPenalties()) {
            <app-loading text="Loading penalties..." />
          } @else if (seriesPenaltiesGrouped().length === 0) {
            <p class="text-gray-500 dark:text-gray-400 text-center py-8">No series penalties</p>
          } @else {
            @for (seriesGroup of seriesPenaltiesGrouped(); track seriesGroup.seriesName) {
              <div class="mb-6 last:mb-0">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center">
                  {{ seriesGroup.seriesName }}
                  <span class="ml-3 text-sm font-normal text-gray-500 dark:text-gray-400">
                    ({{ seriesGroup.penalties.length }} {{ seriesGroup.penalties.length === 1 ? 'penalty' : 'penalties' }})
                  </span>
                </h3>
                <div class="overflow-x-auto">
                  <table class="w-full">
                    <thead>
                      <tr class="text-left text-sm text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                        <th class="pb-3 font-medium">Penalty</th>
                        <th class="pb-3 font-medium">Threshold</th>
                        <th class="pb-3 font-medium">Points at Assignment</th>
                        <th class="pb-3 font-medium">Assigned Date</th>
                        <th class="pb-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
                      @for (penalty of seriesGroup.penalties; track penalty._id) {
                        <tr>
                          <td class="py-3 font-medium text-gray-900 dark:text-gray-100">{{ penalty.penaltyName }}</td>
                          <td class="py-3 text-gray-700 dark:text-gray-300">{{ penalty.threshold }} points</td>
                          <td class="py-3 text-gray-700 dark:text-gray-300">{{ penalty.pointsAtAssignment }} points</td>
                          <td class="py-3 text-gray-500 dark:text-gray-400">{{ penalty.assignedAt | dateFormat:'PPP' }}</td>
                          <td class="py-3">
                            <app-badge [variant]="penalty.isServed ? 'success' : 'danger'">
                              {{ penalty.isServed ? 'Served' : 'Active' }}
                            </app-badge>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            }
          }
        </app-card>

        <app-card title="Individual Penalties" subtitle="Penalties from specific incidents">
          @if (loadingIndividualPenalties()) {
            <app-loading text="Loading penalties..." />
          } @else if (individualPenalties().length === 0) {
            <p class="text-gray-500 dark:text-gray-400 text-center py-8">No individual penalties</p>
          } @else {
            <div class="overflow-x-auto">
              <table class="w-full">
                <thead>
                  <tr class="text-left text-sm text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    <th class="pb-3 font-medium">Event</th>
                    <th class="pb-3 font-medium">Race/Turn</th>
                    <th class="pb-3 font-medium">Penalty</th>
                    <th class="pb-3 font-medium">Severity</th>
                    <th class="pb-3 font-medium">Time Penalty</th>
                    <th class="pb-3 font-medium">Decision</th>
                    <th class="pb-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
                  @for (penalty of individualPenalties(); track penalty.reportId) {
                    <tr class="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td class="py-3 font-medium text-gray-900 dark:text-gray-100">{{ penalty.event?.trackName }}</td>
                      <td class="py-3 text-gray-700 dark:text-gray-300">R{{ penalty.race?.raceNumber }} T{{ penalty.turn }}</td>
                      <td class="py-3 font-medium text-gray-900 dark:text-gray-100">{{ penalty.appliedPenalty?.name }}</td>
                      <td class="py-3">
                        <app-badge variant="warning">{{ penalty.appliedPenalty?.licensePoints }} pts</app-badge>
                      </td>
                      <td class="py-3 text-gray-700 dark:text-gray-300">{{ penalty.appliedPenalty?.timePenalty }}s</td>
                      <td class="py-3 text-sm text-gray-600 dark:text-gray-400 truncate max-w-xs">{{ penalty.finalDecision }}</td>
                      <td class="py-3 text-gray-500 dark:text-gray-400">
                        {{ penalty.finalizedAt | dateFormat:'PPP' }}
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </app-card>

        <app-card title="Your Finalized Reports" subtitle="Reports you filed that have been completed">
          @if (loadingReports()) {
            <app-loading text="Loading reports..." />
          } @else if (finalizedReports().length === 0) {
            <div class="text-center py-12">
              <svg class="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              <p class="text-gray-500 dark:text-gray-400 mb-4">No finalized reports yet</p>
              <a routerLink="/reports/new">
                <app-button variant="primary">File Your First Report</app-button>
              </a>
            </div>
          } @else {
            <div class="overflow-x-auto">
              <table class="w-full">
                <thead>
                  <tr class="text-left text-sm text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    <th class="pb-3 font-medium">Reported Driver</th>
                    <th class="pb-3 font-medium">Event</th>
                    <th class="pb-3 font-medium">Race/Turn</th>
                    <th class="pb-3 font-medium">Date</th>
                    <th class="pb-3 font-medium">Penalty Applied</th>
                    <th class="pb-3 font-medium">Final Decision</th>
                    <th class="pb-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
                  @for (report of finalizedReports(); track report._id) {
                    <tr class="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td class="py-3">
                        <p class="font-medium text-gray-900 dark:text-gray-100">{{ report.reportedDriver?.driverName }}</p>
                        <p class="text-sm text-gray-500 dark:text-gray-400">#{{ report.reportedDriver?.driverNumber }}</p>
                      </td>
                      <td class="py-3 text-gray-700 dark:text-gray-300">{{ report.event?.trackName }}</td>
                      <td class="py-3 text-gray-700 dark:text-gray-300">R{{ report.race?.raceNumber }} T{{ report.turn }}</td>
                      <td class="py-3 text-gray-500 dark:text-gray-400">{{ report.reportDate | dateFormat:'PPP' }}</td>
                      <td class="py-3">
                        @if (report.appliedPenalty) {
                          <app-badge variant="warning">{{ report.appliedPenalty?.name }}</app-badge>
                        } @else {
                          <span class="text-gray-400 dark:text-gray-500">None</span>
                        }
                      </td>
                      <td class="py-3 text-sm text-gray-600 dark:text-gray-400 truncate max-w-xs">{{ report.finalDecision }}</td>
                      <td class="py-3">
                        <a [routerLink]="['/reports', report._id]" class="text-primary-600 hover:text-primary-700 font-medium text-sm dark:text-primary-400 dark:hover:text-primary-300">
                          View
                        </a>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            @if (totalReports() > PAGE_SIZE) {
              <div class="flex items-center justify-between mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  Showing {{ (currentPage() - 1) * PAGE_SIZE + 1 }} to {{ maxShown() }} of {{ totalReports() }} reports
                </p>
                <div class="flex gap-2">
                  <button
                    [disabled]="currentPage() === 1"
                    (click)="goToPage(currentPage() - 1)"
                    [class.opacity-50]="currentPage() === 1"
                    [class.cursor-not-allowed]="currentPage() === 1"
                    class="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  @for (pageNum of visiblePageNumbers(); track pageNum) {
                    <button
                      [class.bg-primary-600]="pageNum === currentPage()"
                      [class.text-white]="pageNum === currentPage()"
                      [class.bg-white]="pageNum !== currentPage()"
                      [class.text-gray-700]="pageNum !== currentPage()"
                      [class.dark:bg-gray-800]="pageNum !== currentPage()"
                      [class.dark:text-gray-300]="pageNum !== currentPage()"
                      [class.hover:bg-gray-50]="pageNum !== currentPage()"
                      [class.dark:hover:bg-gray-700]="pageNum !== currentPage()"
                      (click)="goToPage(pageNum)"
                      class="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 min-w-[40px]"
                    >
                      {{ pageNum }}
                    </button>
                  }
                  <button
                    [disabled]="currentPage() === totalPages()"
                    (click)="goToPage(currentPage() + 1)"
                    [class.opacity-50]="currentPage() === totalPages()"
                    [class.cursor-not-allowed]="currentPage() === totalPages()"
                    class="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            }
          }
        </app-card>
      }
    </div>
  `
})
export class DriverDashboardComponent implements OnInit, OnDestroy {
  private convex = inject(ConvexService);
  authService = inject(AuthService);

  loading = signal(true);
  driver = signal<any>(null);

  loadingSeriesPenalties = signal(true);
  seriesPenaltiesGrouped = signal<any[]>([]);

  loadingIndividualPenalties = signal(true);
  individualPenalties = signal<any[]>([]);

  loadingReports = signal(true);
  finalizedReports = signal<any[]>([]);
  totalReports = signal(0);
  currentPage = signal(1);

  readonly PAGE_SIZE = 10;
  private unsubscribes: (() => void)[] = [];

  ngOnInit(): void {
    this.loadDriverAndData();
  }

  ngOnDestroy(): void {
    this.unsubscribes.forEach(unsub => unsub());
  }

  private async loadDriverAndData(): Promise<void> {
    const userId = this.authService.getUserId();
    if (!userId) {
      this.loading.set(false);
      return;
    }

    const user = await this.convex.query(
      this.convex.api.auth.getCurrentUser,
      { userId }
    );

    if (!user?.discordId) {
      this.loading.set(false);
      return;
    }

    const driver = await this.convex.query(
      this.convex.api.drivers.getByUsername,
      { username: user.discordId }
    );

    this.driver.set(driver);
    this.loading.set(false);

    if (!driver) return;

    this.loadSeriesPenalties(driver._id);
    this.loadIndividualPenalties(driver._id);
    this.loadFinalizedReports(driver._id);
  }

  private loadSeriesPenalties(driverId: Id<'drivers'>): void {
    const query = this.convex.createReactiveQuery(
      this.convex.api.driverSeriesPenalties.getDriverPenaltyDetails,
      { driverId }
    );
    this.unsubscribes.push(query.unsubscribe);

    const check = setInterval(() => {
      const data = query.data();
      if (data) {
        const grouped = this.groupPenaltiesBySeries(data);
        this.seriesPenaltiesGrouped.set(grouped);
        this.loadingSeriesPenalties.set(false);
      }
    }, 100);
    this.unsubscribes.push(() => clearInterval(check));
  }

  private loadIndividualPenalties(driverId: Id<'drivers'>): void {
    const query = this.convex.createReactiveQuery(
      this.convex.api.reports.getDriverIndividualPenalties,
      { driverId }
    );
    this.unsubscribes.push(query.unsubscribe);

    const check = setInterval(() => {
      const data = query.data();
      if (data) {
        this.individualPenalties.set(data);
        this.loadingIndividualPenalties.set(false);
      }
    }, 100);
    this.unsubscribes.push(() => clearInterval(check));
  }

  private loadFinalizedReports(driverId: Id<'drivers'>): void {
    this.refreshReports();

    const interval = setInterval(() => {
      this.refreshReports();
    }, 100);
    this.unsubscribes.push(() => clearInterval(interval));
  }

  private async refreshReports(): Promise<void> {
    const skip = (this.currentPage() - 1) * this.PAGE_SIZE;

    const data = await this.convex.query(
      this.convex.api.reports.getDriverFinalizedReports,
      { driverId: this.driver()._id, limit: this.PAGE_SIZE, skip }
    );

    if (data) {
      this.finalizedReports.set(data.reports);
      this.totalReports.set(data.total);
      this.loadingReports.set(false);
    }
  }

  private groupPenaltiesBySeries(penalties: any[]): any[] {
    const groups = new Map<string, any[]>();

    penalties.forEach(p => {
      const key = p.seriesName || 'Unknown Series';
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(p);
    });

    return Array.from(groups.entries()).map(([seriesName, penalties]) => ({
      seriesName,
      penalties: penalties.sort((a, b) => b.assignedAt - a.assignedAt),
    })).sort((a, b) => a.seriesName.localeCompare(b.seriesName));
  }

  maxShown(): number {
    return Math.min(this.currentPage() * this.PAGE_SIZE, this.totalReports());
  }

  goToPage(page: number): void {
    this.currentPage.set(page);
    this.loadFinalizedReports(this.driver()._id);
  }

  totalPages(): number {
    return Math.ceil(this.totalReports() / this.PAGE_SIZE);
  }

  visiblePageNumbers(): number[] {
    const total = this.totalPages();
    const current = this.currentPage();
    const delta = 2;

    const range: number[] = [];
    const rangeWithDots: (number | string)[] = [];
    let l: number | undefined;

    range.push(1);
    for (let i = current - delta; i <= current + delta; i++) {
      if (i > 1 && i < total) {
        range.push(i);
      }
    }
    range.push(total);

    for (let i of range) {
      if (l) {
        if (i - l === 2) {
          rangeWithDots.push(l + 1);
        } else if (i - l !== 1) {
          rangeWithDots.push('...');
        }
      }
      rangeWithDots.push(i);
      l = i;
    }

    return rangeWithDots.filter(n => n !== '...') as number[];
  }
}
