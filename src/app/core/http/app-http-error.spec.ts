import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';

import { normalizeHttpError } from './app-http-error';

describe('normalizeHttpError', () => {
  it.each([
    [400, 'VALIDATION_ERROR'],
    [403, 'ACCESS_DENIED'],
    [404, 'PATIENT_NOT_FOUND'],
    [409, 'VERSION_CONFLICT'],
    [410, 'INVITATION_EXPIRED'],
    [422, 'CONFIRMATION_REQUIRED'],
  ])('preserves the domain code for HTTP %s', (status, code) => {
    const normalized = normalizeHttpError(response(status, { errorCode: code, detail: 'Safe detail.' }));
    expect(normalized.status).toBe(status);
    expect(normalized.code).toBe(code);
    expect(normalized.message).toBe('Safe detail.');
  });

  it('supports legacy codes, bounded field errors, Retry-After, and a server request ID', () => {
    const requestId = 'd4e9d84b-7b6e-4ea9-80d8-c997c7ffca73';
    const normalized = normalizeHttpError(response(429, {
      code: 'TOO_MANY_REQUESTS',
      message: 'Wait before retrying.',
      fieldErrors: { email: 'Invalid address.', ignored: 42 },
    }, { 'Retry-After': '60', 'X-Request-Id': requestId }));

    expect(normalized.code).toBe('TOO_MANY_REQUESTS');
    expect(normalized.fieldErrors).toEqual({ email: 'Invalid address.' });
    expect(normalized.retryAfterSeconds).toBe(60);
    expect(normalized.requestId).toBe(requestId);
  });

  it.each([500, 503])('uses a safe message for HTTP %s without retaining a PHI response body', (status) => {
    const normalized = normalizeHttpError(response(status, {
      message: 'SQL failed for patient Nadia; diagnosis HIV; email nadia@example.test',
      stackTrace: 'internal stack',
      requestBody: { medication: 'secret' },
      requestId: '901f22a4-6407-4744-a763-162a9d035955',
    }));

    expect(normalized.message).not.toContain('Nadia');
    expect(JSON.stringify(normalized)).not.toContain('diagnosis');
    expect(JSON.stringify(normalized)).not.toContain('medication');
    expect(normalized.requestId).toBe('901f22a4-6407-4744-a763-162a9d035955');
  });

  it('marks only transport, request timeout, and gateway timeout outcomes as ambiguous', () => {
    expect(normalizeHttpError(response(0, null)).ambiguousMutationOutcome).toBe(true);
    expect(normalizeHttpError(response(408, null)).ambiguousMutationOutcome).toBe(true);
    expect(normalizeHttpError(response(504, null)).ambiguousMutationOutcome).toBe(true);
    expect(normalizeHttpError(response(503, null)).ambiguousMutationOutcome).toBe(false);
    expect(normalizeHttpError(response(409, null)).ambiguousMutationOutcome).toBe(false);
  });
});

function response(status: number, error: unknown, headers: Record<string, string> = {}): HttpErrorResponse {
  return new HttpErrorResponse({ status, error, headers: new HttpHeaders(headers) });
}
