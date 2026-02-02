import { Component, output, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4">
      <p class="text-sm text-gray-500">
        Showing {{ startItem() }}-{{ endItem() }} of {{ totalResults() }} results
      </p>
      
      <nav class="flex items-center gap-2">
        <button
          (click)="onPrevious()"
          [disabled]="currentPage() === 1"
          class="px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          Previous
        </button>
        
        @for (pageNum of visiblePages(); track pageNum) {
          @if (pageNum === 'ellipsis') {
            <span class="px-3 py-2 text-gray-400">...</span>
          } @else {
            <button
              (click)="onPageChange(pageNum)"
              [class.bg-primary-600]="currentPage() === pageNum"
              [class.text-white]="currentPage() === pageNum"
              [class.hover:bg-primary-700]="currentPage() === pageNum"
              [class.border-primary-600]="currentPage() === pageNum"
              [class.bg-white]="currentPage() !== pageNum"
              [class.text-gray-700]="currentPage() !== pageNum"
              [class.border-gray-300]="currentPage() !== pageNum"
              [class.hover:bg-gray-50]="currentPage() !== pageNum"
              [class.dark:bg-gray-900]="currentPage() !== pageNum"
              [class.dark:text-gray-300]="currentPage() !== pageNum"
              [class.dark:border-gray-600]="currentPage() !== pageNum"
              [class.dark:hover:bg-gray-800]="currentPage() !== pageNum"
              class="px-3 py-2 text-sm font-medium rounded-lg border"
            >
              {{ pageNum }}
            </button>
          }
        }
        
        <button
          (click)="onNext()"
          [disabled]="currentPage() === totalPages()"
          class="px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          Next
        </button>
      </nav>
    </div>
  `,
  styles: '',
})
export class PaginationComponent {
  readonly currentPage = input.required<number>();
  readonly totalPages = input.required<number>();
  readonly totalResults = input.required<number>();
  readonly limit = input.required<number>();
  readonly pageChange = output<number>();

  startItem(): number {
    if (this.totalResults() === 0) return 0;
    return (this.currentPage() - 1) * this.limit() + 1;
  }

  endItem(): number {
    return Math.min(this.currentPage() * this.limit(), this.totalResults());
  }

  visiblePages(): Array<number | 'ellipsis'> {
    const pages: Array<number | 'ellipsis'> = [];
    const total = this.totalPages();
    const current = this.currentPage();

    if (total <= 7) {
      for (let i = 1; i <= total; i++) {
        pages.push(i);
      }
    } else {
      if (current <= 3) {
        for (let i = 1; i <= 4; i++) {
          pages.push(i);
        }
        pages.push('ellipsis');
        pages.push(total);
      } else if (current >= total - 2) {
        pages.push(1);
        pages.push('ellipsis');
        for (let i = total - 3; i <= total; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push('ellipsis');
        for (let i = current - 1; i <= current + 1; i++) {
          pages.push(i);
        }
        pages.push('ellipsis');
        pages.push(total);
      }
    }

    return pages;
  }

  onPageChange(page: number | 'ellipsis'): void {
    if (typeof page === 'number' && page !== this.currentPage()) {
      this.pageChange.emit(page);
    }
  }

  onPrevious(): void {
    if (this.currentPage() > 1) {
      this.pageChange.emit(this.currentPage() - 1);
    }
  }

  onNext(): void {
    if (this.currentPage() < this.totalPages()) {
      this.pageChange.emit(this.currentPage() + 1);
    }
  }
}
