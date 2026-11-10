import { HttpErrorResponse } from '@angular/common/http';

import {
  isUnknownMutationOutcome,
  scheduledCareErrorMessage,
  scheduledCareProblemCode,
} from './scheduled-care-errors';

describe('scheduled-care ProblemDetail handling', () => {
  it('maps known RFC 9457 codes without exposing raw detail', () => {
    const error = new HttpErrorResponse({
      status: 409,
      error: {
        errorCode: 'VERSION_CONFLICT',
        detail: 'constraint booking_request_version_idx Hibernate SQL',
      },
    });
    expect(scheduledCareProblemCode(error)).toBe('VERSION_CONFLICT');
    expect(scheduledCareErrorMessage(error)).toContain('modifiée');
    expect(scheduledCareErrorMessage(error)).not.toContain('Hibernate');
  });

  it('classifies transport loss as an unknown mutation outcome', () => {
    expect(isUnknownMutationOutcome(new HttpErrorResponse({ status: 0 }))).toBe(true);
    expect(isUnknownMutationOutcome(new HttpErrorResponse({ status: 408 }))).toBe(true);
    expect(isUnknownMutationOutcome(new HttpErrorResponse({ status: 504 }))).toBe(true);
    expect(isUnknownMutationOutcome(new HttpErrorResponse({ status: 400 }))).toBe(false);
  });
});
