import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
export type BadgeSize = 'sm' | 'md';

@Component({
  selector: 'app-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span [class]="getBadgeClasses()" class="align-middle">
      <ng-content></ng-content>
    </span>
  `
})
export class BadgeComponent {
  @Input() variant: BadgeVariant = 'default';
  @Input() size: BadgeSize = 'md';

  getBadgeClasses(): string {
    const base = 'inline-block font-medium rounded-full align-middle leading-tight text-center';

    const variants: Record<BadgeVariant, string> = {
      default: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
      primary: 'bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-200',
      success: 'bg-success-bg text-success-text',
      warning: 'bg-warning-bg text-warning-text',
      danger: 'bg-danger-bg text-danger-text',
      info: 'bg-info-bg text-info-text'
    };

    const sizes: Record<BadgeSize, string> = {
      sm: 'px-2 py-0.5 text-xs',
      md: 'px-2.5 py-0.5 text-sm'
    };

    return `${base} ${variants[this.variant]} ${sizes[this.size]}`;
  }
}
