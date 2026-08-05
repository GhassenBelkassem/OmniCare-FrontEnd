import { InjectionToken } from '@angular/core';

export interface RuntimeConfig {
  readonly apiBaseUrl: string;
}

const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = Object.freeze({
  apiBaseUrl: '/api/v1',
});

export const RUNTIME_CONFIG = new InjectionToken<RuntimeConfig>('OMNICARE_RUNTIME_CONFIG', {
  providedIn: 'root',
  factory: () => readRuntimeConfig(globalThis),
});

export function readRuntimeConfig(source: typeof globalThis): RuntimeConfig {
  const candidate = Reflect.get(source, '__OMNICARE_CONFIG__');
  if (!isRecord(candidate)) {
    return DEFAULT_RUNTIME_CONFIG;
  }

  return Object.freeze({
    apiBaseUrl: normalizeApiBaseUrl(candidate['apiBaseUrl']),
  });
}

function normalizeApiBaseUrl(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return DEFAULT_RUNTIME_CONFIG.apiBaseUrl;
  }

  const normalized = value.trim().replace(/\/+$/, '');
  if (normalized.startsWith('/')) {
    return normalized;
  }

  try {
    const url = new URL(normalized);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return normalized;
    }
  } catch {
    // Fall through to the safe same-origin default.
  }

  return DEFAULT_RUNTIME_CONFIG.apiBaseUrl;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
