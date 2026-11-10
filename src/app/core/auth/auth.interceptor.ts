import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';

import { AuthTokenStore } from './auth-token.store';
import { AuthService } from './auth.service';
import { SessionTerminationService } from './session-termination.service';

const ANONYMOUS_AUTH_SUFFIXES = [
  '/auth/login',
  '/auth/refresh',
  '/auth/google/initiate',
  '/auth/google/complete',
  '/auth/login/phone/initiate',
  '/auth/login/phone/verify',
  '/auth/invitations/validate',
  '/auth/invitations/accept',
] as const;

function isAnonymousAuthEndpoint(url: string): boolean {
  const path = url.split('?')[0];
  return ANONYMOUS_AUTH_SUFFIXES.some((suffix) => path.endsWith(suffix));
}

function isAuthLifecycleEndpoint(url: string): boolean {
  const path = url.split('?')[0];
  return (
    isAnonymousAuthEndpoint(path) ||
    path.endsWith('/auth/logout') ||
    path.endsWith('/auth/logout-all')
  );
}

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const tokens = inject(AuthTokenStore);
  const auth = inject(AuthService);
  const termination = inject(SessionTerminationService);
  const token = tokens.accessToken();
  const anonymousAuthRequest = isAnonymousAuthEndpoint(request.urlWithParams);
  const isAuthLifecycleRequest = isAuthLifecycleEndpoint(request.urlWithParams);
  const attachAuthorization = token !== null && !anonymousAuthRequest;
  const authenticatedRequest = attachAuthorization
    ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : request;
  return next(authenticatedRequest).pipe(
    catchError((error: unknown) => {
      if (
        !(error instanceof HttpErrorResponse) ||
        error.status !== 401 ||
        token === null ||
        isAuthLifecycleRequest
      ) {
        return throwError(() => error);
      }

      // The backend authentication filter returns this concrete 401 before controller dispatch.
      // Transport failures and gateway timeouts never enter this branch, so mutations are not
      // blindly replayed when their server-side outcome is ambiguous.
      return auth.refreshSession().pipe(
        catchError(() => {
          void termination.terminate('REFRESH_REJECTED');
          return throwError(() => error);
        }),
        switchMap(() => {
          const refreshedToken = tokens.accessToken();
          if (refreshedToken === null) return throwError(() => error);
          return next(
            request.clone({ setHeaders: { Authorization: `Bearer ${refreshedToken}` } }),
          ).pipe(
            catchError((retryError: unknown) => {
              if (retryError instanceof HttpErrorResponse && retryError.status === 401) {
                void termination.terminate('SESSION_INVALID');
              }
              return throwError(() => retryError);
            }),
          );
        }),
      );
    }),
  );
};
