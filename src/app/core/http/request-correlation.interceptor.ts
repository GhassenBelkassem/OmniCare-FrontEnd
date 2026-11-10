import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { RUNTIME_CONFIG } from '../config/runtime-config';

const REQUEST_ID_HEADER = 'X-Request-Id';

/** Adds one opaque UUID to each backend API request. It contains no user or clinical data. */
export const requestCorrelationInterceptor: HttpInterceptorFn = (request, next) => {
  const apiBaseUrl = inject(RUNTIME_CONFIG).apiBaseUrl.replace(/\/$/, '');
  if (!isApiRequest(request.url, apiBaseUrl)) return next(request);

  const current = request.headers.get(REQUEST_ID_HEADER);
  const requestId = isUuid(current) ? current : createUuid();
  return next(request.clone({ setHeaders: { [REQUEST_ID_HEADER]: requestId } }));
};

function isApiRequest(url: string, apiBaseUrl: string): boolean {
  return url === apiBaseUrl || url.startsWith(`${apiBaseUrl}/`);
}

function isUuid(value: string | null): value is string {
  return value !== null && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function createUuid(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`;
}
