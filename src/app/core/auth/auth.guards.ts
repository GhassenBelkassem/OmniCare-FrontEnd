import { inject } from '@angular/core';
import { CanActivateFn, CanMatchFn, RedirectFunction, Router } from '@angular/router';

import { DashboardRole, dashboardRouteFor } from './auth.models';
import { AuthTokenStore } from './auth-token.store';
import { AuthBootstrapService } from './auth-bootstrap.service';

export const authenticatedGuard: CanActivateFn = () => {
  const tokens = inject(AuthTokenStore);
  const bootstrap = inject(AuthBootstrapService);
  const router = inject(Router);
  return bootstrap.whenResolved().then(() => {
    if (tokens.authState() === 'PASSWORD_CHANGE_REQUIRED') {
      return router.createUrlTree(['/password-change']);
    }
    return tokens.authenticated() ? true : router.createUrlTree(['/login']);
  });
};

/**
 * Accepts any one of `roles`. A variadic signature keeps the single-role call
 * sites (`roleGuard('DOCTOR')`) unchanged while letting shared shells admit a
 * small, explicit set of roles — e.g. the doctor's workspace admits both a
 * DOCTOR and a SECRETARY, and destination routes narrow it back down.
 */
export function roleGuard(...roles: readonly DashboardRole[]): CanActivateFn {
  return () => {
    const tokens = inject(AuthTokenStore);
    const bootstrap = inject(AuthBootstrapService);
    const router = inject(Router);
    return bootstrap.whenResolved().then(() => {
      if (tokens.authState() === 'PASSWORD_CHANGE_REQUIRED') {
        return router.createUrlTree(['/password-change']);
      }
      if (!tokens.authenticated()) return router.createUrlTree(['/login']);
      const role = tokens.user()?.role;
      return role !== undefined && roles.includes(role)
        ? true
        : router.createUrlTree(['/forbidden']);
    });
  };
}

/** Stops an authenticated user from constructing visible Login content. */
export const anonymousOnlyGuard: CanMatchFn = () => {
  const tokens = inject(AuthTokenStore);
  const bootstrap = inject(AuthBootstrapService);
  const router = inject(Router);
  return bootstrap
    .whenResolved()
    .then(() =>
      tokens.authState() === 'PASSWORD_CHANGE_REQUIRED'
        ? router.createUrlTree(['/password-change'])
        : tokens.authenticated() && tokens.user() !== null
          ? router.createUrlTree([dashboardRouteFor(tokens.user()!.role)])
          : true,
    );
};

export const passwordChangeRequiredGuard: CanActivateFn = () => {
  const tokens = inject(AuthTokenStore);
  const bootstrap = inject(AuthBootstrapService);
  const router = inject(Router);
  return bootstrap.whenResolved().then(() => {
    if (tokens.authState() === 'PASSWORD_CHANGE_REQUIRED') return true;
    const user = tokens.user();
    return tokens.authenticated() && user !== null
      ? router.createUrlTree([dashboardRouteFor(user.role)])
      : router.createUrlTree(['/login']);
  });
};

export const landingRedirect: RedirectFunction = () => {
  const tokens = inject(AuthTokenStore);
  if (tokens.authState() === 'PASSWORD_CHANGE_REQUIRED') return '/password-change';
  const user = tokens.user();
  return user === null ? '/login' : dashboardRouteFor(user.role);
};
