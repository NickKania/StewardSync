import { Component, inject, OnInit, OnDestroy, signal, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ConvexService } from '@core/services/convex.service';
import { CardComponent } from '@shared/components/card/card.component';
import { ButtonComponent } from '@shared/components/button/button.component';
import { BadgeComponent } from '@shared/components/badge/badge.component';
import { LoadingComponent } from '@shared/components/loading/loading.component';

@Component({
  selector: 'app-driver-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    CardComponent,
    ButtonComponent,
    BadgeComponent,
    LoadingComponent
  ],
  template: `
    <div class="space-y-6">
      @if (loading()) {
        <app-loading text="Loading driver..." />
      } @else if (driver()) {
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div class="flex items-center gap-4">
            <div class="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center">
              <span class="text-3xl font-bold text-primary-700">{{ driver()?.driverNumber }}</span>
            </div>
            <div>
              <h1 class="text-2xl font-bold text-gray-900">{{ driver()?.driverName }}</h1>
              <div class="flex items-center gap-2 mt-1">
                <app-badge variant="primary">{{ driver()?.driverClass }}</app-badge>
                @if (driver()?.externalId) {
                  <span class="text-sm text-gray-500">ID: {{ driver()?.externalId }}</span>
                }
              </div>
            </div>
          </div>
          <a routerLink="/drivers">
            <app-button variant="secondary">
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
              </svg>
              Back to Drivers
            </app-button>
          </a>
        </div>

        <!-- Stats -->
        @if (stats()) {
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <app-card>
              <div class="text-center">
                <p class="text-3xl font-bold text-gray-900">{{ stats()?.reportsFiledCount || 0 }}</p>
                <p class="text-sm text-gray-500 mt-1">Reports Filed</p>
              </div>
            </app-card>
            <app-card>
              <div class="text-center">
                <p class="text-3xl font-bold text-amber-600">{{ stats()?.reportsAgainstCount || 0 }}</p>
                <p class="text-sm text-gray-500 mt-1">Reports Against</p>
              </div>
            </app-card>
            <app-card>
              <div class="text-center">
                <p class="text-3xl font-bold text-blue-600">{{ stats()?.pendingReports || 0 }}</p>
                <p class="text-sm text-gray-500 mt-1">Pending</p>
              </div>
            </app-card>
            <app-card>
              <div class="text-center">
                <p class="text-3xl font-bold text-green-600">{{ stats()?.finalizedReports || 0 }}</p>
                <p class="text-sm text-gray-500 mt-1">Finalized</p>
              </div>
            </app-card>
          </div>
        }

        <!-- Driver info -->
        <app-card title="Driver Information">
          <dl class="grid sm:grid-cols-2 gap-4">
            <div>
              <dt class="text-sm text-gray-500">Driver Number</dt>
              <dd class="font-medium text-gray-900">#{{ driver()?.driverNumber }}</dd>
            </div>
            <div>
              <dt class="text-sm text-gray-500">Full Name</dt>
              <dd class="font-medium text-gray-900">{{ driver()?.driverName }}</dd>
            </div>
            <div>
              <dt class="text-sm text-gray-500">Class</dt>
              <dd class="font-medium text-gray-900">{{ driver()?.driverClass }}</dd>
            </div>
            @if (driver()?.externalId) {
              <div>
                <dt class="text-sm text-gray-500">External ID</dt>
                <dd class="font-medium text-gray-900">{{ driver()?.externalId }}</dd>
              </div>
            }
          </dl>
        </app-card>
      } @else {
        <app-card>
          <div class="text-center py-12">
            <p class="text-gray-500">Driver not found</p>
            <a routerLink="/drivers" class="mt-4 inline-block">
              <app-button variant="primary">Back to Drivers</app-button>
            </a>
          </div>
        </app-card>
      }
    </div>
  `
})
export class DriverDetailComponent implements OnInit, OnDestroy {
  @Input() id!: string;

  private convex = inject(ConvexService);

  driver = signal<any>(null);
  stats = signal<any>(null);
  loading = signal(true);

  private unsubscribes: (() => void)[] = [];

  ngOnInit(): void {
    this.loadDriver();
  }

  ngOnDestroy(): void {
    this.unsubscribes.forEach(unsub => unsub());
  }

  private async loadDriver(): Promise<void> {
    if (!this.id) {
      this.loading.set(false);
      return;
    }

    try {
      const driver = await this.convex.query(
        this.convex.api.drivers.getById,
        { driverId: this.id as any }
      );

      this.driver.set(driver);

      if (driver) {
        const stats = await this.convex.query(
          this.convex.api.drivers.getDriverStats,
          { driverId: this.id as any }
        );
        this.stats.set(stats);
      }
    } catch (error) {
      console.error('Failed to load driver:', error);
    } finally {
      this.loading.set(false);
    }
  }
}
