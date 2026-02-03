import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (isOpen) {
      <div
        class="fixed inset-0 z-50 overflow-y-auto"
        role="dialog"
        aria-modal="true"
      >
        <!-- Backdrop -->
        <div
          class="fixed inset-0 bg-black/50 transition-opacity dark:bg-black/70"
          (click)="closeOnBackdrop && close.emit()"
        ></div>

        <!-- Modal container -->
        <div class="flex min-h-full items-center justify-center p-4">
          <div
            class="relative bg-white rounded-xl shadow-xl max-w-lg w-full transform transition-all dark:bg-gray-900"
            [class.max-w-md]="size === 'sm'"
            [class.max-w-lg]="size === 'md'"
            [class.max-w-2xl]="size === 'lg'"
            [class.max-w-4xl]="size === 'xl'"
          >
            <!-- Header -->
            @if (title) {
              <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">{{ title }}</h3>
                @if (showClose) {
                  <button
                    type="button"
                    class="p-1 text-gray-400 hover:text-gray-500 rounded-lg hover:bg-gray-100 transition-colors dark:hover:bg-gray-800 dark:text-gray-500 dark:hover:text-gray-300"
                    (click)="close.emit()"
                    aria-label="Close"
                  >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                  </button>
                }
              </div>
            }

            <!-- Body -->
            <div class="px-6 py-4">
              <ng-content></ng-content>
            </div>

            <!-- Footer -->
            <ng-content select="[modal-footer]"></ng-content>
          </div>
        </div>
      </div>
    }
  `
})
export class ModalComponent {
  @Input() isOpen = false;
  @Input() title = '';
  @Input() size: 'sm' | 'md' | 'lg' | 'xl' = 'md';
  @Input() showClose = true;
  @Input() closeOnBackdrop = true;

  @Output() close = new EventEmitter<void>();
}
