import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';

import type { ConsultationFollowUpOutcome } from '../../active-consultation.models';
import {
  followUpDateKey,
  followUpOutcomeLine,
  followUpSlotLabel,
  followUpSlotSaveError,
  followUpSlotTakenMessage,
  followUpWhen,
} from './follow-up';

const OUTCOME: ConsultationFollowUpOutcome = {
  status: 'CONFIRMED', appointmentId: 'appointment-9', start: '2026-11-12T09:20:00Z', end: '2026-11-12T09:40:00Z',
  locationName: 'Cabinet El Menzah', proposalExpiresAt: null,
};

describe('follow-up wording (G-1 D4)', () => {
  it('formats the slot in Tunis time: « jeu. 12 nov. à 10:20 »', () => {
    expect(followUpWhen('2026-11-12T09:20:00Z')).toBe('jeu. 12 nov. à 10:20');
    expect(followUpSlotLabel('2026-11-12T09:20:00Z', 'Cabinet El Menzah')).toBe('jeu. 12 nov. à 10:20 · Cabinet El Menzah');
    expect(followUpSlotLabel('2026-11-12T09:20:00Z', null)).toBe('jeu. 12 nov. à 10:20');
  });

  it('dates the note with the Tunis day, even across midnight UTC', () => {
    expect(followUpDateKey('2026-11-12T23:30:00Z')).toBe('2026-11-13');
    expect(followUpDateKey('2026-11-12T09:20:00Z')).toBe('2026-11-12');
  });

  it('says « confirmé », « proposé au patient » or « en cours de planification… »; SLOT_TAKEN is an alert instead', () => {
    expect(followUpOutcomeLine(OUTCOME)).toBe('Rendez-vous de contrôle : jeu. 12 nov. à 10:20 · confirmé');
    expect(followUpOutcomeLine({ ...OUTCOME, status: 'PROPOSED' })).toBe('Rendez-vous de contrôle : jeu. 12 nov. à 10:20 · proposé au patient');
    expect(followUpOutcomeLine({ ...OUTCOME, status: 'PENDING', appointmentId: null })).toBe('Rendez-vous de contrôle : jeu. 12 nov. à 10:20 · en cours de planification…');
    expect(followUpOutcomeLine({ ...OUTCOME, status: 'SLOT_TAKEN', appointmentId: null })).toBeNull();
    expect(followUpOutcomeLine(null)).toBeNull();
    // After the proposal ended (declined or expired), the appointment's own status.
    expect(followUpOutcomeLine({ ...OUTCOME, status: 'CANCELLED' })).toBe('Rendez-vous de contrôle : jeu. 12 nov. à 10:20 · annulé');
    expect(followUpSlotTakenMessage({ ...OUTCOME, status: 'SLOT_TAKEN' })).toBe('Le créneau du jeu. 12 nov. à 10:20 n’était plus libre : choisissez-en un autre pour le contrôle.');
  });

  it('maps a refused slot to a French message, never a raw code', () => {
    const field = (path: string) => new HttpErrorResponse({ status: 400, error: { errorCode: 'VALIDATION_ERROR', fieldErrorCodes: { [path]: 'NOT_ALLOWED' } } });
    expect(followUpSlotSaveError(field('followUpSlot.start'))).toBe('Ce créneau ne peut pas être choisi pour le contrôle. Choisissez-en un autre.');
    expect(followUpSlotSaveError(field('followUpSlot.practiceLocationId'))).toBe('Ce cabinet n’est plus disponible. Choisissez un autre cabinet.');
    expect(followUpSlotSaveError(new HttpErrorResponse({ status: 409, error: { errorCode: 'CONSULTATION_NOT_IN_PROGRESS' } })))
      .toBe('La consultation n’est plus modifiable : le créneau n’a pas été enregistré.');
    expect(followUpSlotSaveError(new Error('network'))).toBe('Le créneau n’a pas pu être enregistré. Réessayez.');
  });
});
