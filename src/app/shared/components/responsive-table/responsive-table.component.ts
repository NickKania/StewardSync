import {
  Component,
  Input,
  Output,
  EventEmitter,
  TemplateRef,
  contentChild,
  signal,
  computed,
} from "@angular/core";
import { CommonModule } from "@angular/common";

export interface TableColumn<T = any> {
  key: string;
  label: string;
  mobileLabel?: string;
  hiddenOnMobile?: boolean;
  priority?: "high" | "medium" | "low";
  sortable?: boolean;
  sortFn?: (a: T, b: T, direction: "asc" | "desc") => number;
}

let nextId = 0;

@Component({
  selector: "app-responsive-table",
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="responsive-table">
      @if (data.length > 0) {
        <!-- Desktop table view (md and up) -->
        <div class="hidden md:block overflow-x-auto">
          <table class="w-full">
            <thead class="bg-gray-50 dark:bg-gray-800">
              <tr class="text-left text-sm text-gray-500 dark:text-gray-400">
                @for (column of columns; track column.key) {
                  <th
                    class="px-6 py-3 font-medium"
                    [class.cursor-pointer]="column.sortable"
                    [class.hover:text-gray-700]="column.sortable"
                    [class.dark:hover:text-gray-300]="column.sortable"
                    (click)="onSortClick(column)"
                  >
                    <span class="flex items-center gap-1">
                      {{ column.label }}
                      @if (column.sortable && sortColumn() === column.key) {
                        <span class="text-xs">{{ sortDirection() === "asc" ? "↑" : "↓" }}</span>
                      }
                    </span>
                  </th>
                }
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
              @for (row of sortedData(); track trackByFn(row); let i = $index) {
                <tr
                  class="hover:bg-gray-50 dark:hover:bg-gray-800"
                  [class.cursor-pointer]="rowClickable"
                  (click)="rowClickable && rowClick.emit(row)"
                >
                  @for (column of columns; track column.key) {
                    <td class="px-6 py-4" [class]="getCellClass(column)">
                      <ng-container
                        [ngTemplateOutlet]="cellTemplate() || defaultCell"
                        [ngTemplateOutletContext]="{
                          $implicit: row,
                          column: column,
                          value: row[column.key],
                          index: i
                        }"
                      ></ng-container>
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- Mobile card view -->
        <div class="md:hidden divide-y divide-gray-100 dark:divide-gray-800">
          @for (row of sortedData(); track trackByFn(row); let i = $index) {
            <div
              class="p-4 hover:bg-gray-50 dark:hover:bg-gray-800"
              [class.cursor-pointer]="rowClickable"
              (click)="rowClickable && rowClick.emit(row)"
            >
              @if (mobileCardTemplate()) {
                <ng-container
                  [ngTemplateOutlet]="mobileCardTemplate()!"
                  [ngTemplateOutletContext]="{ $implicit: row, index: i }"
                ></ng-container>
              } @else {
                @for (column of visibleMobileColumns; track column.key) {
                  <div class="flex justify-between items-start py-1.5 first:pt-0 last:pb-0">
                    <span class="text-sm text-gray-500 dark:text-gray-400 min-w-0 shrink-0 pr-3">
                      {{ column.mobileLabel || column.label }}
                    </span>
                    <span class="text-sm text-gray-900 dark:text-gray-100 text-right min-w-0">
                      <ng-container
                        [ngTemplateOutlet]="cellTemplate() || defaultCell"
                        [ngTemplateOutletContext]="{
                          $implicit: row,
                          column: column,
                          value: row[column.key],
                          index: i
                        }"
                      ></ng-container>
                    </span>
                  </div>
                }
              }
            </div>
          }
        </div>
      } @else {
        <div class="text-center py-12">
          <svg
            class="w-12 h-12 text-gray-300 mx-auto mb-4 dark:text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
          <p class="text-gray-500 dark:text-gray-400">{{ emptyMessage }}</p>
        </div>
      }
    </div>

    <ng-template #defaultCell let-row let-column="column" let-value="value">
      {{ value ?? "-" }}
    </ng-template>
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class ResponsiveTableComponent<T = any> {
  @Input() columns: TableColumn<T>[] = [];
  @Input() data: T[] = [];
  @Input() trackKey = "_id";
  @Input() emptyMessage = "No data available";
  @Input() rowClickable = false;

  @Output() rowClick = new EventEmitter<T>();
  @Output() sortChange = new EventEmitter<{
    column: string;
    direction: "asc" | "desc";
  }>();

  cellTemplate = contentChild<TemplateRef<any>>("cell");
  mobileCardTemplate = contentChild<TemplateRef<any>>("mobileCard");

  sortColumn = signal<string | null>(null);
  sortDirection = signal<"asc" | "desc">("asc");

  tableId = `responsive-table-${nextId++}`;

  get visibleMobileColumns(): TableColumn<T>[] {
    return this.columns.filter((c) => !c.hiddenOnMobile);
  }

  sortedData = computed(() => {
    const data = this.data;
    const column = this.sortColumn();
    const direction = this.sortDirection();

    if (!column) return data;

    const colDef = this.columns.find((c) => c.key === column);
    if (colDef?.sortFn) {
      return [...data].sort((a, b) => colDef.sortFn!(a, b, direction));
    }

    return [...data].sort((a, b) => {
      const aVal = a[column as keyof T];
      const bVal = b[column as keyof T];
      let comparison = 0;

      if (aVal == null && bVal == null) comparison = 0;
      else if (aVal == null) comparison = -1;
      else if (bVal == null) comparison = 1;
      else if (aVal < bVal) comparison = -1;
      else if (aVal > bVal) comparison = 1;

      return direction === "asc" ? comparison : -comparison;
    });
  });

  trackByFn = (row: T): any => {
    return (row as any)[this.trackKey as keyof T];
  };

  getCellClass(column: TableColumn<T>): string {
    const classes: string[] = [];

    if (column.priority === "high") {
      classes.push("text-gray-900", "dark:text-gray-100", "font-medium");
    }

    return classes.join(" ");
  }

  onSortClick(column: TableColumn<T>): void {
    if (!column.sortable) return;

    if (this.sortColumn() === column.key) {
      this.sortDirection.set(this.sortDirection() === "asc" ? "desc" : "asc");
    } else {
      this.sortColumn.set(column.key);
      this.sortDirection.set("asc");
    }

    this.sortChange.emit({
      column: column.key,
      direction: this.sortDirection(),
    });
  }
}
