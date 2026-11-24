import { Component, inject, signal } from "@angular/core";
import { RouterLink } from "@angular/router";
import { ToastService } from "@core/services/toast.service";
import { TestModeService } from "@core/test-mode/test-mode.service";
import { TEST_USERS, type TestUserKey } from "@core/test-mode/test-mode.types";

@Component({
  selector: "app-test-mode-header-control",
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="relative" (keydown.escape)="expanded.set(false); toggle.focus()">
      <button #toggle type="button" data-testid="header-test-mode-toggle" [attr.aria-expanded]="expanded()"
        aria-controls="test-mode-quick-switch" (click)="expanded.set(!expanded())"
        class="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-bold text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
        Local test
      </button>
      <div id="test-mode-quick-switch" [hidden]="!expanded()"
        class="absolute right-0 z-50 mt-2 w-48 rounded-lg border border-gray-300 bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-gray-900">
        <a routerLink="/test-mode" (click)="expanded.set(false)"
          class="block rounded px-2 py-2 text-sm font-semibold text-primary-700 hover:bg-gray-100 dark:text-primary-300 dark:hover:bg-gray-800">
          Local Test Mode
        </a>
        <ul class="border-t border-gray-200 pt-1 dark:border-gray-700">
          @for (key of userKeys; track key) {
            <li>
              <button type="button" [attr.data-testid]="'header-test-mode-switch-' + key" [disabled]="switching()"
                (click)="switchTo(key)"
                class="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-gray-800">
                {{ users[key] }}
              </button>
            </li>
          }
        </ul>
      </div>
    </div>
  `,
})
export class TestModeHeaderControlComponent {
  private readonly testMode = inject(TestModeService);
  private readonly toast = inject(ToastService);

  protected readonly expanded = signal(false);
  protected readonly switching = signal(false);
  protected readonly users = TEST_USERS;
  protected readonly userKeys = Object.keys(TEST_USERS) as TestUserKey[];

  protected async switchTo(key: TestUserKey): Promise<void> {
    this.switching.set(true);
    try {
      await this.testMode.loginAs(key, { navigate: false });
      this.expanded.set(false);
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : "Unable to switch test user");
    } finally {
      this.switching.set(false);
    }
  }
}
