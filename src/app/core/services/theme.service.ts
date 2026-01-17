import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'stewardsync_theme';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private _isDark = signal(false);

  readonly isDark = this._isDark.asReadonly();

  initialize(): void {
    const storedTheme = this.getStoredTheme();
    const prefersDark = this.getPrefersDark();
    const shouldUseDark = storedTheme ? storedTheme === 'dark' : prefersDark;

    this.setTheme(shouldUseDark, false);
  }

  toggleTheme(): void {
    this.setTheme(!this._isDark(), true);
  }

  private setTheme(isDark: boolean, persist: boolean): void {
    this._isDark.set(isDark);
    this.applyTheme(isDark);

    if (persist) {
      localStorage.setItem(STORAGE_KEY, isDark ? 'dark' : 'light');
    }
  }

  private applyTheme(isDark: boolean): void {
    if (typeof document === 'undefined') {
      return;
    }

    document.documentElement.classList.toggle('dark', isDark);
  }

  private getStoredTheme(): 'light' | 'dark' | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }

    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'dark' || stored === 'light' ? stored : null;
  }

  private getPrefersDark(): boolean {
    if (typeof window === 'undefined' || typeof window.matchMedia === 'undefined') {
      return false;
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
}
