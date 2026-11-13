import { describe, expect, it } from 'vitest';

import { eventAriaLabel, patientLabel } from './calendar-privacy';

describe('patientLabel', () => {
  it('returns the full name when not discreet', () => {
    expect(patientLabel('Test Patient', false)).toBe('Test Patient');
  });

  it('trims and collapses spaces when not discreet', () => {
    expect(patientLabel('  Test   Patient  ', false)).toBe('Test Patient');
  });

  it('returns two initials when discreet', () => {
    expect(patientLabel('Karim Mansour', true)).toBe('K. M.');
  });

  it('upper-cases lower-case initials', () => {
    expect(patientLabel('karim mansour', true)).toBe('K. M.');
  });

  it('uses only the first two words', () => {
    expect(patientLabel('Mohamed Ali Ben Test', true)).toBe('M. A.');
  });

  it('returns one initial for a single word', () => {
    expect(patientLabel('Test', true)).toBe('T.');
  });

  it('takes the first letter of a hyphenated or accented word', () => {
    expect(patientLabel('Jean-Pierre Émile', true)).toBe('J. É.');
  });

  it('supports Arabic names', () => {
    expect(patientLabel('محمد علي', true)).toBe('م. ع.');
  });

  it('supports characters outside the basic plane without splitting them', () => {
    expect(patientLabel('𠮷野 家', true)).toBe('𠮷. 家.');
  });

  it('skips leading punctuation', () => {
    expect(patientLabel('(Test) "Patient"', true)).toBe('T. P.');
  });

  it('falls back to « Patient » for empty, blank, null or undefined names', () => {
    for (const value of ['', '   ', null, undefined]) {
      expect(patientLabel(value, false)).toBe('Patient');
      expect(patientLabel(value, true)).toBe('Patient');
    }
  });

  it('falls back to « Patient » when no word has a letter or digit', () => {
    expect(patientLabel('--- ...', true)).toBe('Patient');
  });

  it('never leaks the name in discreet mode', () => {
    expect(patientLabel('Test Patient', true)).not.toContain('est');
  });
});

describe('eventAriaLabel', () => {
  it('includes the patient name when not discreet', () => {
    expect(eventAriaLabel('09:30', 'Test Patient', 'À venir', false)).toBe(
      'Rendez-vous à 09:30 avec Test Patient. Statut : À venir.',
    );
  });

  it('omits the name entirely when discreet, not even initials', () => {
    const label = eventAriaLabel('09:30', 'Test Patient', 'À venir', true);
    expect(label).toBe('Rendez-vous à 09:30. Statut : À venir.');
    expect(label).not.toContain('Test');
    expect(label).not.toContain('T.');
  });

  it('uses « Patient » when the name is missing and not discreet', () => {
    expect(eventAriaLabel('09:30', null, 'Terminé', false)).toBe(
      'Rendez-vous à 09:30 avec Patient. Statut : Terminé.',
    );
  });

  it('handles an empty time and an empty state label', () => {
    expect(eventAriaLabel('', 'Test Patient', '', false)).toBe('Rendez-vous avec Test Patient.');
    expect(eventAriaLabel(' ', 'Test Patient', ' ', true)).toBe('Rendez-vous.');
  });
});
