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
      success: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
      warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
      danger: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
      info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200'
    };

    const sizes: Record<BadgeSize, string> = {
      sm: 'px-2 py-0.5 text-xs',
      md: 'px-2.5 py-0.5 text-sm'
    };

    return `${base} ${variants[this.variant]} ${sizes[this.size]}`;
  }
}
