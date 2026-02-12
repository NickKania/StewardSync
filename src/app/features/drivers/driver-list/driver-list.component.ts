import {
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { ConvexService } from "@core/services/convex.service";
import { Series } from "@core/models/series.model";
import { CardComponent } from "@shared/components/card/card.component";
import { BadgeComponent } from "@shared/components/badge/badge.component";
import { LoadingComponent } from "@shared/components/loading/loading.component";
import { TruncateTextComponent } from "@shared/components/truncate-text/truncate-text.component";

@Component({
  selector: "app-driver-list",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    CardComponent,
    BadgeComponent,
    LoadingComponent,
    TruncateTextComponent,
  ],
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Drivers
        </h1>
        <p class="text-gray-500 mt-1 dark:text-gray-400">
          Select a series to manage series drivers, or view grouped user
          profiles.
        </p>
      </div>

      <app-card>
        <div class="grid md:grid-cols-4 gap-4">
          <div class="md:col-span-2">
            <input
              type="text"
              class="input"
              placeholder="Search by name, number, username..."
              [ngModel]="searchTerm()"
              (ngModelChange)="onSearchChange($event)"
            />
          </div>

          <div>
            <select
              class="input"
              [ngModel]="selectedSeriesId()"
              (ngModelChange)="onSeriesChange($event)"
            >
              <option value="">All Series (Grouped by User)</option>
              @for (s of series(); track s._id) {
                <option [value]="s._id">{{ s.name }}</option>
              }
            </select>
          </div>

          @if (selectedSeriesId()) {
            <div>
              <select
                class="input"
                [ngModel]="selectedClassName()"
                (ngModelChange)="onClassChange($event)"
              >
                <option value="">All Classes</option>
                @for (className of availableSeriesClasses(); track className) {
                  <option [value]="className">{{ className }}</option>
                }
              </select>
            </div>
          }
        </div>

        @if (selectedSeriesId()) {
          <label
            class="mt-3 inline-flex items-center gap-2 cursor-pointer text-sm text-gray-600 dark:text-gray-300"
          >
            <input
              type="checkbox"
              [ngModel]="showInactive()"
              (ngModelChange)="showInactive.set($event); filterSeriesDrivers()"
            />
            Show Withdrawn
          </label>
        }
      </app-card>

      @if (loading()) {
        <app-loading text="Loading drivers..." />
      } @else if (!selectedSeriesId()) {
        @if (filteredUserGroups().length === 0) {
          <app-card>
            <p class="text-center py-10 text-gray-500 dark:text-gray-400">
              No linked users found.
            </p>
          </app-card>
        } @else {
          <div class="space-y-4">
            @for (group of filteredUserGroups(); track group.userId) {
              <a [routerLink]="['/drivers/user', group.userId]" class="block">
                <app-card [hover]="true">
                  <div class="flex items-start justify-between gap-3">
                    <div>
                      <h3
                        class="text-lg font-semibold text-gray-900 dark:text-gray-100"
                      >
                        {{ group.officialName || group.userName }}
                      </h3>
                      @if (
                        group.userName &&
                        group.discordUsername &&
                        group.userName !== group.discordUsername
                      ) {
                        <p class="text-sm text-gray-500 dark:text-gray-400">
                          {{ group.userName }}
                        </p>
                      }
                    </div>
                    <app-badge variant="info"
                      >{{ group.drivers.length }} series profile(s)</app-badge
                    >
                  </div>

                  <div class="grid md:grid-cols-2 gap-2 mt-4">
                    @for (driver of group.drivers; track driver._id) {
                      <div
                        class="rounded-lg border border-gray-200 dark:border-gray-700 p-3"
                      >
                        <p class="font-medium text-gray-900 dark:text-gray-100">
                          #{{ driver.driverNumber }} -
                          {{ driver.seriesName || "No Series" }}
                        </p>
                        <p class="text-sm text-gray-500 dark:text-gray-400">
                          {{ driver.driverClassName || "No class" }}
                          @if (!driver.isActive) {
                            <span> - Withdrawn</span>
                          }
                        </p>
                      </div>
                    }
                  </div>
                </app-card>
              </a>
            }
          </div>
        }
      } @else {
        @if (filteredSeriesDrivers().length === 0) {
          <app-card>
            <p class="text-center py-10 text-gray-500 dark:text-gray-400">
              No drivers found for this series.
            </p>
          </app-card>
        } @else {
          <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            @for (driver of filteredSeriesDrivers(); track driver._id) {
              <a [routerLink]="['/drivers', driver._id]" class="block">
                <app-card [hover]="true">
                  <div class="flex items-center gap-3">
                    <div
                      class="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center"
                    >
                      <span
                        class="font-bold text-primary-700 dark:text-primary-100"
                        >{{ driver.driverNumber }}</span
                      >
                    </div>
                    <div class="min-w-0">
                      <app-truncate-text
                        [text]="driver.displayName || driver.driverName"
                        class="font-semibold text-gray-900 dark:text-gray-100"
                      />
                      <app-truncate-text
                        [text]="
                          driver.driverClass?.displayName ||
                          driver.driverClass ||
                          'No class'
                        "
                        class="text-sm text-gray-500 dark:text-gray-400"
                      />
                      <app-truncate-text
                        [text]="
                          'LP: ' +
                          (driver.accumulatedLicensePoints || 0) +
                          (driver.linkedUser?.name
                            ? ' - User: ' + driver.linkedUser.name
                            : '')
                        "
                        class="text-xs text-gray-500 dark:text-gray-400"
                      />
                    </div>
                    @if (!driver.isActive) {
                      <app-badge variant="warning" size="sm"
                        >Withdrawn</app-badge
                      >
                    }
                  </div>
                </app-card>
              </a>
            }
          </div>
        }
      }
    </div>
  `,
})
export class DriverListComponent implements OnInit, OnDestroy {
  private readonly convex = inject(ConvexService);

  loading = signal(true);
  series = signal<Series[]>([]);
  userGroups = signal<any[]>([]);
  seriesDrivers = signal<any[]>([]);

  searchTerm = signal("");
  selectedSeriesId = signal("");
  selectedClassName = signal("");
  showInactive = signal(false);

  filteredSeriesDrivers = signal<any[]>([]);

  availableSeriesClasses = computed(() => {
    const classes = new Set<string>();
    for (const driver of this.seriesDrivers()) {
      const name = driver.driverClass?.displayName || driver.driverClass;
      if (name) classes.add(name);
    }
    return [...classes].sort((a, b) => a.localeCompare(b));
  });

  filteredUserGroups = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    if (!term) return this.userGroups();

    return this.userGroups().filter((group) => {
      if (group.userName?.toLowerCase().includes(term)) return true;
      if (group.discordUsername?.toLowerCase().includes(term)) return true;

      return group.drivers.some((driver: any) => {
        const driverClass = (driver.driverClassName || "").toLowerCase();
        const seriesName = (driver.seriesName || "").toLowerCase();
        return (
          String(driver.driverNumber).includes(term) ||
          (driver.driverName || "").toLowerCase().includes(term) ||
          driverClass.includes(term) ||
          seriesName.includes(term)
        );
      });
    });
  });

  ngOnInit(): void {
    void this.loadInitial();
  }

  ngOnDestroy(): void {
    // No active subscriptions; data is loaded on demand.
  }

  private async loadInitial(): Promise<void> {
    this.loading.set(true);
    try {
      const [series, userGroups] = await Promise.all([
        this.convex.query(this.convex.api.series.listActive, {}),
        this.convex.query(this.convex.api.drivers.listAggregatedByUser, {}),
      ]);
      this.series.set(series || []);
      this.userGroups.set(userGroups || []);
    } catch (error) {
      console.error("Failed to load drivers page:", error);
    } finally {
      this.loading.set(false);
    }
  }

  async onSeriesChange(seriesId: string): Promise<void> {
    this.selectedSeriesId.set(seriesId || "");
    this.selectedClassName.set("");

    if (!seriesId) {
      this.seriesDrivers.set([]);
      this.filteredSeriesDrivers.set([]);
      return;
    }

    this.loading.set(true);
    try {
      const drivers = await this.convex.query(
        this.convex.api.drivers.getByChampionship,
        {
          championshipId: seriesId as any,
        },
      );
      this.seriesDrivers.set(drivers || []);
      this.filterSeriesDrivers();
    } catch (error) {
      console.error("Failed to load series drivers:", error);
      this.seriesDrivers.set([]);
      this.filteredSeriesDrivers.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  onSearchChange(value: string): void {
    this.searchTerm.set(value || "");
    if (this.selectedSeriesId()) {
      this.filterSeriesDrivers();
    }
  }

  onClassChange(value: string): void {
    this.selectedClassName.set(value || "");
    this.filterSeriesDrivers();
  }

  filterSeriesDrivers(): void {
    let rows = [...this.seriesDrivers()];
    const term = this.searchTerm().trim().toLowerCase();

    if (!this.showInactive()) {
      rows = rows.filter((driver) => driver.isActive !== false);
    }

    if (this.selectedClassName()) {
      rows = rows.filter((driver) => {
        const className =
          driver.driverClass?.displayName || driver.driverClass || "";
        return className === this.selectedClassName();
      });
    }

    if (term) {
      rows = rows.filter((driver) => {
        const className = (
          driver.driverClass?.displayName ||
          driver.driverClass ||
          ""
        ).toLowerCase();
        const linkedUser = (driver.linkedUser?.name || "").toLowerCase();
        return (
          (driver.driverName || "").toLowerCase().includes(term) ||
          String(driver.driverNumber).includes(term) ||
          className.includes(term) ||
          linkedUser.includes(term)
        );
      });
    }

    rows.sort((a, b) => a.driverNumber - b.driverNumber);
    this.filteredSeriesDrivers.set(rows);
  }
}
