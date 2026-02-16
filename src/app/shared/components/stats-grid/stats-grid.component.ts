import { Component, Input } from "@angular/core";
import { CommonModule } from "@angular/common";

export interface StatCard {
  value: string | number;
  label: string;
  variant?: "default" | "primary" | "success" | "warning" | "danger" | "info";
  icon?: string;
}

@Component({
  selector: "app-stats-grid",
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
      @for (stat of stats; track stat.label) {
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 dark:bg-gray-900 dark:border-gray-700 p-4 sm:p-5">
          <div class="text-center">
            <p [class]="getValueClasses(stat.variant)">
              {{ stat.value }}
            </p>
            <p class="text-xs sm:text-sm text-gray-500 mt-1 dark:text-gray-400">
              {{ stat.label }}
            </p>
          </div>
        </div>
      }
    </div>
  `,
})
export class StatsGridComponent {
  @Input() stats: StatCard[] = [];

  getValueClasses(variant: string = "default"): string {
    const base = "text-2xl sm:text-3xl font-bold";

    const variantClasses: Record<string, string> = {
      default: "text-gray-900 dark:text-gray-100",
      primary: "text-primary-600",
      success: "text-green-600",
      warning: "text-amber-600",
      danger: "text-red-600",
      info: "text-blue-600",
    };

    return `${base} ${variantClasses[variant] ?? variantClasses["default"]}`;
  }
}
