import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';

export interface AppHttpError {
  readonly status: number;
  readonly code: string | null;
  readonly title: string | null;
  readonly message: string;
  readonly fieldErrors: Readonly<Record<string, string>>;
  readonly retryAfterSeconds: number | null;
  readonly requestId: string | null;
  readonly ambiguousMutationOutcome: boolean;
}

const SAFE_DEFAULT_MESSAGES: Readonly<Record<number, string>> = {
  0: 'The service could not be reached. Check your connection and try again.',
  400: 'The request is invalid. Check the information and try again.',
  401: 'Your session is no longer valid. Sign in again.',
  403: 'You do not have permission to perform this action.',
  404: 'The requested resource could not be found.',
  409: 'The resource changed or conflicts with another operation.',
  410: 'This resource has expired and can no longer be used.',
  422: 'The request does not satisfy the required business rules.',
  429: 'Too many requests were made. Wait before trying again.',
  500: 'The service could not complete the request.',
  503: 'The service is temporarily unavailable.',
};

/**
 * Normalizes both OmniCare's legacy error envelope (`code`) and RFC ProblemDetail
 * (`errorCode`) without retaining request bodies, response bodies, headers, or URLs.
 */
export function normalizeHttpError(error: unknown): AppHttpError {
  if (!(error instanceof HttpErrorResponse)) {
    return {
      status: 0,
      code: null,
      title: null,
      message: error instanceof Error && error.message ? error.message : SAFE_DEFAULT_MESSAGES[0],
      fieldErrors: {},
      retryAfterSeconds: null,
      requestId: null,
      ambiguousMutationOutcome: error instanceof Error && error.name === 'TimeoutError',
    };
  }

  const body = isRecord(error.error) ? error.error : {};
  const status = error.status;
  const serverMessage = boundedString(body['detail']) ?? boundedString(body['message']);
  const message = status === 500 || status === 503
    ? safeDefault(status)
    : serverMessage ?? safeDefault(status);

  return {
    status,
    code: boundedCode(body['errorCode']) ?? boundedCode(body['code']),
    title: boundedString(body['title']),
    message,
    fieldErrors: safeFieldErrors(body['fieldErrors']),
    retryAfterSeconds: retryAfterSeconds(error.headers),
    requestId: requestId(error.headers.get('X-Request-Id')) ?? requestId(body['requestId']),
    ambiguousMutationOutcome: status === 0 || status === 408 || status === 504,
  };
}

export function httpErrorCode(error: unknown): string | null {
  return normalizeHttpError(error).code;
}

export function isAmbiguousMutationOutcome(error: unknown): boolean {
  return normalizeHttpError(error).ambiguousMutationOutcome;
}

function safeDefault(status: number): string {
  return SAFE_DEFAULT_MESSAGES[status] ?? 'The request could not be completed.';
}

function boundedCode(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= 100 ? value : null;
}

function boundedString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= 500 ? value : null;
}

function safeFieldErrors(value: unknown): Readonly<Record<string, string>> {
  if (!isRecord(value)) return {};
  const entries = Object.entries(value)
    .filter(([field, message]) => field.length <= 100 && typeof message === 'string' && message.length <= 500)
    .slice(0, 50) as [string, string][];
  return Object.fromEntries(entries);
}

function retryAfterSeconds(headers: HttpHeaders): number | null {
  const value = headers.get('Retry-After');
  if (value === null) return null;
  const seconds = Number(value);
  if (Number.isInteger(seconds) && seconds >= 0) return seconds;
  const deadline = Date.parse(value);
  if (Number.isNaN(deadline)) return null;
  return Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
}

function requestId(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 64) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null;
}
