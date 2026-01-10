import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div [class]="getCardClasses()">
      @if (title || subtitle) {
        <div class="px-6 py-4 border-b border-gray-200">
          @if (title) {
            <h3 class="text-lg font-semibold text-gray-900">{{ title }}</h3>
          }
          @if (subtitle) {
            <p class="mt-1 text-sm text-gray-500">{{ subtitle }}</p>
          }
        </div>
      }
      <div [class]="noPadding ? '' : 'px-6 py-4'">
        <ng-content></ng-content>
      </div>
      <ng-content select="[card-footer]"></ng-content>
    </div>
  `
})
export class CardComponent {
  @Input() title = '';
  @Input() subtitle = '';
  @Input() noPadding = false;
  @Input() hover = false;

  getCardClasses(): string {
    const base = 'bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden';
    const hoverClass = this.hover ? 'hover:shadow-md transition-shadow cursor-pointer' : '';
    return `${base} ${hoverClass}`;
  }
}
