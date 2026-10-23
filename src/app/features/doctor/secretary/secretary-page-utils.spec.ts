import { HttpErrorResponse } from '@angular/common/http';

import { SECRETARY_PERMISSIONS } from './secretary-api.models';
import {
  canEnd,
  canResendInvitation,
  canSuspend,
  membershipStatusTone,
  permissionLabels,
  secretaryErrorMessage,
  secretaryFieldError,
} from './secretary-page-utils';

function httpError(body: unknown, status = 400): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: body });
}

describe('secretaryErrorMessage', () => {
  it('maps the contract error codes to specific guidance', () => {
    expect(secretaryErrorMessage(httpError({ code: 'secretary-permission-unknown' }))).toContain(
      'not recognised',
    );
    expect(
      secretaryErrorMessage(httpError({ code: 'secretary-permission-empty' }, 422)),
    ).toBe('Grant at least one permission.');
    expect(
      secretaryErrorMessage(httpError({ code: 'secretary-invitation-cooldown' }, 409)),
    ).toContain('recently');
    expect(
      secretaryErrorMessage(httpError({ code: 'secretary-cross-doctor-forbidden' }, 404)),
    ).toContain('another doctor');
  });

  it('never reveals that a clinical permission exists by name', () => {
    expect(
      secretaryErrorMessage(httpError({ code: 'secretary-clinical-access-forbidden' }, 403)),
    ).toBe('Clinical access cannot be delegated to a secretary.');
  });

  it('never surfaces raw backend copy for an unmapped code', () => {
    expect(
      secretaryErrorMessage(httpError({ code: 'some-future-code', message: 'Backend copy.' })),
    ).toBe('The request could not be completed. Please try again.');
  });

  it('never surfaces raw backend copy from a shared, non-delegation endpoint', () => {
    // The agenda calls the shared appointment endpoints, whose codes this mapper
    // does not know. Their server text must not reach the secretary.
    expect(
      secretaryErrorMessage(httpError({ code: 'APPOINTMENT_DATE_INVALID', message: 'bad range' })),
    ).toBe('The request could not be completed. Please try again.');
  });

  it('falls back to generic copy when nothing usable is returned', () => {
    expect(secretaryErrorMessage(httpError({}))).toBe(
      'The request could not be completed. Please try again.',
    );
    expect(secretaryErrorMessage(new Error('offline'))).toBe('offline');
  });

  it('treats the reserved, unreachable codes as generic', () => {
    expect(secretaryErrorMessage(httpError({ code: 'secretary-already-delegated' }, 409))).toBe(
      'The request could not be completed. Please try again.',
    );
    expect(secretaryErrorMessage(httpError({ code: 'secretary-version-conflict' }, 409))).toBe(
      'The request could not be completed. Please try again.',
    );
  });
});

describe('secretaryFieldError', () => {
  it('maps a field-scoped message to translated copy', () => {
    expect(
      secretaryFieldError(
        httpError({ code: 'secretary-request-invalid', fieldErrors: { email: 'Already used.' } }),
        'email',
      ),
    ).toBe('Enter a valid email address.');
  });

  it('falls back to generic copy for an unmapped field rather than the raw message', () => {
    expect(
      secretaryFieldError(
        httpError({ code: 'secretary-request-invalid', fieldErrors: { nickname: 'Raw server text.' } }),
        'nickname',
      ),
    ).toBe('The request could not be completed. Please try again.');
  });

  it('returns null when the field is absent or the error is not HTTP', () => {
    expect(secretaryFieldError(httpError({}), 'email')).toBeNull();
    expect(secretaryFieldError(new Error('boom'), 'email')).toBeNull();
  });
});

describe('lifecycle affordances', () => {
  it('only resends while an invitation is open', () => {
    expect(canResendInvitation('INVITED')).toBe(true);
    expect(canResendInvitation('ACTIVE')).toBe(false);
    expect(canResendInvitation('SUSPENDED')).toBe(false);
    expect(canResendInvitation('ENDED')).toBe(false);
  });

  it('only suspends an active delegation', () => {
    expect(canSuspend('ACTIVE')).toBe(true);
    expect(canSuspend('INVITED')).toBe(false);
    expect(canSuspend('SUSPENDED')).toBe(false);
    expect(canSuspend('ENDED')).toBe(false);
  });

  it('can end anything that has not already ended', () => {
    expect(canEnd('INVITED')).toBe(true);
    expect(canEnd('ACTIVE')).toBe(true);
    expect(canEnd('SUSPENDED')).toBe(true);
    expect(canEnd('ENDED')).toBe(false);
  });
});

describe('presentation helpers', () => {
  it('gives every membership status a distinct visible tone', () => {
    const tones = (['INVITED', 'ACTIVE', 'SUSPENDED', 'ENDED'] as const).map(
      membershipStatusTone,
    );
    expect(new Set(tones).size).toBe(4);
  });

  it('summarises permissions and states when none are granted', () => {
    expect(permissionLabels(['VIEW_AGENDA', 'CANCEL_APPOINTMENT'])).toBe(
      'View agenda, Cancel appointments',
    );
    expect(permissionLabels([])).toBe('None');
  });
});

describe('the delegable permission set', () => {
  it('contains exactly the six delegable capabilities', () => {
    expect(SECRETARY_PERMISSIONS).toEqual([
      'VIEW_AGENDA',
      'MANAGE_AGENDA',
      'CREATE_APPOINTMENT',
      'RESCHEDULE_APPOINTMENT',
      'CANCEL_APPOINTMENT',
      'VIEW_PATIENT_CONTACT',
    ]);
  });
});