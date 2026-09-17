import { inject } from '@angular/core';
import { CanActivateFn, CanMatchFn, RedirectFunction, Router } from '@angular/router';

import { DashboardRole, dashboardRouteFor } from './auth.models';
import { AuthTokenStore } from './auth-token.store';
import { AuthBootstrapService } from './auth-bootstrap.service';

export const authenticatedGuard: CanActivateFn = () => {
  const tokens = inject(AuthTokenStore);
  const bootstrap = inject(AuthBootstrapService);
  const router = inject(Router);
  return bootstrap.whenResolved().then(() =>
    tokens.authenticated() ? true : router.createUrlTree(['/login']),
  );
};

export function roleGuard(role: DashboardRole): CanActivateFn {
  return () => {
    const tokens = inject(AuthTokenStore);
    const bootstrap = inject(AuthBootstrapService);
    const router = inject(Router);
    return bootstrap.whenResolved().then(() => {
      if (!tokens.authenticated()) return router.createUrlTree(['/login']);
      return tokens.user()?.role === role ? true : router.createUrlTree(['/forbidden']);
    });
  };
}

/** Stops an authenticated user from constructing visible Login content. */
export const anonymousOnlyGuard: CanMatchFn = () => {
  const tokens = inject(AuthTokenStore);
  const bootstrap = inject(AuthBootstrapService);
  const router = inject(Router);
  return bootstrap.whenResolved().then(() =>
    tokens.authenticated() && tokens.user() !== null
      ? router.createUrlTree([dashboardRouteFor(tokens.user()!.role)])
      : true,
  );
};

export const landingRedirect: RedirectFunction = () => {
  const user = inject(AuthTokenStore).user();
  return user === null ? '/login' : dashboardRouteFor(user.role);
};
