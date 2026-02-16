import { Component, Input, Output, EventEmitter } from "@angular/core";
import { CommonModule } from "@angular/common";

@Component({
  selector: "app-modal",
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
        <div
          class="flex min-h-full items-center justify-center p-4"
          [class.p-0]="fullscreenOnMobile"
          [class.md\\:p-4]="fullscreenOnMobile"
        >
          <div
            [class]="getModalClasses()"
          >
            <!-- Mobile close button (fullscreen mode) -->
            @if (fullscreenOnMobile && showClose) {
              <button
                type="button"
                class="md:hidden absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-500 rounded-lg hover:bg-gray-100 transition-colors dark:hover:bg-gray-800 dark:text-gray-500 dark:hover:text-gray-300 min-h-11 min-w-11 flex items-center justify-center"
                (click)="close.emit()"
                aria-label="Close"
              >
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            }

            <!-- Header -->
            @if (title) {
              <div
                class="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700"
                [class.pr-12]="fullscreenOnMobile"
              >
                <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">{{ title }}</h3>
                @if (showClose && !fullscreenOnMobile) {
                  <button
                    type="button"
                    class="p-1 text-gray-400 hover:text-gray-500 rounded-lg hover:bg-gray-100 transition-colors dark:hover:bg-gray-800 dark:text-gray-500 dark:hover:text-gray-300 min-h-11 min-w-11 flex items-center justify-center"
                    (click)="close.emit()"
                    aria-label="Close"
                  >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                  </button>
                }
                @if (showClose && fullscreenOnMobile) {
                  <button
                    type="button"
                    class="hidden md:flex p-1 text-gray-400 hover:text-gray-500 rounded-lg hover:bg-gray-100 transition-colors dark:hover:bg-gray-800 dark:text-gray-500 dark:hover:text-gray-300 min-h-11 min-w-11 items-center justify-center"
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
            <div
              class="px-4 sm:px-6 py-4"
              [class.overflow-y-auto]="fullscreenOnMobile"
              [class.flex-1]="fullscreenOnMobile"
            >
              <ng-content></ng-content>
            </div>

            <!-- Footer -->
            <ng-content select="[modal-footer]"></ng-content>
          </div>
        </div>
      </div>
    }
  `,
})
export class ModalComponent {
  @Input() isOpen = false;
  @Input() title = "";
  @Input() size: "sm" | "md" | "lg" | "xl" = "md";
  @Input() showClose = true;
  @Input() closeOnBackdrop = true;
  @Input() fullscreenOnMobile = false;

  @Output() close = new EventEmitter<void>();

  getModalClasses(): string {
    const classes: string[] = [];

    if (this.fullscreenOnMobile) {
      classes.push("relative", "bg-white", "dark:bg-gray-900");

      classes.push(
        "fixed inset-0 md:relative md:inset-auto",
        "rounded-none md:rounded-xl",
        "shadow-none md:shadow-xl",
        "w-full md:w-auto",
        "h-full md:h-auto",
        "flex flex-col"
      );
    } else {
      classes.push(
        "relative",
        "bg-white",
        "rounded-xl",
        "shadow-xl",
        "w-full",
        "dark:bg-gray-900"
      );
    }

    if (this.fullscreenOnMobile) {
      if (this.size === "sm") {
        classes.push("md:max-w-md");
      } else if (this.size === "md") {
        classes.push("md:max-w-lg");
      } else if (this.size === "lg") {
        classes.push("md:max-w-2xl");
      } else if (this.size === "xl") {
        classes.push("md:max-w-4xl");
      }
    } else {
      if (this.size === "sm") {
        classes.push("max-w-md");
      } else if (this.size === "md") {
        classes.push("max-w-lg");
      } else if (this.size === "lg") {
        classes.push("max-w-2xl");
      } else if (this.size === "xl") {
        classes.push("max-w-4xl");
      }
    }

    return classes.join(" ");
  }
}
