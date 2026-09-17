import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';

import { AuthTokenStore } from './auth-token.store';
import { AuthService } from './auth.service';

const ANONYMOUS_AUTH_SUFFIXES = [
  '/auth/login',
  '/auth/login/phone/initiate',
  '/auth/login/phone/verify',
  '/auth/refresh',
  '/auth/signup/phone/initiate',
  '/auth/signup/phone/verify',
  '/auth/signup/complete',
  '/auth/google/initiate',
  '/auth/google/phone/initiate',
  '/auth/google/phone/verify',
  '/auth/google/complete',
] as const;

function isAnonymousAuthEndpoint(url: string): boolean {
  const path = url.split('?')[0];
  return ANONYMOUS_AUTH_SUFFIXES.some((suffix) => path.endsWith(suffix));
}

function isAuthLifecycleEndpoint(url: string): boolean {
  const path = url.split('?')[0];
  return isAnonymousAuthEndpoint(path) || path.endsWith('/auth/logout');
}

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const tokens = inject(AuthTokenStore);
  const auth = inject(AuthService);
  const token = tokens.accessToken();
  const anonymousAuthRequest = isAnonymousAuthEndpoint(request.urlWithParams);
  const isAuthLifecycleRequest = isAuthLifecycleEndpoint(request.urlWithParams);
  const attachAuthorization = token !== null && !anonymousAuthRequest;
  const authenticatedRequest = attachAuthorization
    ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : request;
  return next(authenticatedRequest).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401 || token === null || isAuthLifecycleRequest) {
        return throwError(() => error);
      }

      return auth.refreshSession().pipe(
        switchMap(() => {
          const refreshedToken = tokens.accessToken();
          if (refreshedToken === null) return throwError(() => error);
          return next(request.clone({ setHeaders: { Authorization: `Bearer ${refreshedToken}` } }));
        }),
        catchError(() => {
          tokens.clear();
          return throwError(() => error);
        }),
      );
    }),
  );
};
