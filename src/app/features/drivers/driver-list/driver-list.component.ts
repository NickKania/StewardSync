import { Component, inject, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ConvexService } from '@core/services/convex.service';
import { AuthService } from '@core/services/auth.service';
import { Series } from '@core/models/series.model';
import { CardComponent } from '@shared/components/card/card.component';
import { ButtonComponent } from '@shared/components/button/button.component';
import { BadgeComponent } from '@shared/components/badge/badge.component';
import { InputComponent } from '@shared/components/input/input.component';
import { LoadingComponent } from '@shared/components/loading/loading.component';

@Component({
  selector: 'app-driver-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    CardComponent,
    ButtonComponent,
    BadgeComponent,
    InputComponent,
    LoadingComponent
  ],
  template: `
    <div class="space-y-6">
       <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Drivers</h1>
          <p class="text-gray-500 mt-1 dark:text-gray-400">View all registered drivers</p>
        </div>
      </div>

      <!-- Search -->
      <app-card>
        <div class="flex flex-wrap gap-4">
          <div class="flex-1 min-w-[200px] max-w-md">
            <input
              type="text"
              class="input"
              placeholder="Search drivers..."
              [(ngModel)]="searchTerm"
              (ngModelChange)="filterDrivers()"
            />
          </div>
          <div class="w-48">
            <select class="input" [(ngModel)]="selectedSeries" (ngModelChange)="onSeriesChange()">
              <option value="">All series</option>
              @for (s of series(); track s._id) {
                <option [value]="s._id">{{ s.name }}</option>
              }
            </select>
          </div>
          <div class="w-40">
            <select class="input" [(ngModel)]="selectedClass" (ngModelChange)="filterDrivers()">
              <option value="">All classes</option>
              @for (cls of filteredDriverClasses(); track cls) {
                <option [value]="cls">{{ cls }}</option>
              }
            </select>
          </div>
        </div>
      </app-card>

      <!-- Drivers grid -->
      @if (loading()) {
        <app-loading text="Loading drivers..." />
      } @else if (filteredDrivers().length > 0) {
        <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
           @for (driver of filteredDrivers(); track driver._id) {
            <a [routerLink]="['/drivers', driver._id]">
              <app-card [hover]="true">
                <div class="flex items-center gap-4">
                  <div class="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center dark:bg-primary-900/40">
                    <span class="text-xl font-bold text-primary-700 dark:text-primary-200">{{ driver.driverNumber }}</span>
                  </div>
                  <div class="flex-1">
                    <h3 class="font-semibold text-gray-900 dark:text-gray-100">{{ driver.driverName }}</h3>
                    <div class="flex items-center gap-2 mt-1">
                      <app-badge variant="default">{{ driver.driverClass }}</app-badge>
                      @if (driver.externalId) {
                        <span class="text-xs text-gray-500 dark:text-gray-400">{{ driver.externalId }}</span>
                      }
                    </div>
                  </div>
                  <svg class="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                  </svg>
                </div>
              </app-card>
            </a>
          }
        </div>
       } @else {
        <app-card>
          <div class="text-center py-12">
            <svg class="w-12 h-12 text-gray-300 mx-auto mb-4 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"></path>
            </svg>
            <p class="text-gray-500 dark:text-gray-400">No drivers found</p>
          </div>
        </app-card>
      }
    </div>
  `
})
export class DriverListComponent implements OnInit, OnDestroy {
  private convex = inject(ConvexService);
  private authService = inject(AuthService);

  drivers = signal<any[]>([]);
  filteredDrivers = signal<any[]>([]);
  driverClasses = signal<string[]>([]);
  series = signal<Series[]>([]);
  loading = signal(true);

  searchTerm = signal('');
  selectedClass = signal('');
  selectedSeries = signal('');

  filteredDriverClasses = computed(() => {
    const seriesId = this.selectedSeries();
    if (!seriesId) {
      return this.driverClasses();
    }

    const driversInSeries = this.drivers().filter(d => d.championshipId === seriesId);
    const classes = [...new Set(driversInSeries.map(d => d.driverClass))];
    return classes.sort();
  });

  private unsubscribes: (() => void)[] = [];

  ngOnInit(): void {
    this.loadDrivers();
  }

  ngOnDestroy(): void {
    this.unsubscribes.forEach(unsub => unsub());
  }

  private loadDrivers(): void {
    const driversQuery = this.convex.createReactiveQuery(
      this.convex.api.drivers.list,
      {}
    );
    this.unsubscribes.push(driversQuery.unsubscribe);

    const seriesQuery = this.convex.createReactiveQuery(
      this.convex.api.series.listActive,
      {}
    );
    this.unsubscribes.push(seriesQuery.unsubscribe);

    const checkData = setInterval(() => {
      const driversData = driversQuery.data();
      const seriesData = seriesQuery.data();

      if (driversData !== undefined && seriesData !== undefined) {
        this.drivers.set(driversData);
        this.series.set(seriesData);

        // Extract unique classes
        const classes = [...new Set(driversData.map((d: any) => d.driverClass))] as string[];
        this.driverClasses.set(classes);

        this.filterDrivers();
        this.loading.set(false);
      }
    }, 100);
    this.unsubscribes.push(() => clearInterval(checkData));
  }

  filterDrivers(): void {
    let filtered = [...this.drivers()];

    const term = this.searchTerm();
    if (term) {
      const lowerTerm = term.toLowerCase();
      filtered = filtered.filter(d =>
        d.driverName.toLowerCase().includes(lowerTerm) ||
        d.driverNumber.toString().includes(lowerTerm)
      );
    }

    // Filter out drivers from inactive series
    const activeSeriesIds = this.series().map(s => s._id);
    filtered = filtered.filter(d => !d.championshipId || activeSeriesIds.includes(d.championshipId));

    const seriesId = this.selectedSeries();
    if (seriesId) {
      filtered = filtered.filter(d => d.championshipId === seriesId);
    }

    const cls = this.selectedClass();
    if (cls) {
      filtered = filtered.filter(d => d.driverClass === cls);
    }

    // Sort by driver number
    filtered.sort((a, b) => a.driverNumber - b.driverNumber);

    this.filteredDrivers.set(filtered);
  }

  onSeriesChange(): void {
    this.selectedClass.set('');
    this.filterDrivers();
  }
}
