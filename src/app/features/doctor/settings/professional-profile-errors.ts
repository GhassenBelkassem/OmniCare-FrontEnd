import { HttpErrorResponse } from '@angular/common/http';

import { ApiProblemDetails } from './professional-profile-api.models';

export const RE_AUTHENTICATE_MESSAGE =
  'Votre session n’est plus valide. Reconnectez-vous pour continuer.';
export const STALE_PROFILE_MESSAGE = 'Votre profil a été modifié depuis son ouverture.';
export const STALE_QUALIFICATION_MESSAGE = 'Cette information a été modifiée depuis son ouverture.';

export function problemDetails(error: unknown): ApiProblemDetails | null {
  if (
    !(error instanceof HttpErrorResponse) ||
    error.error === null ||
    typeof error.error !== 'object'
  ) {
    return null;
  }
  return error.error as ApiProblemDetails;
}

export function problemCode(error: unknown): string | null {
  return problemDetails(error)?.code ?? null;
}

export function isAuthenticationError(error: unknown): boolean {
  return error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403);
}

export function isConflict(error: unknown): boolean {
  return (
    error instanceof HttpErrorResponse &&
    error.status === 409 &&
    problemCode(error) === 'RESOURCE_STATE_CONFLICT'
  );
}

export function isValidationError(error: unknown): boolean {
  if (!(error instanceof HttpErrorResponse) || error.status !== 400) return false;
  const code = problemCode(error);
  return (
    code === null ||
    code === 'VALIDATION_ERROR' ||
    code === 'VALIDATION_FAILED' ||
    code === 'INVALID_INPUT'
  );
}

export function isNetworkError(error: unknown): boolean {
  return error instanceof HttpErrorResponse && error.status === 0;
}
