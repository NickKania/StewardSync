import { Injectable, inject, signal, OnDestroy } from '@angular/core';
import { loadRuntimeConfig, type RuntimeConfig } from './runtime-config-loader';

@Injectable({ providedIn: 'root' })
export class RuntimeConfigService implements OnDestroy {
  private readonly config = signal<RuntimeConfig | null>(null);
  private readonly loading = signal(false);
  private readonly error = signal<Error | null>(null);
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      const loadedConfig = await loadRuntimeConfig();
      this.config.set(loadedConfig);
    } catch (err) {
      this.error.set(err as Error);
      console.error('Failed to load runtime config:', err);
    } finally {
      this.loading.set(false);
      this.initialized = true;
    }
  }

  get config$() {
    return this.config.asReadonly();
  }

  get loading$() {
    return this.loading.asReadonly();
  }

  get error$() {
    return this.error.asReadonly();
  }

  get convexUrl(): string | undefined {
    return this.config()?.convexUrl;
  }

  get enableDevLogin(): boolean | undefined {
    return this.config()?.enableDevLogin;
  }

  get discordClientId(): string | undefined {
    return this.config()?.discordClientId;
  }

  get discordClientSecret(): string | undefined {
    return this.config()?.discordClientSecret;
  }

  ngOnDestroy(): void {
    this.initialized = false;
  }
}
