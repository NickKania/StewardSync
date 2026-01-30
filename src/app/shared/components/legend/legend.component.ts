import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface LegendItem {
  label: string;
  description: string;
  example?: string;
}

@Component({
  selector: 'app-legend',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
      @if (title()) {
        <h3 class="text-sm font-semibold text-gray-900 mb-3">{{ title() }}</h3>
      }
      <div class="space-y-2">
        @for (item of items(); track item.label) {
          <div class="flex items-start gap-3">
            <span class="text-sm font-medium text-gray-700 whitespace-nowrap">{{ item.label }}</span>
            <span class="text-sm text-gray-600">{{ item.description }}</span>
            @if (item.example) {
              <span class="text-sm text-gray-500 font-mono">{{ item.example }}</span>
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class LegendComponent {
  readonly items = input.required<LegendItem[]>();
  readonly title = input<string>('Legend');
}
