import { Component, inject } from '@angular/core';
import { IconComponent } from '@shared/components/icon/icon.component';
import { CommonModule } from '@angular/common';
import { ToastService, Toast } from '@core/services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <div class="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      @for (toast of toastService.toasts(); track toast.id) {
        <div
          class="flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg min-w-[300px] max-w-md animate-slide-in"
          [class]="getToastClasses(toast)"
          role="alert"
        >
          <app-icon [name]="toast.type" class="shrink-0" />
          <p class="flex-1 text-sm font-medium">{{ toast.message }}</p>
          <button
            (click)="toastService.dismiss(toast.id)"
            class="p-1 rounded hover:bg-black/10 transition-colors dark:hover:bg-white/10"
            aria-label="Dismiss"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    @keyframes slide-in {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    .animate-slide-in {
      animation: slide-in 0.3s ease-out;
    }
  `]
})
export class ToastComponent {
  toastService = inject(ToastService);

  getToastClasses(toast: Toast): string {
    const baseClasses = '';
    switch (toast.type) {
      case 'success':
        return `${baseClasses} bg-success-bg text-success-text border border-success-border`;
      case 'error':
        return `${baseClasses} bg-danger-bg text-danger-text border border-danger-border`;
      case 'warning':
        return `${baseClasses} bg-warning-bg text-warning-text border border-warning-border`;
      case 'info':
      default:
        return `${baseClasses} bg-info-bg text-info-text border border-info-border`;
    }
  }
}
