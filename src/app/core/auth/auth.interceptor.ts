import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';

import { AuthTokenStore } from './auth-token.store';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const tokens = inject(AuthTokenStore);
  const auth = inject(AuthService);
  const token = tokens.accessToken();
  const isAuthLifecycleRequest = request.url.includes('/auth/login')
    || request.url.includes('/auth/refresh')
    || request.url.includes('/auth/logout');
  const sendsRefreshCredential = request.url.includes('/auth/login')
    || request.url.includes('/auth/refresh');
  const authenticatedRequest = token !== null && !sendsRefreshCredential
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
