import { Component, Input, Output, EventEmitter } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterLink } from "@angular/router";

export interface Tab {
  id: string;
  label: string;
  badge?: string | number;
  routeCommands?: unknown[] | string[];
  queryParams?: Record<string, string | number | boolean | undefined>;
  exact?: boolean;
}

@Component({
  selector: "app-tabs",
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="border-b border-gray-200 dark:border-gray-700">
      <nav
        class="flex -mx-4 px-4 md:mx-0 md:px-0 overflow-x-auto scrollbar-hide"
        [class.space-x-8]="variant === 'default'"
        [class.space-x-4]="variant === 'pills'"
        role="tablist"
      >
        @for (tab of tabs; track tab.id) {
          @if (tab.routeCommands?.length) {
            <a
              [attr.aria-selected]="activeTab === tab.id"
              role="tab"
              [class]="getTabClasses(tab.id)"
              [queryParams]="tab.queryParams"
              [routerLink]="tab.routeCommands"
              class="shrink-0"
            >
              {{ tab.label }}
              @if (tab.badge !== undefined) {
                <span
                  class="ml-1.5 px-1.5 py-0.5 text-xs rounded-full"
                  [class.bg-gray-100]="activeTab !== tab.id"
                  [class.text-gray-600]="activeTab !== tab.id"
                  [class.dark.bg-gray-700]="activeTab !== tab.id"
                  [class.dark.text-gray-300]="activeTab !== tab.id"
                  [class.bg-white]="activeTab === tab.id"
                  [class.text-primary-600]="activeTab === tab.id"
                >
                  {{ tab.badge }}
                </span>
              }
            </a>
          } @else {
            <button
              [attr.aria-selected]="activeTab === tab.id"
              role="tab"
              [class]="getTabClasses(tab.id)"
              (click)="onTabClick(tab.id)"
              type="button"
              class="shrink-0"
            >
              {{ tab.label }}
              @if (tab.badge !== undefined) {
                <span
                  class="ml-1.5 px-1.5 py-0.5 text-xs rounded-full"
                  [class.bg-gray-100]="activeTab !== tab.id"
                  [class.text-gray-600]="activeTab !== tab.id"
                  [class.dark.bg-gray-700]="activeTab !== tab.id"
                  [class.dark.text-gray-300]="activeTab !== tab.id"
                  [class.bg-white]="activeTab === tab.id"
                  [class.text-primary-600]="activeTab === tab.id"
                >
                  {{ tab.badge }}
                </span>
              }
            </button>
          }
        }
      </nav>
    </div>
  `,
  styles: [
    `
      .scrollbar-hide {
        -ms-overflow-style: none;
        scrollbar-width: none;
      }
      .scrollbar-hide::-webkit-scrollbar {
        display: none;
      }
    `,
  ],
})
export class TabsComponent {
  @Input() tabs: Tab[] = [];
  @Input() activeTab = "";
  @Input() variant: "default" | "pills" = "default";
  @Output() activeTabChange = new EventEmitter<string>();

  getTabClasses(tabId: string): string {
    if (this.variant === "pills") {
      return this.getPillTabClasses(tabId);
    }
    return this.getDefaultTabClasses(tabId);
  }

  private getDefaultTabClasses(tabId: string): string {
    const base =
      "whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2";

    if (this.activeTab === tabId) {
      return `${base} border-primary-500 text-primary-600 dark:text-primary-400 dark:border-primary-400`;
    }

    return `${base} border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-300`;
  }

  private getPillTabClasses(tabId: string): string {
    const base =
      "whitespace-nowrap py-2 px-4 rounded-lg font-medium text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2";

    if (this.activeTab === tabId) {
      return `${base} bg-primary-500 text-white`;
    }

    return `${base} text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-gray-800`;
  }

  onTabClick(tabId: string): void {
    if (this.activeTab !== tabId) {
      this.activeTabChange.emit(tabId);
    }
  }
}
