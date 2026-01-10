import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { RoleName } from '@core/models';

export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const requiredRoles = route.data['roles'] as RoleName[] | undefined;

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
            router.navigate(['/']);
            resolve(false);
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

  router.navigate(['/']);
  return false;
};
