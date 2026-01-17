import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface Tab {
  id: string;
  label: string;
}

@Component({
  selector: 'app-tabs',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="border-b border-gray-200 dark:border-gray-700">
      <nav class="flex space-x-8" role="tablist">
        @for (tab of tabs; track tab.id) {
          <button
            [attr.aria-selected]="activeTab === tab.id"
            [attr.role]="tab"
            [class]="getTabClasses(tab.id)"
            (click)="onTabClick(tab.id)"
            type="button"
          >
            {{ tab.label }}
          </button>
        }
      </nav>
    </div>
  `
})
export class TabsComponent {
  @Input() tabs: Tab[] = [];
  @Input() activeTab = '';
  @Output() activeTabChange = new EventEmitter<string>();

  getTabClasses(tabId: string): string {
    const base = 'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2';
    
    if (this.activeTab === tabId) {
      return `${base} border-primary-500 text-primary-600 dark:text-primary-400 dark:border-primary-400`;
    }
    
    return `${base} border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-300`;
  }

  onTabClick(tabId: string): void {
    if (this.activeTab !== tabId) {
      this.activeTabChange.emit(tabId);
    }
  }
}
