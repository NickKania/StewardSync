import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ConvexService } from '@core/services/convex.service';
import { CardComponent } from '@shared/components/card/card.component';
import { ButtonComponent } from '@shared/components/button/button.component';
import { BadgeComponent } from '@shared/components/badge/badge.component';
import { SelectComponent, SelectOption } from '@shared/components/select/select.component';
import { LoadingComponent } from '@shared/components/loading/loading.component';
import { DateFormatPipe } from '@shared/pipes/date-format.pipe';

@Component({
  selector: 'app-report-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    CardComponent,
    ButtonComponent,
    BadgeComponent,
    SelectComponent,
    LoadingComponent,
    DateFormatPipe
  ],
  template: `
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Reports</h1>
          <p class="text-gray-500 mt-1">View and manage incident reports</p>
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

      <!-- Filters -->
      <app-card>
        <div class="flex flex-wrap gap-4">
          <div class="w-48">
            <app-select
              label="Status"
              [options]="statusOptions"
              [(ngModel)]="selectedStatus"
              (ngModelChange)="filterReports()"
              placeholder="All statuses"
            />
          </div>
          <div class="w-48">
            <app-select
              label="Event"
              [options]="eventOptions()"
              [(ngModel)]="selectedEvent"
              (ngModelChange)="filterReports()"
              placeholder="All events"
            />
          </div>
        </div>
      </app-card>

      <!-- Reports table -->
      <app-card [noPadding]="true">
        @if (loading()) {
          <div class="py-12">
            <app-loading text="Loading reports..." />
          </div>
        } @else if (filteredReports().length > 0) {
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-gray-50">
                <tr class="text-left text-sm text-gray-500">
                  <th class="px-6 py-3 font-medium">Reported Driver</th>
                  <th class="px-6 py-3 font-medium">Reporting Driver</th>
                  <th class="px-6 py-3 font-medium">Event</th>
                  <th class="px-6 py-3 font-medium">Turn</th>
                  <th class="px-6 py-3 font-medium">Date</th>
                  <th class="px-6 py-3 font-medium">Status</th>
                  <th class="px-6 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                @for (report of filteredReports(); track report._id) {
                  <tr class="hover:bg-gray-50">
                    <td class="px-6 py-4">
                      <p class="font-medium text-gray-900">{{ report.reportedDriver?.driverName }}</p>
                      <p class="text-sm text-gray-500">#{{ report.reportedDriver?.driverNumber }}</p>
                    </td>
                    <td class="px-6 py-4">
                      <p class="text-gray-900">{{ report.reportingDriver?.driverName }}</p>
                      <p class="text-sm text-gray-500">#{{ report.reportingDriver?.driverNumber }}</p>
                    </td>
                    <td class="px-6 py-4">
                      <p class="text-gray-900">{{ report.event?.trackName }}</p>
                      <p class="text-sm text-gray-500">Race {{ report.race?.raceNumber }}</p>
                    </td>
                    <td class="px-6 py-4 text-gray-900">{{ report.turn }}</td>
                    <td class="px-6 py-4 text-gray-500">
                      {{ report.reportDate | dateFormat:'PP' }}
                    </td>
                    <td class="px-6 py-4">
                      <app-badge [variant]="getStatusVariant(report.status)">
                        {{ report.status }}
                      </app-badge>
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
        } @else {
          <div class="text-center py-12">
            <svg class="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            <p class="text-gray-500 mb-4">No reports found</p>
            <a routerLink="/reports/new">
              <app-button variant="primary">File a Report</app-button>
            </a>
          </div>
        }
      </app-card>
    </div>
  `
})
export class ReportListComponent implements OnInit, OnDestroy {
  private convex = inject(ConvexService);

  reports = signal<any[]>([]);
  filteredReports = signal<any[]>([]);
  events = signal<any[]>([]);
  loading = signal(true);

  selectedStatus = '';
  selectedEvent = '';

  statusOptions: SelectOption[] = [
    { value: '', label: 'All statuses' },
    { value: 'pending', label: 'Pending' },
    { value: 'reviewed', label: 'Reviewed' },
    { value: 'finalized', label: 'Finalized' },
    { value: 'rejected', label: 'Rejected' }
  ];

  eventOptions = signal<SelectOption[]>([{ value: '', label: 'All events' }]);

  private unsubscribes: (() => void)[] = [];

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    this.unsubscribes.forEach(unsub => unsub());
  }

  private loadData(): void {
    // Load reports
    const reportsQuery = this.convex.createReactiveQuery(
      this.convex.api.reports.list,
      {}
    );
    this.unsubscribes.push(reportsQuery.unsubscribe);

    const checkReports = setInterval(() => {
      const data = reportsQuery.data();
      if (data) {
        this.reports.set(data);
        this.filterReports();
        this.loading.set(false);
      }
    }, 100);
    this.unsubscribes.push(() => clearInterval(checkReports));

    // Load events for filter
    const eventsQuery = this.convex.createReactiveQuery(
      this.convex.api.events.list,
      {}
    );
    this.unsubscribes.push(eventsQuery.unsubscribe);

    const checkEvents = setInterval(() => {
      const data = eventsQuery.data();
      if (data) {
        this.events.set(data);
        this.eventOptions.set([
          { value: '', label: 'All events' },
          ...data.map((e: any) => ({
            value: e._id,
            label: `${e.trackName} (${e.series})`
          }))
        ]);
      }
    }, 100);
    this.unsubscribes.push(() => clearInterval(checkEvents));
  }

  filterReports(): void {
    let filtered = [...this.reports()];

    if (this.selectedStatus) {
      filtered = filtered.filter(r => r.status === this.selectedStatus);
    }

    if (this.selectedEvent) {
      filtered = filtered.filter(r => r.eventId === this.selectedEvent);
    }

    this.filteredReports.set(filtered);
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
