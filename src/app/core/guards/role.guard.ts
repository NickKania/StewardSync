import { inject } from "@angular/core";
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  UrlTree,
} from "@angular/router";
import { AuthService } from "@core/services/auth.service";
import { RoleName, RouteWithFallbackData } from "@core/models";

export const roleGuard: CanActivateFn = async (route: ActivatedRouteSnapshot) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const requiredRoles = route.data["roles"] as readonly RoleName[] | undefined;
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

  await authService.whenInitialized();
  return authService.hasRole(...requiredRoles) || getFallback();
};
