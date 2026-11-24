import { JsonPipe } from "@angular/common";
import { Component, inject, signal, type OnInit } from "@angular/core";
import { RouterLink } from "@angular/router";
import { AuthService } from "@core/services/auth.service";
import { ToastService } from "@core/services/toast.service";
import { TestModeService } from "@core/test-mode/test-mode.service";
import {
  TEST_SCENARIOS,
  TEST_USERS,
  type StagedScenarioManifest,
  type TestModeReadiness,
  type TestScenarioName,
  type TestUserKey,
} from "@core/test-mode/test-mode.types";

const READINESS_LABELS: Record<TestModeReadiness, string> = {
  non_loopback_target: "Convex must use a loopback HTTP address with an explicit port.",
  unreachable: "The local Convex backend did not respond.",
  functions_missing: "Local Test Mode functions are missing from this deployment.",
  disabled: "Local Test Mode is disabled on the backend.",
  ready: "Local Convex is ready.",
};

@Component({
  selector: "app-test-mode",
  standalone: true,
  imports: [JsonPipe, RouterLink],
  template: `
    <main class="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-8">
      <header class="flex flex-wrap items-start justify-between gap-4 border-b-4 border-primary-600 pb-5">
        <h1 class="text-3xl font-black tracking-tight sm:text-4xl">Local Test Mode</h1>
        @if (!auth.isAuthenticated()) {
          <a routerLink="/login" class="text-sm font-semibold text-primary-700 hover:underline dark:text-primary-300">
            Back to sign in
          </a>
        }
      </header>

      <div class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-300 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
        <p role="status" data-testid="test-mode-readiness" [attr.data-state]="readiness() ?? 'checking'" class="text-sm font-medium">
          @if (readiness(); as state) {
            {{ readinessLabels[state] }}
          } @else {
            Checking local Convex…
          }
        </p>
        <button type="button" (click)="checkReadiness()" [disabled]="readiness() === null"
          class="text-sm font-semibold text-primary-700 hover:underline disabled:opacity-50 dark:text-primary-300">
          Check again
        </button>
      </div>

      <section aria-labelledby="test-mode-identity-title">
        <h2 id="test-mode-identity-title" class="mb-3 text-lg font-bold">Sign in as a test user</h2>
        <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          @for (key of userKeys; track key) {
            <button type="button" [disabled]="!canRun()" [attr.data-testid]="'test-mode-login-' + key"
              (click)="loginAs(key)"
              class="rounded-lg border border-gray-300 bg-white px-4 py-3 text-left hover:border-primary-600 hover:text-primary-700 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-primary-400 dark:hover:text-primary-300">
              <span class="block text-sm font-semibold">{{ users[key] }}</span>
              <span class="block font-mono text-xs text-gray-500 dark:text-gray-400">{{ key }}</span>
            </button>
          }
        </div>
      </section>

      <section aria-labelledby="test-mode-scenarios-title" class="space-y-4 border-t border-gray-300 pt-5 dark:border-gray-700">
        <h2 id="test-mode-scenarios-title" class="text-lg font-bold">Stage a scenario</h2>
        <label class="block max-w-xs text-sm font-semibold">
          Scenario ID
          <input #scenarioInput type="text" maxlength="64" [value]="scenarioId()"
            (input)="scenarioId.set(scenarioInput.value)"
            class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono dark:border-gray-700 dark:bg-gray-900" />
        </label>
        <div class="flex flex-wrap gap-2">
          @for (scenario of scenarioNames; track scenario) {
            <button type="button" [disabled]="!canRun() || !scenarioId().trim()"
              [attr.data-testid]="'test-mode-stage-' + scenario" (click)="stageScenario(scenario)"
              class="rounded-lg bg-primary-700 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-800 disabled:opacity-50">
              {{ scenarios[scenario] }}
            </button>
          }
          <button type="button" data-testid="test-mode-reset" [disabled]="!canRun() || !scenarioId().trim()"
            (click)="resetScenario()"
            class="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950">
            Reset scenario
          </button>
        </div>
        @if (manifest(); as staged) {
          <div class="space-y-3 rounded-lg border border-gray-300 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
            <h3 class="font-bold">{{ scenarios[staged.scenario] }} <span class="font-mono text-sm font-normal">({{ staged.scenarioId }})</span></h3>
            <ul class="divide-y divide-gray-200 dark:divide-gray-700">
              @for (link of staged.links; track link.key) {
                <li class="flex flex-wrap items-center justify-between gap-2 py-2">
                  <button type="button" [disabled]="!canRun()" [attr.data-testid]="'test-mode-link-' + link.key"
                    (click)="openFixture(staged, link)"
                    class="text-left text-sm font-semibold text-primary-700 hover:underline disabled:opacity-50 dark:text-primary-300">
                    {{ link.label }}
                  </button>
                  <span class="font-mono text-xs text-gray-600 dark:text-gray-400">{{ link.recommendedRoles.join(', ') }}</span>
                </li>
              }
            </ul>
            <details>
              <summary class="cursor-pointer text-sm font-semibold">Fixture IDs</summary>
              <pre class="mt-2 overflow-auto rounded-md bg-gray-100 p-3 text-xs dark:bg-gray-950">{{ staged | json }}</pre>
            </details>
          </div>
        }
      </section>
    </main>
  `,
})
export class TestModeComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly testMode = inject(TestModeService);
  private readonly toast = inject(ToastService);

  protected readonly users = TEST_USERS;
  protected readonly userKeys = Object.keys(TEST_USERS) as TestUserKey[];
  protected readonly scenarios = TEST_SCENARIOS;
  protected readonly scenarioNames = Object.keys(TEST_SCENARIOS) as TestScenarioName[];
  protected readonly readinessLabels = READINESS_LABELS;
  protected readonly readiness = signal<TestModeReadiness | null>(null);
  protected readonly scenarioId = signal("default");
  protected readonly manifest = signal<StagedScenarioManifest | null>(null);
  private readonly busy = signal(false);

  ngOnInit(): void {
    void this.checkReadiness();
  }

  protected canRun(): boolean {
    return this.readiness() === "ready" && !this.busy();
  }

  protected async checkReadiness(): Promise<void> {
    this.readiness.set(null);
    this.readiness.set(await this.testMode.getReadiness());
  }

  protected async loginAs(key: TestUserKey): Promise<void> {
    await this.run(() => this.testMode.loginAs(key));
  }

  protected async stageScenario(scenario: TestScenarioName): Promise<void> {
    await this.run(async () => {
      const manifest = await this.testMode.stageScenario({ scenario, scenarioId: this.scenarioId().trim() });
      this.manifest.set(manifest);
    });
  }

  protected async resetScenario(): Promise<void> {
    await this.run(async () => {
      const scenarioId = this.scenarioId().trim();
      await this.testMode.reset({ scenarioId });
      if (this.manifest()?.scenarioId === scenarioId) this.manifest.set(null);
      this.toast.success(`Reset scenario ${scenarioId}`);
    });
  }

  protected async openFixture(
    manifest: StagedScenarioManifest,
    link: StagedScenarioManifest["links"][number],
  ): Promise<void> {
    const currentKey = this.userKeys.find((key) => manifest.users[key].id === this.auth.getUserId() &&
      link.recommendedRoles.includes(manifest.users[key].role));
    // These fixtures need a particular actor in addition to the recommended role.
    const fixtureActor = ({
      requestablePenalty: "driver_2",
      singleReviewReport: "steward_2",
    } as Partial<Record<string, TestUserKey>>)[link.key];
    const key = fixtureActor ?? currentKey ?? link.recommendedRoles[0];
    await this.run(() => this.testMode.loginAs(key, { redirectTo: link.path }));
  }

  private async run(action: () => Promise<unknown>): Promise<void> {
    if (!this.canRun()) return;
    this.busy.set(true);
    try {
      await action();
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : "Local Test Mode operation failed");
    } finally {
      this.busy.set(false);
    }
  }
}
