import { HttpErrorResponse } from '@angular/common/http';

import { appointmentStatusLabel } from '../../../../shared/ui/appointment-status';
import type { ConsultationFollowUpOutcome } from '../../active-consultation.models';

/**
 * G-1 D4: the follow-up appointment's wording. Every date and time is shown in Tunis time
 * (« jeu. 13 nov. à 10:20 »), whatever the browser's time zone.
 */
const TIMEZONE = 'Africa/Tunis';

/** « jeu. 13 nov. à 10:20 » */
export function followUpWhen(start: string): string {
  const date = new Date(start);
  if (Number.isNaN(date.getTime())) return '';
  const day = new Intl.DateTimeFormat('fr-FR', { timeZone: TIMEZONE, weekday: 'short', day: 'numeric', month: 'short' }).format(date);
  const time = new Intl.DateTimeFormat('fr-FR', { timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
  return `${day} à ${time}`;
}

/** « jeu. 13 nov. à 10:20 · Cabinet El Menzah » (the cabinet only when known). */
export function followUpSlotLabel(start: string, locationName: string | null | undefined): string {
  return [followUpWhen(start), locationName?.trim()].filter(Boolean).join(' · ');
}

/** The note's follow-up date (YYYY-MM-DD) for a slot, as the day in Tunis. */
export function followUpDateKey(start: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date(start));
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value['year']}-${value['month']}-${value['day']}`;
}

/** Success-state line, or null when there is nothing to say (no follow-up, or SLOT_TAKEN shown as an alert). */
export function followUpOutcomeLine(outcome: ConsultationFollowUpOutcome | null | undefined): string | null {
  if (!outcome || outcome.status === 'SLOT_TAKEN') return null;
  const suffix = outcome.status === 'PROPOSED'
    ? 'proposé au patient'
    : outcome.status === 'PENDING'
      ? 'en cours de planification…'
      // Any other appointment status: the shared mapping's label (« confirmé », « annulé », …).
      : appointmentStatusLabel(outcome.status).toLocaleLowerCase('fr-FR');
  return `Rendez-vous de contrôle : ${followUpWhen(outcome.start)} · ${suffix}`;
}

/** SLOT_TAKEN alert. */
export function followUpSlotTakenMessage(outcome: ConsultationFollowUpOutcome): string {
  return `Le créneau du ${followUpWhen(outcome.start)} n’était plus libre : choisissez-en un autre pour le contrôle.`;
}

const SLOT_FIELD_MESSAGES: Readonly<Record<string, string>> = {
  'followUpSlot.start': 'Ce créneau ne peut pas être choisi pour le contrôle. Choisissez-en un autre.',
  'followUpSlot.practiceLocationId': 'Ce cabinet n’est plus disponible. Choisissez un autre cabinet.',
};

/** French message for a failed save of the chosen slot (2a field errors first). */
export function followUpSlotSaveError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    const body = error.error as { fieldErrorCodes?: Record<string, string>; fieldErrors?: Record<string, string> } | null;
    const paths = Object.keys(body?.fieldErrorCodes ?? body?.fieldErrors ?? {});
    for (const path of paths) {
      const message = SLOT_FIELD_MESSAGES[path];
      if (message) return message;
    }
    const code = (error.error as { errorCode?: string } | null)?.errorCode;
    if (code === 'FOLLOW_UP_SLOT_VERSION_CONFLICT') {
      return 'Le créneau de suivi a été modifié entre-temps. Rechargez la consultation puis réessayez.';
    }
    if (error.status === 409) return 'La consultation n’est plus modifiable : le créneau n’a pas été enregistré.';
  }
  return 'Le créneau n’a pas pu être enregistré. Réessayez.';
}
