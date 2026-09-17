import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { AuthTokenStore } from './auth-token.store';

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

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const tokens = inject(AuthTokenStore);
  const token = tokens.accessToken();
  const attachAuthorization = token !== null && !isAnonymousAuthEndpoint(request.urlWithParams);
  const authenticatedRequest = attachAuthorization
    ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : request;
  return next(authenticatedRequest).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && token !== null) tokens.clear();
      return throwError(() => error);
    }),
  );
};
