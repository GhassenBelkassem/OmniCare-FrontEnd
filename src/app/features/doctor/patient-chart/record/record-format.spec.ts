import { describe, expect, it } from 'vitest';

import {
  bodyMassIndex,
  currentConsultationLine,
  documentCards,
  followUpLabel,
  inclusiveDays,
  medicationState,
  medicationTags,
  periodLabel,
  templateFallbackNotice,
  tunisToday,
  untilLabel,
} from './record-format';
import type { RecordMedication } from './patient-record.models';

function medication(patch: Partial<RecordMedication> = {}): RecordMedication {
  return {
    id: 'm1', name: 'Amoxicilline', strength: null, dose: { amount: 500, unit: 'MG' }, route: 'ORAL', timesPerDay: 2,
    frequencyText: null, duration: { value: 7, unit: 'DAY' }, longTerm: false, startedAt: '2026-11-03', endsAt: '2026-11-09',
    prescribedAt: '2026-11-03T09:00:00Z', ...patch,
  };
}

describe('record format', () => {
  it('uses the Tunis calendar day for « today » (23:30 UTC is already tomorrow in Tunis)', () => {
    expect(tunisToday(new Date('2026-11-10T23:30:00Z'))).toBe('2026-11-11');
    expect(tunisToday(new Date('2026-11-10T22:59:00Z'))).toBe('2026-11-10');
  });

  it('splits Actuels / Anciens by end date: today is still current, yesterday is past, no end date is current', () => {
    expect(medicationState('2026-11-11', '2026-11-11')).toBe('current');
    expect(medicationState('2026-11-10', '2026-11-11')).toBe('past');
    expect(medicationState(null, '2026-11-11')).toBe('current');
  });

  it('gives one tag per structured value (never a « · »-joined sentence), « Au long cours » instead of a duration', () => {
    expect(medicationTags(medication())).toEqual(['500 mg', 'Voie orale', '2× par jour', '7 jours']);
    expect(medicationTags(medication({ dose: { amount: 1, unit: 'TABLET' }, route: null, timesPerDay: 1, duration: { value: 1, unit: 'WEEK' } })))
      .toEqual(['1 comprimé', '1× par jour', '1 semaine']);
    expect(medicationTags(medication({ dose: { amount: 2, unit: 'TABLET' }, longTerm: true, duration: null, endsAt: null })))
      .toEqual(['2 comprimés', 'Voie orale', '2× par jour', 'Au long cours']);
    expect(medicationTags(medication({ dose: { amount: 5, unit: 'cuillère' }, route: null, timesPerDay: null, frequencyText: 'matin et soir', duration: { value: 2, unit: 'MONTH' } })))
      .toEqual(['5 cuillère', 'matin et soir', '2 mois']);
    for (const tag of medicationTags(medication())) expect(tag).not.toContain('·');
  });

  it('writes « jusqu’au 16 nov. », with the year only when it is not the current one', () => {
    expect(untilLabel('2026-11-16', '2026-11-11')).toBe('jusqu’au 16 nov.');
    expect(untilLabel('2025-12-02', '2026-11-11')).toBe('jusqu’au 2 déc. 2025');
    expect(untilLabel(null, '2026-11-11')).toBe('');
  });

  it('labels the follow-up decisions (control date with its weekday)', () => {
    expect(followUpLabel({ decision: 'NO_FOLLOW_UP', date: null })).toBe('Aucun suivi');
    expect(followUpLabel({ decision: 'FOLLOW_UP_AS_NEEDED', date: null })).toBe('Si besoin');
    expect(followUpLabel({ decision: 'FOLLOW_UP_IN_PERIOD', date: '2026-11-12' })).toBe('Contrôle le jeu. 12 nov. 2026');
  });

  it('writes the sick-leave period with its inclusive day count', () => {
    expect(inclusiveDays('2026-11-11', '2026-11-12')).toBe(2);
    expect(periodLabel('2026-11-11', '2026-11-12')).toBe('11 → 12 nov. 2026 · 2 jours');
    expect(periodLabel('2026-10-30', '2026-11-02')).toBe('30 oct. → 2 nov. 2026 · 4 jours');
    expect(periodLabel('2026-11-11', '2026-11-11')).toBe('11 → 11 nov. 2026 · 1 jour');
  });

  it('builds distinct document cards: title, subtitle and colour per type', () => {
    const cards = documentCards([
      { id: '1', type: 'PRESCRIPTION', startDate: null, endDate: null, downloadable: true },
      { id: '2', type: 'SICK_LEAVE_CERTIFICATE', startDate: '2026-11-11', endDate: '2026-11-12', downloadable: true },
      { id: '3', type: 'MEDICAL_CERTIFICATE', startDate: null, endDate: null, downloadable: true },
      { id: '4', type: 'MEDICAL_CERTIFICATE', startDate: null, endDate: null, downloadable: true },
    ], { date: '2026-11-11T09:00:00Z', medicationCount: 2 });
    expect(cards.map(({ title, subtitle, tone }) => [title, subtitle, tone])).toEqual([
      ['Ordonnance', '2 médicaments', 'care'],
      ['Arrêt de travail', '11 → 12 nov. 2026 · 2 jours', 'history'],
      ['Certificat médical', '11 nov. 2026', 'allergy'],
      ['Certificat médical (2)', '11 nov. 2026', 'allergy'],
    ]);
    expect(new Set(cards.map((card) => card.title)).size).toBe(cards.length);
    expect(documentCards([{ id: '1', type: 'PRESCRIPTION', startDate: null, endDate: null, downloadable: true }], { date: null, medicationCount: 1 })[0].subtitle)
      .toBe('1 médicament');
  });

  it('announces a document printed on the standard layout instead of the chosen template (G-1 D5)', () => {
    const sickLeave = { id: '2', type: 'SICK_LEAVE_CERTIFICATE', startDate: '2026-11-11', endDate: '2026-11-12', downloadable: true };
    expect(templateFallbackNotice({ ...sickLeave, templateFallback: true })).toBe('Document généré sur le modèle standard.');
    expect(templateFallbackNotice(sickLeave)).toBeNull();
    expect(templateFallbackNotice({ ...sickLeave, templateFallback: false })).toBeNull();
    expect(templateFallbackNotice({ ...sickLeave, templateFallback: true, downloadable: false })).toBeNull();
  });

  it('writes the current consultation line: « Aujourd’hui · commencée à HH:mm » (Tunis time)', () => {
    expect(currentConsultationLine('2026-11-11T08:05:00Z', new Date('2026-11-11T10:00:00Z'))).toBe('Aujourd’hui · commencée à 09:05');
    expect(currentConsultationLine('2026-11-10T08:05:00Z', new Date('2026-11-11T10:00:00Z'))).toBe('10 nov. 2026 · commencée à 09:05');
  });

  it('computes the IMC only with both measures', () => {
    expect(bodyMassIndex(165, 58.5)).toBe('21,5');
    expect(bodyMassIndex(null, 58.5)).toBeNull();
  });
});
