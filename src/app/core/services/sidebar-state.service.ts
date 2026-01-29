import { Injectable, signal, computed } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class SidebarStateService {
  readonly isCollapsed = signal<boolean>(true);
  readonly isExportMode = signal<boolean>(false);
  readonly isMobileOpen = signal<boolean>(false);

  readonly isEffectivelyCollapsed = computed(() =>
    this.isCollapsed() || this.isExportMode()
  );

  constructor() {
    // Load collapsed state from localStorage on initialization
    const savedState = localStorage.getItem('stewardsync:sidebar-collapsed');
    if (savedState !== null) {
      this.isCollapsed.set(savedState === 'true');
    } else {
      // Default to collapsed if no saved state
      this.isCollapsed.set(true);
    }
  }

  toggleDesktop(): void {
    const newState = !this.isCollapsed();
    this.isCollapsed.set(newState);
    localStorage.setItem('stewardsync:sidebar-collapsed', String(newState));
  }

  toggleMobile(): void {
    this.isMobileOpen.update(state => !state);
  }

  closeMobile(): void {
    this.isMobileOpen.set(false);
  }

  setExportMode(value: boolean): void {
    this.isExportMode.set(value);
  }
}
