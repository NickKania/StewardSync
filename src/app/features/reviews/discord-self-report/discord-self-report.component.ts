import { CommonModule } from "@angular/common";
import {
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from "@angular/core";
import { AuthService } from "@core/services/auth.service";
import { ConvexService } from "@core/services/convex.service";
import { ToastService } from "@core/services/toast.service";
import { ButtonComponent } from "@shared/components/button/button.component";
import { CardComponent } from "@shared/components/card/card.component";
import { DateFormatPipe } from "@shared/pipes/date-format.pipe";

type DiscordSelfReportReason =
  | "missing_channel"
  | "missing_driver_discord"
  | "discord_access_error"
  | "no_at_fault_driver";

type DiscordSelfReportMessage = {
  id: string;
  authorName: string;
  authorAvatarUrl?: string;
  content: string;
  timestamp: number;
  jumpUrl: string;
  attachmentUrls: string[];
};

type DiscordSelfReportResult = {
  ok: boolean;
  reason?: DiscordSelfReportReason;
  channelName?: string;
  driverLabel?: string;
  windowStart: number;
  windowEnd: number;
  messages: DiscordSelfReportMessage[];
  hasMore: boolean;
  contentAccessWarning?: boolean;
};

/** Minimal report shape needed for the Discord self-report panel. */
export type DiscordSelfReportReport = {
  _id: string;
  event?: {
    eventDate?: number;
  } | null;
};

@Component({
  selector: "app-discord-self-report",
  standalone: true,
  imports: [CommonModule, CardComponent, ButtonComponent, DateFormatPipe],
  template: `
    <app-card title="Discord Self Reporting">
      <div class="space-y-4">
        <div class="text-sm text-gray-600 dark:text-gray-300">
          @if (report()?.event?.eventDate) {
            <p>
              Window:
              {{ report()?.event?.eventDate | dateFormat: "PPp" }} to now
            </p>
          }
          @if (displayResult()?.driverLabel) {
            <p class="mt-1">Driver: {{ displayResult()?.driverLabel }}</p>
          }
        </div>

        @if (noDriverSelected()) {
          <div
            class="rounded-md border border-warning-border bg-warning-bg px-3 py-2 text-sm text-warning-text"
          >
            No at-fault driver selected.
          </div>
        } @else {
          <app-button
            variant="secondary"
            size="sm"
            [loading]="loading()"
            (onClick)="loadMessages()"
          >
            Load Messages
          </app-button>
        }

        @if (displayResult(); as selfReport) {
          @if (!selfReport.ok) {
            <div
              class="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
            >
              {{ reasonText(selfReport.reason) }}
            </div>
          } @else if (selfReport.messages.length === 0) {
            <div
              class="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
            >
              No messages from this driver in the selected window.
            </div>
          } @else {
            @if (selfReport.contentAccessWarning) {
              <div
                class="rounded-md border border-warning-border bg-warning-bg px-3 py-2 text-sm text-warning-text"
              >
                Message text looks empty. If the bot is missing Message Content
                Intent or channel read access, enable them in the Discord
                Developer Portal / channel permissions. Stickers, embeds, or
                polls may also appear without body text.
              </div>
            }
            <div
              class="max-h-96 overflow-y-auto rounded-md border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900"
            >
              @for (message of selfReport.messages; track message.id) {
                <article
                  class="border-b border-gray-200 p-3 last:border-b-0 dark:border-gray-700"
                >
                  <div class="flex items-start gap-3">
                    @if (message.authorAvatarUrl) {
                      <img
                        [src]="message.authorAvatarUrl"
                        alt=""
                        class="h-8 w-8 rounded-full"
                      />
                    } @else {
                      <div
                        class="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xs font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-200"
                      >
                        {{ initials(message.authorName) }}
                      </div>
                    }
                    <div class="min-w-0 flex-1">
                      <div
                        class="flex flex-wrap items-baseline gap-x-2 gap-y-1"
                      >
                        <span
                          class="font-medium text-gray-900 dark:text-gray-100"
                          >{{ message.authorName }}</span
                        >
                        <a
                          [href]="message.jumpUrl"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="text-xs text-primary-600 hover:underline dark:text-primary-400"
                        >
                          {{ message.timestamp | dateFormat: "PPp" }}
                        </a>
                      </div>
                      @if (message.content) {
                        <p
                          class="mt-1 whitespace-pre-wrap break-words text-sm text-gray-700 dark:text-gray-300"
                        >
                          {{ message.content }}
                        </p>
                      }
                      @if (message.attachmentUrls.length > 0) {
                        <div class="mt-2 space-y-1">
                          @for (
                            attachmentUrl of message.attachmentUrls;
                            track attachmentUrl
                          ) {
                            <a
                              [href]="attachmentUrl"
                              target="_blank"
                              rel="noopener noreferrer"
                              class="block truncate text-xs text-primary-600 hover:underline dark:text-primary-400"
                            >
                              {{ attachmentUrl }}
                            </a>
                          }
                        </div>
                      }
                    </div>
                  </div>
                </article>
              }
            </div>
            @if (selfReport.hasMore) {
              <p class="text-xs text-gray-500 dark:text-gray-400">
                Showing a partial result (message, page, or time cap). Load
                again after narrowing the channel history if needed.
              </p>
            }
          }
        }
      </div>
    </app-card>
  `,
})
export class DiscordSelfReportComponent {
  readonly report = input.required<DiscordSelfReportReport | null | undefined>();
  readonly atFaultDriverId = input<string | null | undefined>();

  private readonly convex = inject(ConvexService);
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(false);
  readonly result = signal<DiscordSelfReportResult | null>(null);
  /** Driver id the current `result` was loaded for (avoids stale UI). */
  private readonly resultDriverId = signal<string | null>(null);
  /** Last report+driver key used to decide when to drop cached self-report data. */
  private lastSelfReportKey: string | null = null;

  readonly noDriverSelected = computed(() => !this.atFaultDriverId());

  /** Only surface self-report data that matches the currently selected at-fault driver. */
  readonly displayResult = computed(() => {
    if (this.noDriverSelected()) {
      return null;
    }
    const selectedDriverId = this.atFaultDriverId();
    const result = this.result();
    if (!result || !selectedDriverId) {
      return null;
    }
    if (this.resultDriverId() !== selectedDriverId) {
      return null;
    }
    return result;
  });

  constructor() {
    effect(
      () => {
        // Key on report id + driver only — ignore report object identity so
        // Convex subscription refreshes do not wipe a successful load.
        const key = `${this.report()?._id ?? ""}:${this.atFaultDriverId() ?? ""}`;
        if (this.lastSelfReportKey !== null && this.lastSelfReportKey !== key) {
          this.result.set(null);
          this.resultDriverId.set(null);
        }
        this.lastSelfReportKey = key;
      },
      { allowSignalWrites: true },
    );
  }

  async loadMessages(): Promise<void> {
    const report = this.report();
    const selectedDriverId = this.atFaultDriverId();

    if (!report?._id || !selectedDriverId) {
      return;
    }

    this.loading.set(true);
    this.result.set(null);
    this.resultDriverId.set(null);
    try {
      const result = (await this.convex.action(
        this.convex.api.reportDiscord.getSelfReportMessages,
        {
          currentUserId: this.authService.requireUserId(),
          reportId: report._id,
          atFaultDriverId: selectedDriverId,
        },
      )) as DiscordSelfReportResult;

      // Drop late responses if the steward switched drivers mid-flight.
      if (this.atFaultDriverId() !== selectedDriverId) {
        return;
      }

      this.result.set(result);
      this.resultDriverId.set(selectedDriverId);
    } catch (error) {
      console.error("Failed to load Discord self reporting", error);
      this.toast.error("Could not load Discord history");
    } finally {
      this.loading.set(false);
    }
  }

  reasonText(reason: DiscordSelfReportReason | undefined): string {
    if (reason === "missing_channel") {
      return "No Discord incident channel configured for this series.";
    }
    if (reason === "missing_driver_discord") {
      return "Selected driver does not have a linked Discord account.";
    }
    if (reason === "no_at_fault_driver") {
      return "No at-fault driver selected.";
    }
    return "Could not load Discord history. Check bot permissions and Message Content intent.";
  }

  initials(name: string): string {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("");
  }
}
