import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ConvexService } from '@core/services/convex.service';
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
          <h1 class="text-2xl font-bold text-gray-900">Drivers</h1>
          <p class="text-gray-500 mt-1">View all registered drivers</p>
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
          <div class="w-40">
            <select class="input" [(ngModel)]="selectedClass" (ngModelChange)="filterDrivers()">
              <option value="">All classes</option>
              @for (cls of driverClasses(); track cls) {
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
                  <div class="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center">
                    <span class="text-xl font-bold text-primary-700">{{ driver.driverNumber }}</span>
                  </div>
                  <div class="flex-1">
                    <h3 class="font-semibold text-gray-900">{{ driver.driverName }}</h3>
                    <div class="flex items-center gap-2 mt-1">
                      <app-badge variant="default">{{ driver.driverClass }}</app-badge>
                      @if (driver.externalId) {
                        <span class="text-xs text-gray-500">{{ driver.externalId }}</span>
                      }
                    </div>
                  </div>
                  <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            <svg class="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"></path>
            </svg>
            <p class="text-gray-500">No drivers found</p>
          </div>
        </app-card>
      }
    </div>
  `
})
export class DriverListComponent implements OnInit, OnDestroy {
  private convex = inject(ConvexService);

  drivers = signal<any[]>([]);
  filteredDrivers = signal<any[]>([]);
  driverClasses = signal<string[]>([]);
  loading = signal(true);

  searchTerm = '';
  selectedClass = '';

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

    const checkDrivers = setInterval(() => {
      const data = driversQuery.data();
      if (data !== undefined) {
        this.drivers.set(data);

        // Extract unique classes
        const classes = [...new Set(data.map((d: any) => d.driverClass))];
        this.driverClasses.set(classes);

        this.filterDrivers();
        this.loading.set(false);
      }
    }, 100);
    this.unsubscribes.push(() => clearInterval(checkDrivers));
  }

  filterDrivers(): void {
    let filtered = [...this.drivers()];

    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(d =>
        d.driverName.toLowerCase().includes(term) ||
        d.driverNumber.toString().includes(term)
      );
    }

    if (this.selectedClass) {
      filtered = filtered.filter(d => d.driverClass === this.selectedClass);
    }

    // Sort by driver number
    filtered.sort((a, b) => a.driverNumber - b.driverNumber);

    this.filteredDrivers.set(filtered);
  }
}
