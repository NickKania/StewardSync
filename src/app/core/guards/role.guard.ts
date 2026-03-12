import { inject } from "@angular/core";
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  UrlTree,
} from "@angular/router";
import { AuthService } from "@core/services/auth.service";
import { RoleName, RouteWithFallbackData } from "@core/models";

export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const requiredRoles = route.data["roles"] as RoleName[] | undefined;
  const { fallbackCommands } = route.data as RouteWithFallbackData;

  const getFallback = (): UrlTree => {
    if (fallbackCommands?.length) {
      return router.createUrlTree([...fallbackCommands]);
    }

    return router.createUrlTree(["/"]);
  };

  if (!requiredRoles || requiredRoles.length === 0) {
    return true;
  }

  if (authService.isLoading()) {
    return new Promise((resolve) => {
      const checkRole = () => {
        if (!authService.isLoading()) {
          if (authService.hasRole(...requiredRoles)) {
            resolve(true);
          } else {
            resolve(getFallback());
          }
        } else {
          setTimeout(checkRole, 50);
        }
      };
      checkRole();
    });
  }

  if (authService.hasRole(...requiredRoles)) {
    return true;
  }

  return getFallback();
};
