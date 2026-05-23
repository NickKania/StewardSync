import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'stewardsync_color_mode';

@Injectable({
  providedIn: 'root'
})
export class ColorModeService {
  private _isColorBlind = signal(false);

  readonly isColorBlind = this._isColorBlind.asReadonly();

  initialize(): void {
    const stored = this.getStoredValue();
    this.setColorBlind(stored, false);
  }

  toggleColorBlindMode(): void {
    this.setColorBlind(!this._isColorBlind(), true);
  }

  private setColorBlind(isColorBlind: boolean, persist: boolean): void {
    this._isColorBlind.set(isColorBlind);
    this.applyColorBlind(isColorBlind);

    if (persist) {
      localStorage.setItem(STORAGE_KEY, isColorBlind ? 'colorBlind' : 'normal');
    }
  }

  private applyColorBlind(isColorBlind: boolean): void {
    if (typeof document === 'undefined') {
      return;
    }

    document.documentElement.classList.toggle('colorBlind', isColorBlind);
  }

  private getStoredValue(): boolean {
    if (typeof localStorage === 'undefined') {
      return false;
    }

    return localStorage.getItem(STORAGE_KEY) === 'colorBlind';
  }
}
