import { CommonModule } from "@angular/common";
import { Component, computed, effect, input, output, signal } from "@angular/core";
import { ModalComponent } from "@shared/components/modal/modal.component";

interface ChangelogRelease {
  version: string;
  date: string;
  changes: string[];
}

@Component({
  selector: "app-changelog-flyout",
  standalone: true,
  imports: [CommonModule, ModalComponent],
  template: `
    <app-modal
      [isOpen]="isOpen()"
      title="Changelog"
      size="lg"
      (close)="closeRequested.emit()"
    >
      <div class="max-h-[70vh] overflow-y-auto pr-1">
        @if (isLoading()) {
          <p class="text-sm text-gray-600 dark:text-gray-300">Loading changelog...</p>
        } @else if (errorMessage()) {
          <p class="text-sm text-red-600 dark:text-red-400">{{ errorMessage() }}</p>
        } @else {
          @if (releases().length > 0) {
            <div class="space-y-6">
              @for (release of releases(); track release.version + release.date) {
                <section class="border-b border-gray-200 pb-4 last:border-b-0 last:pb-0 dark:border-gray-700">
                  <div>
                    <p class="text-sm text-gray-500 dark:text-gray-400">Version</p>
                    <p class="text-base font-semibold text-gray-900 dark:text-gray-100">
                      v{{ release.version }}
                    </p>
                  </div>

                  <div class="mt-2">
                    <p class="text-sm text-gray-500 dark:text-gray-400">Release Date</p>
                    <p class="text-base text-gray-900 dark:text-gray-100">{{ release.date }}</p>
                  </div>

                  <div class="mt-2">
                    <p class="text-sm text-gray-500 dark:text-gray-400">Changes</p>
                    <ul class="mt-2 list-disc pl-5 space-y-1 text-sm text-gray-700 dark:text-gray-200">
                      @for (change of release.changes; track change) {
                        <li>{{ change }}</li>
                      }
                    </ul>
                  </div>
                </section>
              }
            </div>
          } @else {
            <p class="text-sm text-gray-600 dark:text-gray-300">No changelog entries found.</p>
          }
        }
      </div>
    </app-modal>
  `,
})
export class ChangelogFlyoutComponent {
  private static cachedReleases: ChangelogRelease[] | null = null;

  readonly isOpen = input(false);
  readonly closeRequested = output<void>();

  private readonly releasesData = signal<ChangelogRelease[]>([]);
  readonly isLoading = signal(false);
  readonly errorMessage = signal("");
  readonly releases = computed(() =>
    [...this.releasesData()].sort((a, b) => b.date.localeCompare(a.date)),
  );

  constructor() {
    if (ChangelogFlyoutComponent.cachedReleases) {
      this.releasesData.set(ChangelogFlyoutComponent.cachedReleases);
    }

    effect(() => {
      if (
        this.isOpen() &&
        !this.isLoading() &&
        !ChangelogFlyoutComponent.cachedReleases
      ) {
        void this.loadChangelog();
      }
    }, { allowSignalWrites: true });
  }

  private async loadChangelog(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set("");

    try {
      const changelogUrl = new URL("assets/changelog.json", document.baseURI)
        .toString();
      const response = await fetch(changelogUrl);
      if (!response.ok) {
        throw new Error("Unable to fetch changelog data.");
      }

      const payload: unknown = await response.json();
      const releases = this.parseReleases(payload);
      if (!releases) {
        throw new Error("Changelog data format is invalid.");
      }

      ChangelogFlyoutComponent.cachedReleases = releases;
      this.releasesData.set(releases);
    } catch (error) {
      console.error("Failed to load changelog:", error);
      this.errorMessage.set("Unable to load changelog right now.");
    } finally {
      this.isLoading.set(false);
    }
  }

  private parseReleases(value: unknown): ChangelogRelease[] | null {
    const rawReleases =
      value && typeof value === "object" && "releases" in value
        ? (value as { releases: unknown }).releases
        : value;

    if (!Array.isArray(rawReleases)) {
      return null;
    }

    const releases: ChangelogRelease[] = [];
    for (const release of rawReleases) {
      if (!release || typeof release !== "object") {
        return null;
      }

      const entry = release as {
        version?: unknown;
        date?: unknown;
        changes?: unknown;
      };

      if (
        typeof entry.version !== "string" ||
        typeof entry.date !== "string" ||
        !Array.isArray(entry.changes) ||
        !entry.changes.every((change) => typeof change === "string")
      ) {
        return null;
      }

      releases.push({
        version: entry.version,
        date: entry.date,
        changes: entry.changes,
      });
    }

    return releases;
  }
}
