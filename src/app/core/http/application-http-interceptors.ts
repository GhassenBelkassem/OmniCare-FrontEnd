import type { HttpInterceptorFn } from '@angular/common/http';

import { authInterceptor } from '../auth/auth.interceptor';
import { requestCorrelationInterceptor } from './request-correlation.interceptor';

/** Production HTTP pipeline. Replaced as a composition boundary for static-demo builds. */
export const APPLICATION_HTTP_INTERCEPTORS: readonly HttpInterceptorFn[] = [
  // Correlation must precede auth so the one permitted 401 replay retains the original ID.
  requestCorrelationInterceptor,
  authInterceptor,
];
