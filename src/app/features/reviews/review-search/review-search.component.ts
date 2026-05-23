import { DestroyRef, Component, inject, signal, computed, effect, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { ConvexService } from '@core/services/convex.service';
import { AuthService } from '@core/services/auth.service';
import { getStringParam, getBooleanParam, syncQueryParams } from '@core/utils/query-params.utils';
import { CardComponent } from '@shared/components/card/card.component';
import { LoadingComponent } from '@shared/components/loading/loading.component';
import { ButtonComponent } from '@shared/components/button/button.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { SearchSelectComponent } from '@shared/components/search-select/search-select.component';
import { TruncateTextComponent } from '@shared/components/truncate-text/truncate-text.component';
import { DateFormatPipe, TimeAgoPipe } from '@shared/pipes/date-format.pipe';

interface FilterState {
  searchQuery: string;
  seriesId: string;
  userId: string;
  candidateForStandardizationOnly: boolean;
  startDate: string;
  endDate: string;
}

const DEFAULT_FILTERS: FilterState = {
  searchQuery: '',
  seriesId: '',
  userId: '',
  candidateForStandardizationOnly: false,
  startDate: '',
  endDate: '',
};

const FILTER_QUERY_PARAM_KEYS = new Set([
  'searchQuery',
  'seriesId',
  'userId',
  'candidateForStandardizationOnly',
  'startDate',
  'endDate',
  'page',
]);

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
    TruncateTextComponent,
    DateFormatPipe,
    TimeAgoPipe,
  ],
  template: `
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Review Search</h1>
          <p class="text-gray-500 mt-1 dark:text-gray-400">Search and filter review comments</p>
        </div>
      </div>

      <div class="relative z-20">
        <app-card [overflowHidden]="false">
          <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
              Search Query
            </label>
            <div class="relative">
              <svg
                class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500"
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

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
                Series
              </label>
              @if (!initialDataLoaded()) {
                <div class="px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
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
              <label class="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
                Reviewer
              </label>
              @if (!initialDataLoaded()) {
                <div class="px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
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
              <label class="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
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
              <label class="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
                End Date
              </label>
              <input
                type="date"
                [(ngModel)]="filters().endDate"
                (ngModelChange)="onFilterChange()"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
              />
            </div>

            <div class="flex items-end xl:col-auto lg:col-span-2">
              <label class="flex flex-wrap items-center gap-2 text-sm text-gray-700 pb-2 dark:text-gray-300">
                <input
                  type="checkbox"
                  [(ngModel)]="filters().candidateForStandardizationOnly"
                  (ngModelChange)="onFilterChange()"
                  class="rounded border-gray-300 dark:border-gray-700"
                />
                Candidate for standardization
              </label>
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
          <div class="overflow-x-auto lg:overflow-x-visible">
            <table class="w-full table-fixed">
              <thead class="bg-gray-50 dark:bg-gray-800">
                <tr class="text-left text-sm text-gray-500 dark:text-gray-400">
                  <th class="w-[11%] px-3 py-3 font-medium">Reviewer</th>
                  <th class="w-[9%] px-3 py-3 font-medium">Series</th>
                  <th class="w-[12%] px-3 py-3 font-medium">Event</th>
                  <th class="w-[20%] px-3 py-3 font-medium">Incident Description</th>
                  <th class="w-[20%] px-3 py-3 font-medium">Review Notes</th>
                  <th class="w-[10%] px-3 py-3 font-medium">Standardization</th>
                  <th class="w-[10%] px-3 py-3 font-medium">Created</th>
                  <th class="w-[8%] px-3 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
                @for (result of results(); track result._id) {
                  <tr class="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td class="px-3 py-4">
                      <app-truncate-text [text]="result.reviewer?.officialName || result.reviewer?.name || 'Unknown'"
                        class="font-medium text-gray-900 dark:text-gray-100" />
                    </td>
                    <td class="px-3 py-4">
                      <app-truncate-text [text]="result.series?.name || 'N/A'"
                        class="text-gray-900 dark:text-gray-100" />
                    </td>
                    <td class="px-3 py-4">
                      <app-truncate-text [text]="result.event?.trackName"
                        class="text-gray-900 dark:text-gray-100" />
                      <p class="text-sm text-gray-500 dark:text-gray-400">{{ getSessionName(result.race) }}</p>
                    </td>
                    <td class="px-3 py-4">
                      <app-truncate-text [text]="result.incidentDescription" maxW="max-w-xs"
                        class="text-gray-900 dark:text-gray-100" />
                    </td>
                    <td class="px-3 py-4">
                      <app-truncate-text [text]="result.reviewNotes" maxW="max-w-xs"
                        class="text-gray-900 dark:text-gray-100" />
                    </td>
                    <td class="px-3 py-4">
                      @if (result.candidateForStandardization) {
                        <span
                          class="inline-block px-2.5 py-0.5 text-sm font-medium rounded-full bg-warning-bg text-warning-text whitespace-nowrap"
                        >
                          Candidate
                        </span>
                      } @else {
                        <span class="text-gray-400 dark:text-gray-500">-</span>
                      }
                    </td>
                    <td class="px-3 py-4 text-gray-500 text-sm dark:text-gray-400">
                      {{ result.createdAt | date: 'short' }}
                    </td>
                    <td class="px-3 py-4 whitespace-nowrap">
                      <a
                        [routerLink]="['/reports', result.reportId]"
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
            <p class="text-gray-500 dark:text-gray-400">No reviews found</p>
            <p class="text-sm text-gray-400 mt-1 dark:text-gray-500">Try adjusting your search or filters</p>
          </div>
        }
      </app-card>
    </div>
  `,
})
export class ReviewSearchComponent {
  private convex = inject(ConvexService);
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  readonly PAGE_SIZE = 20;

  filters = signal<FilterState>({ ...DEFAULT_FILTERS });

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
    ...this.usersList().map((u) => ({ label: u.officialName || u.name, value: u._id })),
  ]);

  hasActiveFilters = computed(() => {
    const f = this.filters();
    return (
      f.searchQuery ||
      f.seriesId ||
      f.userId ||
      f.candidateForStandardizationOnly ||
      f.startDate ||
      f.endDate
    );
  });

  private searchTimeout: any = null;

  constructor() {
    this.route.queryParams
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => this.applyQueryParams(params));

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
    this.filters.set({ ...this.filters() });
    syncQueryParams(this.router, this.route, this.getFilterQueryParams(), FILTER_QUERY_PARAM_KEYS, { replaceUrl: true });
  }

  onFilterChange(): void {
    this.currentPage.set(1);
    this.filters.set({ ...this.filters() });
    syncQueryParams(this.router, this.route, this.getFilterQueryParams(), FILTER_QUERY_PARAM_KEYS, { replaceUrl: true });
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
    syncQueryParams(this.router, this.route, this.getFilterQueryParams(), FILTER_QUERY_PARAM_KEYS, { replaceUrl: true });
  }

  clearFilters(): void {
    this.filters.set({ ...DEFAULT_FILTERS });
    this.currentPage.set(1);
    syncQueryParams(this.router, this.route, this.getFilterQueryParams(), FILTER_QUERY_PARAM_KEYS, { replaceUrl: true });
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
      if (f.candidateForStandardizationOnly) {
        searchParams.candidateForStandardization = true;
        countParams.candidateForStandardization = true;
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

  getSessionName(race: { sessionName?: string; raceNumber?: number } | null | undefined): string {
    if (race?.sessionName?.trim()) return race.sessionName.trim();
    if (typeof race?.raceNumber === "number") return `Race ${race.raceNumber}`;
    return "Session";
  }

  private applyQueryParams(params: Params): void {
    const parsedFilters = this.parseFiltersFromQueryParams(params);
    const parsedPage = this.parsePageFromQueryParams(params);

    if (!this.areFiltersEqual(this.filters(), parsedFilters)) {
      this.filters.set(parsedFilters);
    }

    if (this.currentPage() !== parsedPage) {
      this.currentPage.set(parsedPage);
    }
  }

  private parseFiltersFromQueryParams(params: Params): FilterState {
    return {
      searchQuery: getStringParam(params, 'searchQuery'),
      seriesId: getStringParam(params, 'seriesId'),
      userId: getStringParam(params, 'userId'),
      candidateForStandardizationOnly: getBooleanParam(
        params,
        'candidateForStandardizationOnly',
      ),
      startDate: this.getDateParam(params, 'startDate'),
      endDate: this.getDateParam(params, 'endDate'),
    };
  }

  private parsePageFromQueryParams(params: Params): number {
    const pageValue = getStringParam(params, 'page');
    const parsed = Number.parseInt(pageValue, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }

  private getDateParam(params: Params, key: string): string {
    const value = getStringParam(params, key);
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
  }

  private areFiltersEqual(a: FilterState, b: FilterState): boolean {
    return (
      a.searchQuery === b.searchQuery &&
      a.seriesId === b.seriesId &&
      a.userId === b.userId &&
      a.candidateForStandardizationOnly === b.candidateForStandardizationOnly &&
      a.startDate === b.startDate &&
      a.endDate === b.endDate
    );
  }

  private getFilterQueryParams(): Record<string, string | undefined> {
    const f = this.filters();

    return {
      searchQuery: f.searchQuery || undefined,
      seriesId: f.seriesId || undefined,
      userId: f.userId || undefined,
      candidateForStandardizationOnly: f.candidateForStandardizationOnly ? 'true' : undefined,
      startDate: f.startDate || undefined,
      endDate: f.endDate || undefined,
      page: this.currentPage() > 1 ? String(this.currentPage()) : undefined,
    };
  }
}
