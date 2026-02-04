import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { take } from 'rxjs';

const DISCORD_AUTH_SUCCESS = 'discord-auth-success';
const DISCORD_AUTH_ERROR = 'discord-auth-error';
const DISCORD_AUTH_RESULT_KEY = 'steward_sync_discord_auth_result';

@Component({
  selector: 'app-callback',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-900 via-primary-800 to-gray-900">
      <div class="bg-white rounded-2xl shadow-2xl p-8 text-center dark:bg-gray-900">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
        <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100">Completing sign in...</h2>
      </div>
    </div>
  `
})
export class CallbackComponent implements OnInit {
  constructor(
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.route.queryParams.pipe(take(1)).subscribe((params) => {
      const code = params['code'];
      const state = params['state'];
      const error = params['error'];
      const errorDescription = params['error_description'];
      console.log('[DiscordCallback] params received', {
        hasCode: Boolean(code),
        statePrefix: String(state ?? '').slice(0, 8),
        error,
        errorDescription,
        hasOpener: Boolean(window.opener),
      });

      if (error) {
        this.handleAuthError(errorDescription || error);
        return;
      }

      if (!code) {
        this.handleAuthError('No authorization code received');
        return;
      }

      try {
        localStorage.setItem(
          DISCORD_AUTH_RESULT_KEY,
          JSON.stringify({
            type: DISCORD_AUTH_SUCCESS,
            code,
            state,
          })
        );
        console.log('[DiscordCallback] wrote success payload to localStorage');

        if (window.opener) {
          window.opener.postMessage(
            {
              type: DISCORD_AUTH_SUCCESS,
              code,
              state,
            },
            window.location.origin
          );
          console.log('[DiscordCallback] posted success message to opener');
          window.close();
        } else {
          console.log('[DiscordCallback] no opener found, closing window');
          window.close();
        }
      } catch (error) {
        console.error('[DiscordCallback] exception in callback handler', error);
        this.handleAuthError('Failed to complete authentication');
      }
    });
  }

  private handleAuthError(error: string): void {
    localStorage.setItem(
      DISCORD_AUTH_RESULT_KEY,
      JSON.stringify({
        type: DISCORD_AUTH_ERROR,
        error,
      })
    );
    console.error('[DiscordCallback] auth error', { error });

    if (window.opener) {
      window.opener.postMessage(
        {
          type: DISCORD_AUTH_ERROR,
          error: error,
        },
        window.location.origin
      );
      console.log('[DiscordCallback] posted error message to opener');
      window.close();
    } else {
      console.log('[DiscordCallback] no opener found on error, closing window');
      window.close();
    }
  }
}
