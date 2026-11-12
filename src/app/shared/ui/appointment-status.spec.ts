import { describe, expect, it } from 'vitest';

import { appointmentStatusLabel, appointmentStatusPresentation } from './appointment-status';

describe('appointment status mapping', () => {
  it('maps every appointment status to its single French label and tone', () => {
    expect(appointmentStatusLabel('CONFIRMED')).toBe('Confirmé');
    expect(appointmentStatusLabel('IN_PROGRESS')).toBe('En cours');
    expect(appointmentStatusLabel('COMPLETED')).toBe('Terminé');
    expect(appointmentStatusLabel('CANCELLED')).toBe('Annulé');
    expect(appointmentStatusLabel('NO_SHOW')).toBe('Absent');
    expect(appointmentStatusPresentation('CONFIRMED')?.tone).toBe('primary');
    expect(appointmentStatusPresentation('IN_PROGRESS')?.tone).toBe('violet');
    expect(appointmentStatusPresentation('CANCELLED')?.struck).toBe(true);
  });

  it('shows pending booking requests as « En attente » and never a confirmed appointment', () => {
    expect(appointmentStatusLabel('PENDING_DOCTOR')).toBe('En attente');
    expect(appointmentStatusLabel('CONFIRMED')).not.toBe('En attente');
  });

  it('shows a follow-up proposed to an OmniCare patient as « Proposé », amber (G-1 D4)', () => {
    expect(appointmentStatusLabel('PROPOSED')).toBe('Proposé');
    expect(appointmentStatusPresentation('PROPOSED')?.tone).toBe('amber');
    expect(appointmentStatusPresentation('PROPOSED')?.struck).toBe(false);
  });

  it('never leaks a raw backend code', () => {
    expect(appointmentStatusLabel('SOMETHING_NEW')).toBe('Statut inconnu');
  });
});
