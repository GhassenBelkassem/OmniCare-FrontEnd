import { HttpErrorResponse } from '@angular/common/http';

import { isAmbiguousMutationOutcome, normalizeHttpError } from '../../../core/http/app-http-error';
import type { ProblemDetail } from './scheduled-care.models';

export type ScheduledCareProblemCode =
  | 'VALIDATION_FAILED'
  | 'NOT_FOUND'
  | 'VERSION_CONFLICT'
  | 'REQUEST_STATE_CONFLICT'
  | 'REQUEST_EXPIRED'
  | 'SLOT_NO_LONGER_AVAILABLE'
  | 'BOOKING_CONTEXT_NOT_AVAILABLE'
  | 'ACTION_NOT_ALLOWED'
  | 'IDEMPOTENCY_CONFLICT';

const SAFE_MESSAGES: Readonly<Record<ScheduledCareProblemCode, string>> = {
  VALIDATION_FAILED: 'Certaines informations sont invalides. Vérifiez votre sélection.',
  NOT_FOUND: 'Cette ressource n’est plus disponible.',
  VERSION_CONFLICT: 'Cette ressource a été modifiée. Les données ont été actualisées.',
  REQUEST_STATE_CONFLICT: 'Cette demande a déjà changé d’état. Les données ont été actualisées.',
  REQUEST_EXPIRED: 'Le délai de réponse de cette demande est dépassé.',
  SLOT_NO_LONGER_AVAILABLE: 'Ce créneau n’est plus disponible. Choisissez-en un autre.',
  BOOKING_CONTEXT_NOT_AVAILABLE: 'Le contexte de réservation n’est plus disponible.',
  ACTION_NOT_ALLOWED: 'Cette action n’est plus autorisée.',
  IDEMPOTENCY_CONFLICT: 'Cette action ne correspond plus à la commande initiale.',
};

export function scheduledCareProblem(error: unknown): ProblemDetail | null {
  if (!(error instanceof HttpErrorResponse) || !isRecord(error.error)) return null;
  return error.error as ProblemDetail;
}

export function scheduledCareProblemCode(error: unknown): ScheduledCareProblemCode | null {
  const code = normalizeHttpError(error).code;
  return typeof code === 'string' && code in SAFE_MESSAGES
    ? (code as ScheduledCareProblemCode)
    : null;
}

export function scheduledCareErrorMessage(
  error: unknown,
  fallback = 'L’action n’a pas pu être terminée.',
): string {
  const code = scheduledCareProblemCode(error);
  if (code !== null) return SAFE_MESSAGES[code];
  if (error instanceof HttpErrorResponse && error.status === 0) {
    return 'Résultat incertain en raison de la connexion. Vérification en cours…';
  }
  return fallback;
}

export function isUnknownMutationOutcome(error: unknown): boolean {
  return isAmbiguousMutationOutcome(error);
}

export function requestMustRefresh(error: unknown): boolean {
  const code = scheduledCareProblemCode(error);
  return (
    code === 'VERSION_CONFLICT' ||
    code === 'REQUEST_STATE_CONFLICT' ||
    code === 'REQUEST_EXPIRED' ||
    code === 'SLOT_NO_LONGER_AVAILABLE'
  );
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object';
}
