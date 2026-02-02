import { Component, inject, signal, computed, effect, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ConvexService } from '@core/services/convex.service';
import { AuthService } from '@core/services/auth.service';
import { CardComponent } from '@shared/components/card/card.component';
import { LoadingComponent } from '@shared/components/loading/loading.component';
import { ButtonComponent } from '@shared/components/button/button.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { SearchSelectComponent } from '@shared/components/search-select/search-select.component';
import { DateFormatPipe, TimeAgoPipe } from '@shared/pipes/date-format.pipe';

interface FilterState {
  searchQuery: string;
  seriesId: string;
  userId: string;
  startDate: string;
  endDate: string;
}

@Component({
  selector: 'app-review-search',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    CardComponent,
    LoadingComponent,
    ButtonComponent,
    PaginationComponent,
    SearchSelectComponent,
    DateFormatPipe,
    TimeAgoPipe,
  ],
  template: `
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Review Search</h1>
          <p class="text-gray-500 mt-1">Search and filter review comments</p>
        </div>
      </div>

      <div class="relative z-20">
        <app-card>
          <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Search Query
            </label>
            <div class="relative">
              <svg
                class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                ></path>
              </svg>
              <input
                type="text"
                [(ngModel)]="filters().searchQuery"
                (ngModelChange)="onSearchChange()"
                placeholder="Search incident description or review notes..."
                class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
              />
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Series
              </label>
              @if (!initialDataLoaded()) {
                <div class="px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 text-sm">
                  Loading...
                </div>
              } @else {
                <app-search-select
                  id="series"
                  [options]="seriesOptions()"
                  [(ngModel)]="filters().seriesId"
                  (ngModelChange)="onFilterChange()"
                  placeholder="All Series"
                />
              }
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Reviewer
              </label>
              @if (!initialDataLoaded()) {
                <div class="px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 text-sm">
                  Loading...
                </div>
              } @else {
                <app-search-select
                  id="user"
                  [options]="userOptions()"
                  [(ngModel)]="filters().userId"
                  (ngModelChange)="onFilterChange()"
                  placeholder="All Reviewers"
                />
              }
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                [(ngModel)]="filters().startDate"
                (ngModelChange)="onFilterChange()"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                [(ngModel)]="filters().endDate"
                (ngModelChange)="onFilterChange()"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
              />
            </div>
          </div>

          @if (hasActiveFilters()) {
            <div class="flex justify-end">
              <button
                (click)="clearFilters()"
                class="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                Clear All Filters
              </button>
            </div>
          }
        </div>
      </app-card>
      </div>

      <app-card [noPadding]="true">
        @if (loading()) {
          <div class="py-12">
            <app-loading text="Searching reviews..." />
          </div>
        } @else if (results().length > 0) {
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-gray-50">
                <tr class="text-left text-sm text-gray-500">
                  <th class="px-6 py-3 font-medium">Reviewer</th>
                  <th class="px-6 py-3 font-medium">Series</th>
                  <th class="px-6 py-3 font-medium">Event</th>
                  <th class="px-6 py-3 font-medium">Incident Description</th>
                  <th class="px-6 py-3 font-medium">Review Notes</th>
                  <th class="px-6 py-3 font-medium">Created</th>
                  <th class="px-6 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                @for (result of results(); track result._id) {
                  <tr class="hover:bg-gray-50">
                    <td class="px-6 py-4">
                      <p class="font-medium text-gray-900">{{ result.reviewer?.name || 'Unknown' }}</p>
                    </td>
                    <td class="px-6 py-4">
                      <p class="text-gray-900">{{ result.series?.name || 'N/A' }}</p>
                    </td>
                    <td class="px-6 py-4">
                      <p class="text-gray-900">{{ result.event?.trackName }}</p>
                      <p class="text-sm text-gray-500">Race {{ result.race?.raceNumber }}</p>
                    </td>
                    <td class="px-6 py-4">
                      <p class="text-gray-900 max-w-xs truncate">
                        {{ result.incidentDescription }}
                      </p>
                    </td>
                    <td class="px-6 py-4">
                      <p class="text-gray-900 max-w-xs truncate">
                        {{ result.reviewNotes }}
                      </p>
                    </td>
                    <td class="px-6 py-4 text-gray-500 text-sm">
                      {{ result.createdAt | date: 'short' }}
                    </td>
                    <td class="px-6 py-4">
                      <a
                        [routerLink]="['/reviews', result.reportId]"
                        class="text-primary-600 hover:text-primary-700 font-medium text-sm"
                      >
                        View Report
                      </a>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <app-pagination
            [currentPage]="currentPage()"
            [totalPages]="totalPages()"
            [totalResults]="totalResults()"
            [limit]="PAGE_SIZE"
            (pageChange)="onPageChange($event)"
          />
        } @else {
          <div class="text-center py-12">
            <svg
              class="w-12 h-12 text-gray-300 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              ></path>
            </svg>
            <p class="text-gray-500">No reviews found</p>
            <p class="text-sm text-gray-400 mt-1">Try adjusting your search or filters</p>
          </div>
        }
      </app-card>
    </div>
  `,
})
export class ReviewSearchComponent {
  private convex = inject(ConvexService);
  private authService = inject(AuthService);

  readonly PAGE_SIZE = 20;

  filters = signal<FilterState>({
    searchQuery: '',
    seriesId: '',
    userId: '',
    startDate: '',
    endDate: '',
  });

  loading = signal(true);
  results = signal<any[]>([]);
  totalResults = signal(0);
  currentPage = signal(1);
  lastFilters = signal<string>('');

  seriesList = signal<any[]>([]);
  usersList = signal<any[]>([]);
  initialDataLoaded = signal(false);

  totalPages = computed(() => Math.ceil(this.totalResults() / this.PAGE_SIZE));

  seriesOptions = computed(() => [
    { label: 'All Series', value: '' },
    ...this.seriesList().map((s) => ({ label: s.name, value: s._id })),
  ]);

  userOptions = computed(() => [
    { label: 'All Reviewers', value: '' },
    ...this.usersList().map((u) => ({ label: u.name, value: u._id })),
  ]);

  hasActiveFilters = computed(() => {
    const f = this.filters();
    return (
      f.searchQuery ||
      f.seriesId ||
      f.userId ||
      f.startDate ||
      f.endDate
    );
  });

  private searchTimeout: any = null;

  constructor() {
    this.loadInitialData();
    effect(() => {
      this.filters();
      this.currentPage();
      this.performSearch();
    });
  }

  async loadInitialData(): Promise<void> {
    try {
      const [seriesData, usersData] = await Promise.all([
        this.convex.query((this.convex.api as any).series.list, {}),
        this.convex.query((this.convex.api as any).users.listStewards, {}),
      ]);

      this.seriesList.set(seriesData);
      this.usersList.set(usersData);
      this.initialDataLoaded.set(true);
      this.performSearch();
    } catch (error) {
      console.error('Error loading initial data:', error);
    }
  }

  onSearchChange(): void {
    this.currentPage.set(1);
    this.performSearch();
  }

  onFilterChange(): void {
    this.currentPage.set(1);
    this.performSearch();
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
    this.performSearch();
  }

  clearFilters(): void {
    this.filters.set({
      searchQuery: '',
      seriesId: '',
      userId: '',
      startDate: '',
      endDate: '',
    });
    this.currentPage.set(1);
  }

  performSearch(): void {
    console.log('performSearch called');
    console.log('Current filters:', this.filters());
    console.log('Current page:', this.currentPage());

    const currentFilterKey = JSON.stringify(this.filters()) + this.currentPage();
    console.log('Filter key:', currentFilterKey);
    console.log('Last filter key:', this.lastFilters());

    if (currentFilterKey === this.lastFilters()) {
      console.log('Skipping duplicate search');
      return;
    }

    untracked(() => {
      this.lastFilters.set(currentFilterKey);
    });

    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    this.searchTimeout = setTimeout(async () => {
      console.log('Executing search after timeout');
      await this.doSearch();
    }, 300);
  }

  async doSearch(): Promise<void> {
    this.loading.set(true);

    try {
      const f = this.filters();
      const searchParams: any = {
        limit: this.PAGE_SIZE,
        offset: (this.currentPage() - 1) * this.PAGE_SIZE,
      };

      const countParams: any = {};

      if (f.searchQuery) {
        searchParams.searchQuery = f.searchQuery;
        countParams.searchQuery = f.searchQuery;
      }
      if (f.seriesId) {
        searchParams.seriesId = f.seriesId;
        countParams.seriesId = f.seriesId;
      }
      if (f.userId) {
        searchParams.userId = f.userId;
        countParams.userId = f.userId;
      }
      if (f.startDate) {
        const startDate = new Date(f.startDate).getTime();
        searchParams.startDate = startDate;
        countParams.startDate = startDate;
      }
      if (f.endDate) {
        const endDate = new Date(f.endDate).setHours(23, 59, 59, 999);
        searchParams.endDate = endDate;
        countParams.endDate = endDate;
      }

      console.log('Sending search params:', searchParams);
      console.log('Sending count params:', countParams);

      const [searchResults, count] = await Promise.all([
        this.convex.query((this.convex.api as any).reviews.search, searchParams),
        this.convex.query((this.convex.api as any).reviews.searchCount, countParams),
      ]);

      console.log('Got search results:', searchResults.length);
      console.log('Got count:', count);

      this.results.set(searchResults);
      this.totalResults.set(count);
    } catch (error) {
      console.error('Error searching reviews:', error);
      this.results.set([]);
      this.totalResults.set(0);
    } finally {
      this.loading.set(false);
    }
  }
}
