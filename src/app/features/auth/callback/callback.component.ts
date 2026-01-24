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
      const state = params['state'];

      if (!code) {
        this.handleAuthError('No authorization code received');
        return;
      }

      try {
        if (window.opener) {
          window.opener.postMessage(
            {
              type: 'discord-auth-success',
              code,
              state,
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
