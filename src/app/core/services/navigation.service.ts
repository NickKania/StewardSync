import { Injectable, inject } from "@angular/core";
import { Location } from "@angular/common";
import { NavigationExtras, Router } from "@angular/router";

@Injectable({
  providedIn: "root",
})
export class NavigationService {
  private readonly location = inject(Location);
  private readonly router = inject(Router);

  goBack(
    fallbackCommands: readonly unknown[],
    extras?: NavigationExtras,
  ): void {
    const navigationId = window.history.state?.navigationId;

    if (typeof navigationId === "number" && navigationId > 1) {
      this.location.back();
      return;
    }

    void this.router.navigate([...fallbackCommands], extras);
  }
}
