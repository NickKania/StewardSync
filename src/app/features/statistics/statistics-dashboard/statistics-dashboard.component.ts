import { Component, inject, OnInit, OnDestroy, signal, computed, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConvexService } from '@core/services/convex.service';
import { AuthService } from '@core/services/auth.service';
import { CardComponent } from '@shared/components/card/card.component';
import { BadgeComponent } from '@shared/components/badge/badge.component';
import { LoadingComponent } from '@shared/components/loading/loading.component';
import { ButtonComponent } from '@shared/components/button/button.component';
import { SelectComponent, SelectOption } from '@shared/components/select/select.component';
import { TabsComponent, Tab } from '@shared/components/tabs/tabs.component';
import html2canvas from 'html2canvas';

interface EventRundownRow {
  reportId: string;
  carNumber: number | null;
  driverName: string | null;
  driverClass: string | null;
  incidentDescription: string;
  penaltyName: string | null;
  timePenaltySeconds: number;
  isSelfReport: boolean;
}

interface DriverPointsRow {
  driverId: string;
  driverNumber: number;
  driverName: string;
  driverClass: string;
  totalLicensePoints: number;
  eligibleSeriesPenalties: any[];
}

@Component({
  selector: 'app-statistics-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardComponent,
    BadgeComponent,
    LoadingComponent,
    ButtonComponent,
    SelectComponent,
    TabsComponent
  ],
  template: `
    <div class="space-y-6">
      <h1 class="text-2xl font-bold text-gray-900">Statistics</h1>

      @if (loading()) {
        <div>
          <app-loading text="Loading..." />
        </div>
      } @else {
        <app-tabs [tabs]="visibleTabs()" [activeTab]="activeTab()" (activeTabChange)="selectTab($event)" />

        @if (activeTab() === 'event_rundown') {
          <div class="space-y-6">
            <app-card title="Event Rundown">
              <div class="space-y-4">
                <div>
                  <label class="label">Select Event</label>
                  <app-select
                    [options]="eventOptions()"
                    [(ngModel)]="selectedEventId"
                    (ngModelChange)="loadEventRundown()"
                    placeholder="Choose an event"
                  />
                 </div>

                 @if (eventRundown().length > 0) {
                   <div class="flex items-center justify-between mb-4 gap-4">
                     <div class="flex-1 max-w-md">
                       <input
                         type="text"
                         class="input w-full"
                         placeholder="Filter by any field..."
                         [(ngModel)]="eventFilterText"
                       />
                     </div>
                     <app-button
                       variant="secondary"
                       size="sm"
                       (onClick)="exportEventRundownAsImage()"
                     >
                       <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                         <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                       </svg>
                       Export as Image
                     </app-button>
                    </div>
                    @if (filteredAndSortedEventRundown().length > 0) {
                    <div #eventRundownTable class="overflow-x-auto">
                     <table class="w-full text-sm">
                        <thead class="bg-gray-50">
                          <tr class="text-left">
                            <th class="px-4 py-2 font-medium text-gray-500 cursor-pointer hover:text-gray-700" (click)="sortEventRundown('carNumber')">
                              Car # {{ getSortIcon('carNumber', eventSortColumn(), eventSortDirection()) }}
                            </th>
                            <th class="px-4 py-2 font-medium text-gray-500 cursor-pointer hover:text-gray-700" (click)="sortEventRundown('driverName')">
                              Driver {{ getSortIcon('driverName', eventSortColumn(), eventSortDirection()) }}
                            </th>
                            <th class="px-4 py-2 font-medium text-gray-500 cursor-pointer hover:text-gray-700" (click)="sortEventRundown('driverClass')">
                              Class {{ getSortIcon('driverClass', eventSortColumn(), eventSortDirection()) }}
                            </th>
                            <th class="px-4 py-2 font-medium text-gray-500 cursor-pointer hover:text-gray-700" (click)="sortEventRundown('incidentDescription')">
                              Incident Description {{ getSortIcon('incidentDescription', eventSortColumn(), eventSortDirection()) }}
                            </th>
                            <th class="px-4 py-2 font-medium text-gray-500 cursor-pointer hover:text-gray-700" (click)="sortEventRundown('penaltyName')">
                              Penalty {{ getSortIcon('penaltyName', eventSortColumn(), eventSortDirection()) }}
                            </th>
                            <th class="px-4 py-2 font-medium text-gray-500 cursor-pointer hover:text-gray-700" (click)="sortEventRundown('timePenaltySeconds')">
                              Time Penalty {{ getSortIcon('timePenaltySeconds', eventSortColumn(), eventSortDirection()) }}
                            </th>
                          </tr>
                        </thead>
                       <tbody class="divide-y divide-gray-100">
                         @for (row of filteredAndSortedEventRundown(); track row.reportId) {
                          <tr class="hover:bg-gray-50">
                            <td class="px-4 py-3">{{ row.carNumber ?? '-' }}</td>
                            <td class="px-4 py-3 font-medium text-gray-900">{{ row.driverName ?? '-' }}</td>
                            <td class="px-4 py-3 text-gray-600">{{ row.driverClass ?? '-' }}</td>
                            <td class="px-4 py-3 text-gray-700 max-w-md truncate">{{ row.incidentDescription }}</td>
                            <td class="px-4 py-3">
                              @if (row.penaltyName) {
                                <span class="text-gray-700">{{ row.penaltyName }}</span>
                              } @else {
                                <span class="text-gray-400">-</span>
                              }
                            </td>
                            <td class="px-4 py-3">
                              @if (row.timePenaltySeconds > 0) {
                                <app-badge [variant]="row.isSelfReport ? 'success' : 'default'">
                                  {{ row.timePenaltySeconds }}s
                                  @if (row.isSelfReport) {
                                    (SR)
                                  }
                                </app-badge>
                              } @else {
                                <span class="text-gray-400">-</span>
                              }
                            </td>
                          </tr>
                        }
                       </tbody>
                     </table>
                   </div>
                   } @else {
                     <p class="text-gray-500 text-center py-4">No results match your filter</p>
                   }
                 } @else if (selectedEventId) {
                  <p class="text-gray-500 text-center py-4">No finalized reports for this event</p>
                } @else {
                  <p class="text-gray-500 text-center py-4">Select an event to view reports</p>
                }
              </div>
            </app-card>
          </div>
        }

        @if (activeTab() === 'series_overview' && canViewSeriesStats()) {
          <div class="space-y-6">
            <app-card title="Series Overview - License Points">
                <div class="space-y-4">
                  <div>
                    <label class="label">Select Series</label>
                    <app-select
                      [options]="seriesOptions()"
                      [(ngModel)]="selectedSeriesId"
                      (ngModelChange)="loadSeriesPoints()"
                      placeholder="Choose a series"
                    />
                   </div>

                   @if (seriesPoints().length > 0) {
                     <div class="flex items-center justify-between mb-4 gap-4">
                       <div class="flex-1 max-w-md">
                         <input
                           type="text"
                           class="input w-full"
                           placeholder="Filter by any field..."
                           [(ngModel)]="seriesFilterText"
                         />
                       </div>
                       <app-button
                         variant="secondary"
                         size="sm"
                         (onClick)="exportSeriesPointsAsImage()"
                       >
                         <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                           <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                         </svg>
                         Export as Image
                       </app-button>
                      </div>
                      @if (filteredAndSortedSeriesPoints().length > 0) {
                       <div #seriesPointsTable class="overflow-x-auto">
                        <table class="w-full text-sm">
                          <thead class="bg-gray-50">
                            <tr class="text-left">
                              <th class="px-4 py-2 font-medium text-gray-500 cursor-pointer hover:text-gray-700" (click)="sortSeriesPoints('driverNumber')">
                                Car # {{ getSortIcon('driverNumber', seriesSortColumn(), seriesSortDirection()) }}
                              </th>
                              <th class="px-4 py-2 font-medium text-gray-500 cursor-pointer hover:text-gray-700" (click)="sortSeriesPoints('driverName')">
                                Driver {{ getSortIcon('driverName', seriesSortColumn(), seriesSortDirection()) }}
                              </th>
                              <th class="px-4 py-2 font-medium text-gray-500 cursor-pointer hover:text-gray-700" (click)="sortSeriesPoints('driverClass')">
                                Class {{ getSortIcon('driverClass', seriesSortColumn(), seriesSortDirection()) }}
                              </th>
                              <th class="px-4 py-2 font-medium text-gray-500 cursor-pointer hover:text-gray-700" (click)="sortSeriesPoints('totalLicensePoints')">
                                Total Points {{ getSortIcon('totalLicensePoints', seriesSortColumn(), seriesSortDirection()) }}
                              </th>
                              <th class="px-4 py-2 font-medium text-gray-500">Pending Penalties</th>
                            </tr>
                          </thead>
                         <tbody class="divide-y divide-gray-100">
                           @for (row of filteredAndSortedSeriesPoints(); track row.driverId) {
                            <tr class="hover:bg-gray-50">
                              <td class="px-4 py-3">{{ row.driverNumber }}</td>
                              <td class="px-4 py-3 font-medium text-gray-900">{{ row.driverName }}</td>
                              <td class="px-4 py-3 text-gray-600">{{ row.driverClass }}</td>
                              <td class="px-4 py-3">
                                @if (row.totalLicensePoints > 0) {
                                  <app-badge variant="danger">
                                    {{ row.totalLicensePoints }}
                                  </app-badge>
                                } @else {
                                  <span class="text-gray-400">0</span>
                                }
                              </td>
                              <td class="px-4 py-3">
                                @if (row.eligibleSeriesPenalties.length > 0) {
                                  <div class="flex flex-wrap gap-1">
                                    @for (ep of row.eligibleSeriesPenalties; track ep.seriesPenaltyId) {
                                      <app-badge variant="warning" size="sm">
                                        {{ ep.penaltyName }} ({{ ep.threshold }}pts)
                                      </app-badge>
                                    }
                                  </div>
                                } @else {
                                  <span class="text-gray-400">-</span>
                                }
                              </td>
                            </tr>
                          }
                       </tbody>
                     </table>
                     </div>
                     } @else {
                       <p class="text-gray-500 text-center py-4">No results match your filter</p>
                     }
                   } @else if (selectedSeriesId) {
                    <p class="text-gray-500 text-center py-4">No drivers found for this series</p>
                  } @else {
                    <p class="text-gray-500 text-center py-4">Select a series to view license points</p>
                  }
                </div>
              </app-card>
            </div>
          }
        }
    </div>
  `
})
export class StatisticsDashboardComponent implements OnInit, OnDestroy {
  private convex = inject(ConvexService);
  authService = inject(AuthService);

  events = signal<any[]>([]);
  series = signal<any[]>([]);
  eventRundown = signal<EventRundownRow[]>([]);
  seriesPoints = signal<DriverPointsRow[]>([]);
  loading = signal(true);
  activeTab = signal<'event_rundown' | 'series_overview'>('event_rundown');

  selectedEventId = '';
  selectedSeriesId = '';

  eventFilterText = signal('');
  eventSortColumn = signal<keyof EventRundownRow | ''>('');
  eventSortDirection = signal<'asc' | 'desc'>('asc');

  seriesFilterText = signal('');
  seriesSortColumn = signal<keyof DriverPointsRow | ''>('');
  seriesSortDirection = signal<'asc' | 'desc'>('asc');

  eventOptions = computed(() => {
    return [
      { value: '', label: 'Choose an event' },
      ...this.events().map((e: any) => ({
        value: e._id,
        label: `${e.trackName} (${e.series.name})`
      }))
    ];
  });

  seriesOptions = computed(() => {
    return [
      { value: '', label: 'Choose a series' },
      ...this.series().map((s: any) => ({
        value: s._id,
        label: s.name
      }))
    ];
  });

  filteredAndSortedEventRundown = computed(() => {
    let data = this.eventRundown();

    if (this.eventFilterText()) {
      const filter = this.eventFilterText().toLowerCase();
      data = data.filter(row => {
        const carNumber = row.carNumber?.toString() ?? '';
        const driverName = row.driverName?.toLowerCase() ?? '';
        const driverClass = row.driverClass?.toLowerCase() ?? '';
        const incident = row.incidentDescription?.toLowerCase() ?? '';
        const penalty = row.penaltyName?.toLowerCase() ?? '';
        const timePenalty = row.timePenaltySeconds?.toString() ?? '';

        return (
          carNumber.includes(filter) ||
          driverName.includes(filter) ||
          driverClass.includes(filter) ||
          incident.includes(filter) ||
          penalty.includes(filter) ||
          timePenalty.includes(filter)
        );
      });
    }

    if (this.eventSortColumn()) {
      data = [...data].sort((a, b) => {
        const aVal = a[this.eventSortColumn() as keyof EventRundownRow] ?? '';
        const bVal = b[this.eventSortColumn() as keyof EventRundownRow] ?? '';

        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return this.eventSortDirection() === 'asc'
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        }

        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return this.eventSortDirection() === 'asc'
            ? aVal - bVal
            : bVal - aVal;
        }

        return 0;
      });
    }

    return data;
  });

  filteredAndSortedSeriesPoints = computed(() => {
    let data = this.seriesPoints();

    if (this.seriesFilterText()) {
      const filter = this.seriesFilterText().toLowerCase();
      data = data.filter(row => {
        const driverNumber = row.driverNumber?.toString() ?? '';
        const driverName = row.driverName?.toLowerCase() ?? '';
        const driverClass = row.driverClass?.toLowerCase() ?? '';
        const totalPoints = row.totalLicensePoints?.toString() ?? '';

        return (
          driverNumber.includes(filter) ||
          driverName.includes(filter) ||
          driverClass.includes(filter) ||
          totalPoints.includes(filter)
        );
      });
    }

    if (this.seriesSortColumn()) {
      data = [...data].sort((a, b) => {
        const aVal = a[this.seriesSortColumn() as keyof DriverPointsRow] ?? '';
        const bVal = b[this.seriesSortColumn() as keyof DriverPointsRow] ?? '';

        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return this.seriesSortDirection() === 'asc'
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        }

        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return this.seriesSortDirection() === 'asc'
            ? aVal - bVal
            : bVal - aVal;
        }

        return 0;
      });
    }

    return data;
  });

  canViewSeriesStats = computed(() => {
    return this.authService.hasMinimumRole('head_steward');
  });

  visibleTabs = computed((): Tab[] => {
    const tabs: Tab[] = [
      { id: 'event_rundown', label: 'Event Rundown' }
    ];

    if (this.canViewSeriesStats()) {
      tabs.push({ id: 'series_overview', label: 'Series Overview' });
    }

    return tabs;
  });

  selectTab(tabId: string): void {
    if (tabId === 'event_rundown' || tabId === 'series_overview') {
      this.activeTab.set(tabId as 'event_rundown' | 'series_overview');
    }
  }

  sortEventRundown(column: keyof EventRundownRow): void {
    if (this.eventSortColumn() === column) {
      this.eventSortDirection.set(this.eventSortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      this.eventSortColumn.set(column);
      this.eventSortDirection.set('asc');
    }
  }

  sortSeriesPoints(column: keyof DriverPointsRow): void {
    if (this.seriesSortColumn() === column) {
      this.seriesSortDirection.set(this.seriesSortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      this.seriesSortColumn.set(column);
      this.seriesSortDirection.set('asc');
    }
  }

  getSortIcon(column: string, activeColumn: string, direction: string): string {
    if (column !== activeColumn) return '→';
    return direction === 'asc' ? '↑' : '↓';
  }

  @ViewChild('eventRundownTable') eventRundownTable!: ElementRef;
  @ViewChild('seriesPointsTable') seriesPointsTable!: ElementRef;

  private unsubscribes: (() => void)[] = [];

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    this.unsubscribes.forEach(unsub => unsub());
  }

  private loadData(): void {
    this.loading.set(true);

    const eventsQuery = this.convex.createReactiveQuery(
      this.convex.api.events.list,
      {}
    );
    this.unsubscribes.push(eventsQuery.unsubscribe);

    const checkEvents = setInterval(() => {
      const data = eventsQuery.data();
      if (data) {
        this.events.set(data);
      }
    }, 100);
    this.unsubscribes.push(() => clearInterval(checkEvents));

    const seriesQuery = this.convex.createReactiveQuery(
      this.convex.api.series.list,
      {}
    );
    this.unsubscribes.push(seriesQuery.unsubscribe);

    const checkSeries = setInterval(() => {
      const data = seriesQuery.data();
      if (data) {
        this.series.set(data);
        this.loading.set(false);
      }
    }, 100);
    this.unsubscribes.push(() => clearInterval(checkSeries));
  }

  async loadEventRundown(): Promise<void> {
    if (!this.selectedEventId) {
      this.eventRundown.set([]);
      return;
    }

    try {
      const data = await this.convex.query(
        this.convex.api.statistics.getEventRundown,
        { eventId: this.selectedEventId as any }
      );
      this.eventRundown.set(data || []);
    } catch (error: any) {
      console.error('Failed to load event rundown:', error);
      this.eventRundown.set([]);
    }
  }

  async loadSeriesPoints(): Promise<void> {
    if (!this.selectedSeriesId) {
      this.seriesPoints.set([]);
      return;
    }

    try {
      const data = await this.convex.query(
        this.convex.api.statistics.getSeriesLicensePointsWithPenalties,
        { seriesId: this.selectedSeriesId as any }
      );
      this.seriesPoints.set(data || []);
    } catch (error: any) {
      console.error('Failed to load series points:', error);
      this.seriesPoints.set([]);
    }
  }

  async exportEventRundownAsImage(): Promise<void> {
    if (!this.eventRundownTable) return;

    try {
      const canvas = await html2canvas(this.eventRundownTable.nativeElement, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false
      });

      const link = document.createElement('a');
      link.download = `event-rundown-${new Date().toISOString().split('T')[0]}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Failed to export event rundown as image:', error);
    }
  }

  async exportSeriesPointsAsImage(): Promise<void> {
    if (!this.seriesPointsTable) return;

    try {
      const canvas = await html2canvas(this.seriesPointsTable.nativeElement, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false
      });

      const link = document.createElement('a');
      link.download = `series-points-${new Date().toISOString().split('T')[0]}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Failed to export series points as image:', error);
    }
  }
}
