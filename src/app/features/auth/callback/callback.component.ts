import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-callback',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-900 via-primary-800 to-gray-900">
      <div class="bg-white rounded-2xl shadow-2xl p-8 text-center">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
        <h2 class="text-xl font-semibold text-gray-900">Completing sign in...</h2>
      </div>
    </div>
  `
})
export class CallbackComponent implements OnInit {
  constructor(
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(async (params) => {
      const code = params['code'];

      if (!code) {
        this.handleAuthError('No authorization code received');
        return;
      }

      try {
        const tokenData = await this.exchangeCodeForToken(code);

        if (window.opener) {
          window.opener.postMessage(
            {
              type: 'discord-auth-success',
              accessToken: tokenData.access_token,
            },
            window.location.origin
          );
          window.close();
        } else {
          this.router.navigate(['/']);
        }
      } catch (error) {
        this.handleAuthError('Failed to complete authentication');
      }
    });
  }

  private async exchangeCodeForToken(code: string): Promise<any> {
    const clientId = import.meta.env['NG_APP_DISCORD_CLIENT_ID'] || '';
    const clientSecret = import.meta.env['NG_APP_DISCORD_CLIENT_SECRET'] || '';
    const redirectUri = `${window.location.origin}/auth/callback`;

    const response = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to exchange code for token');
    }

    return response.json();
  }

  private handleAuthError(error: string): void {
    if (window.opener) {
      window.opener.postMessage(
        {
          type: 'discord-auth-error',
          error: error,
        },
        window.location.origin
      );
      window.close();
    } else {
      this.router.navigate(['/login']);
    }
  }
}
