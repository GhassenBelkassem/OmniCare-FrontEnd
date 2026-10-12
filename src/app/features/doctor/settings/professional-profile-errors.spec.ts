import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';

import {
  isAuthenticationError,
  isConflict,
  isNetworkError,
  isValidationError,
  problemCode,
} from './professional-profile-errors';

describe('professional-profile-errors', () => {
  it('recognizes RFC 9457 conflict and validation codes without displaying detail', () => {
    const conflict = response(409, { code: 'RESOURCE_STATE_CONFLICT', detail: 'internal text' });
    const validation = response(400, { code: 'VALIDATION_FAILED', detail: 'internal text' });

    expect(isConflict(conflict)).toBe(true);
    expect(problemCode(conflict)).toBe('RESOURCE_STATE_CONFLICT');
    expect(isValidationError(validation)).toBe(true);
  });

  it('recognizes authentication and network failures', () => {
    expect(isAuthenticationError(response(401, {}))).toBe(true);
    expect(isAuthenticationError(response(403, {}))).toBe(true);
    expect(isNetworkError(response(0, null))).toBe(true);
  });
});

function response(status: number, error: unknown): HttpErrorResponse {
  return new HttpErrorResponse({ status, error, statusText: 'Test error', url: '/api/v1/test' });
}
