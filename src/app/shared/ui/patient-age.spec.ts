import { describe, expect, it } from 'vitest';

import { isRecentBirthDate, patientAge, patientAgeLabel } from './patient-age';

const NOW = new Date('2026-11-10T09:00:00Z');

describe('patient age', () => {
  it('shows babies in days, then months, then years — never « 0 an »', () => {
    expect(patientAgeLabel('2026-11-10', NOW)).toBe('0 jour');
    expect(patientAgeLabel('2026-11-09', NOW)).toBe('1 jour');
    expect(patientAgeLabel('2026-10-30', NOW)).toBe('11 jours');
    expect(patientAgeLabel('2026-08-10', NOW)).toBe('3 mois');
    expect(patientAgeLabel('2025-11-11', NOW)).toBe('11 mois');
    expect(patientAgeLabel('2025-11-10', NOW)).toBe('1 an');
    expect(patientAgeLabel('1992-03-12', NOW)).toBe('34 ans');
  });

  it('uses the clinic calendar day and handles month ends', () => {
    // 23:30 UTC on 9 November is already 10 November in Tunis.
    expect(patientAgeLabel('2026-11-10', new Date('2026-11-09T23:30:00Z'))).toBe('0 jour');
    expect(patientAge('2026-01-31', new Date('2026-03-01T10:00:00Z'))).toEqual({ years: 0, months: 1, days: 1 });
  });

  it('returns null for unknown, invalid or future dates', () => {
    expect(patientAgeLabel(null, NOW)).toBeNull();
    expect(patientAgeLabel('2026-02-30', NOW)).toBeNull();
    expect(patientAgeLabel('2026-12-01', NOW)).toBeNull();
  });

  it('flags a date of birth less than a year ago', () => {
    expect(isRecentBirthDate('2026-05-01', NOW)).toBe(true);
    expect(isRecentBirthDate('2025-11-10', NOW)).toBe(false);
    expect(isRecentBirthDate(null, NOW)).toBe(false);
  });
});
