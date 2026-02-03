import { Component, input, output, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LegendComponent, LegendItem } from '../legend/legend.component';
import { ButtonComponent } from '../button/button.component';

@Component({
  selector: 'app-export-container',
  standalone: true,
  imports: [CommonModule, LegendComponent, ButtonComponent],
  template: `
    <div class="export-container">
      <ng-content />
    </div>

    <!-- Fullscreen overlay -->
    @if (isExportMode()) {
      <div class="fixed inset-0 z-[9999] bg-white flex flex-col overflow-auto export-fullscreen dark:bg-gray-900">
        <div class="flex-shrink-0 border-b border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
          <div class="max-w-7xl mx-auto flex items-center justify-between">
            <app-legend [items]="legendItems()" [title]="legendTitle()" />
            <app-button variant="secondary" (click)="exitExportMode.emit()">
              Exit Fullscreen
            </app-button>
          </div>
        </div>
        <div class="flex-1 overflow-auto p-6">
          <div class="max-w-7xl mx-auto">
            <!-- Content will be positioned here via CSS -->
          </div>
        </div>
      </div>

      @media print {
        .export-fullscreen {
          position: static;
        }
        .export-fullscreen .bg-gray-50 {
          background-color: white !important;
        }
        .export-fullscreen app-button {
          display: none;
        }
      }
    }
  `,
  styles: `
    :host {
      display: contents;
    }

    .export-container {
      display: block;
    }

    @media print {
      .export-fullscreen {
        position: static;
      }
      .export-fullscreen .bg-gray-50 {
        background-color: white !important;
      }
      .export-fullscreen app-button {
        display: none;
      }
    }
  `,
})
export class ExportContainerComponent {
  readonly isExportMode = input<boolean>(false);
  readonly legendItems = input<LegendItem[]>([]);
  readonly legendTitle = input<string>('Legend');
  readonly exitExportMode = output<void>();

  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.isExportMode()) {
      event.preventDefault();
      this.exitExportMode.emit();
    }
  }
}
