import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-loading',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div [class]="getContainerClasses()">
      <svg
        [class]="getSpinnerClasses()"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          class="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          stroke-width="4"
        ></circle>
        <path
          class="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        ></path>
      </svg>
      @if (text) {
        <span class="text-gray-600">{{ text }}</span>
      }
    </div>
  `
})
export class LoadingComponent {
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Input() text = '';
  @Input() fullPage = false;

  getContainerClasses(): string {
    const base = 'flex flex-col items-center justify-center gap-3';
    return this.fullPage ? `${base} min-h-screen` : base;
  }

  getSpinnerClasses(): string {
    const base = 'animate-spin text-primary-600';
    const sizes = {
      sm: 'h-5 w-5',
      md: 'h-8 w-8',
      lg: 'h-12 w-12'
    };
    return `${base} ${sizes[this.size]}`;
  }
}
