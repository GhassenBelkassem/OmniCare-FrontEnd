import { inject } from '@angular/core';
import { CanActivateFn, RedirectFunction, Router } from '@angular/router';

import { DashboardRole, dashboardRouteFor } from './auth.models';
import { AuthTokenStore } from './auth-token.store';

export const authenticatedGuard: CanActivateFn = () => {
  const tokens = inject(AuthTokenStore);
  return tokens.authenticated() ? true : inject(Router).createUrlTree(['/login']);
};

export function roleGuard(role: DashboardRole): CanActivateFn {
  return () => {
    const tokens = inject(AuthTokenStore);
    if (!tokens.authenticated()) return inject(Router).createUrlTree(['/login']);
    return tokens.user()?.role === role ? true : inject(Router).createUrlTree(['/forbidden']);
  };
}

export const landingRedirect: RedirectFunction = () => {
  const user = inject(AuthTokenStore).user();
  return user === null ? '/login' : dashboardRouteFor(user.role);
};
