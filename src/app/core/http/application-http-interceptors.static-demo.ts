import type { HttpInterceptorFn } from '@angular/common/http';

import { staticDemoApiInterceptor } from '../demo/static-demo-api.interceptor';

/** Offline HTTP pipeline used only by the compile-time static-demo build. */
export const APPLICATION_HTTP_INTERCEPTORS: readonly HttpInterceptorFn[] = [
  staticDemoApiInterceptor,
];
