import { describe, expect, it } from 'vitest';

import { EMPTY_CLINICAL_RECORD } from '../../clinical-record.models';
import {
  EMPTY_NOTE_FORM,
  UNKNOWN_SUMMARY,
  isEmptyNote,
  newMedicationLine,
  notePayload,
  prescriptionPayload,
  sickLeaveDays,
  validateCertificate,
  validateMedicationLine,
  validateNoteForFinish,
  validateNoteForSave,
  validatePrescription,
  type MedicationLineForm,
} from './consultation-form';
import { DEFAULT_CONSULTATION_RULES as RULES } from './consultation-rules';

const TODAY = '2026-11-10';

function line(patch: Partial<MedicationLineForm> = {}): MedicationLineForm {
  return {
    ...newMedicationLine('11111111-1111-4111-8111-111111111111'),
    name: 'Paracétamol', dose: '500', unit: 'MG', route: 'ORAL', timesPerDay: '3', durationValue: '5', durationUnit: 'DAY',
    ...patch,
  };
}

describe('note validation', () => {
  it('saves a draft without the finish-required fields', () => {
    expect(validateNoteForSave({ ...EMPTY_NOTE_FORM, presentIllness: 'Toux' }, TODAY, false)).toEqual({});
    expect(Object.keys(validateNoteForFinish(EMPTY_NOTE_FORM)).sort()).toEqual([
      'clinicalRecord.chiefComplaint',
      'clinicalRecord.diagnoses.0.label',
      'clinicalRecord.followUp.decision',
      'clinicalRecord.medicationDecision',
    ]);
  });

  it('counts characters, not bytes (500 accented characters pass, 501 fail)', () => {
    expect(validateNoteForSave({ ...EMPTY_NOTE_FORM, diagnosis: 'é'.repeat(500) }, TODAY, false)).toEqual({});
    expect(validateNoteForSave({ ...EMPTY_NOTE_FORM, diagnosis: 'é'.repeat(501) }, TODAY, false))
      .toEqual({ 'clinicalRecord.diagnoses.0.label': 'Texte trop long (500 caractères maximum).' });
  });

  it('requires a follow-up date from today for « Contrôle à une date »', () => {
    const form = { ...EMPTY_NOTE_FORM, followUp: 'FOLLOW_UP_IN_PERIOD' as const };
    expect(validateNoteForFinish(form)['clinicalRecord.followUp.recommendedAt']).toBe('Choisissez une date de suivi.');
    expect(validateNoteForSave({ ...form, followUpDate: '2026-11-09' }, TODAY, false)['clinicalRecord.followUp.recommendedAt'])
      .toContain('à partir d’aujourd’hui');
  });

  it('checks the three-state summary only for the custodian', () => {
    const summary = { ...UNKNOWN_SUMMARY, allergies: { status: 'LIST' as const, items: [] } };
    expect(validateNoteForSave({ ...EMPTY_NOTE_FORM, summary }, TODAY, false)).toEqual({});
    expect(validateNoteForSave({ ...EMPTY_NOTE_FORM, summary }, TODAY, true))
      .toEqual({ 'clinicalRecord.medicalSummaryUpdate.allergies.items': 'Choisissez « Aucune connue » ou ajoutez au moins une allergie.' });
  });
});

describe('note payload', () => {
  it('sends only the summary parts that changed (null part = unchanged)', () => {
    const form = { ...EMPTY_NOTE_FORM, chiefComplaint: 'Fièvre', summary: { ...UNKNOWN_SUMMARY, bloodType: 'O+', allergies: { status: 'NONE_KNOWN' as const, items: [] } } };
    const payload = notePayload(form, EMPTY_CLINICAL_RECORD, UNKNOWN_SUMMARY);
    expect(payload.medicalSummaryUpdate).toEqual({ bloodType: 'O+', allergies: { status: 'NONE_KNOWN', items: [] }, conditions: null });
    expect(notePayload(form, EMPTY_CLINICAL_RECORD, null).medicalSummaryUpdate).toBeNull();
  });

  it('carries a saved summary update over when the baseline is not known', () => {
    const base = { ...EMPTY_CLINICAL_RECORD, medicalSummaryUpdate: { bloodType: 'A+', allergies: null, conditions: null } };
    expect(notePayload(EMPTY_NOTE_FORM, base, null).medicalSummaryUpdate).toEqual(base.medicalSummaryUpdate);
  });

  it('maps the follow-up choices and never sends an empty note', () => {
    expect(notePayload({ ...EMPTY_NOTE_FORM, followUp: 'FOLLOW_UP_AS_NEEDED' }, EMPTY_CLINICAL_RECORD, null).followUp)
      .toEqual({ required: true, recommendedAt: null, decision: 'FOLLOW_UP_AS_NEEDED' });
    expect(isEmptyNote(notePayload(EMPTY_NOTE_FORM, EMPTY_CLINICAL_RECORD, null))).toBe(true);
    expect(isEmptyNote(notePayload({ ...EMPTY_NOTE_FORM, chiefComplaint: 'Toux' }, EMPTY_CLINICAL_RECORD, null))).toBe(false);
  });
});

describe('prescription rules', () => {
  it.each([
    ['DAY', '365', true], ['DAY', '366', false],
    ['WEEK', '52', true], ['WEEK', '53', false],
    ['MONTH', '12', true], ['MONTH', '13', false],
    ['DAY', '0', false],
  ] as const)('duration %s %s → valid=%s (cap per unit)', (unit, value, valid) => {
    const errors = validateMedicationLine(line({ durationUnit: unit, durationValue: value }), 0, RULES);
    expect(Object.keys(errors).length === 0).toBe(valid);
    if (!valid) expect(errors['prescription.medications.0.duration.value']).toMatch(/^Durée entre 1 et/);
  });

  it('requires the duration (no long-term option on this page) and names the field', () => {
    expect(validateMedicationLine(line({ durationValue: '' }), 1, RULES))
      .toEqual({ 'prescription.medications.1.duration': 'Indiquez la durée du traitement.' });
  });

  it('« Traitement au long cours » needs no duration and sends longTerm without one', () => {
    const longTerm = line({ longTerm: true, durationValue: '' });
    expect(validateMedicationLine(longTerm, 0, RULES)).toEqual({});
    const content = prescriptionPayload([longTerm], null);
    expect(content.medications[0]).toMatchObject({ longTerm: true, duration: null });
    // A value left in the hidden field is not sent either.
    expect(prescriptionPayload([line({ longTerm: true, durationValue: '400' })], null).medications[0].duration).toBeNull();
  });

  it('stores the duration as entered, with its unit', () => {
    const content = prescriptionPayload([line({ durationValue: '1', durationUnit: 'WEEK', dose: '0,5' })], null);
    expect(content.medications[0].duration).toEqual({ value: 1, unit: 'WEEK' });
    expect(content.medications[0].dose).toEqual({ amount: 0.5, unit: 'MG' });
  });

  it('checks unit/route lists, 1–24 intakes per day and quantity ≥ 1', () => {
    const errors = validateMedicationLine(line({ unit: null, route: null, timesPerDay: '25', quantity: '0' }), 0, RULES);
    expect(errors).toEqual({
      'prescription.medications.0.dose.unit': 'Choisissez une unité.',
      'prescription.medications.0.route': 'Choisissez une voie d’administration.',
      'prescription.medications.0.frequency.timesPerDay': 'Entre 1 et 24 prises par jour.',
      'prescription.medications.0.quantity': 'Indiquez une quantité d’au moins 1.',
    });
  });

  it('caps a prescription at 15 lines (configuration value)', () => {
    expect(validatePrescription(Array.from({ length: 15 }, () => line()), RULES)).toEqual({});
    expect(validatePrescription(Array.from({ length: 16 }, () => line()), RULES)['prescription.medications'])
      .toBe('Une ordonnance peut contenir au plus 15 médicaments.');
    expect(validatePrescription(Array.from({ length: 4 }, () => line()), { ...RULES, maxMedications: 3 })['prescription.medications'])
      .toBe('Une ordonnance peut contenir au plus 3 médicaments.');
  });
});

describe('sick leave', () => {
  it('allows 365 days inclusive (end ≤ start + 364) and refuses 366', () => {
    expect(sickLeaveDays({ startDate: '2026-01-01', endDate: '2026-12-31' })).toBe(365);
    expect(validateCertificate('SICK_LEAVE_CERTIFICATE', { statement: 'Repos', startDate: '2026-01-01', endDate: '2026-12-31' }, RULES)).toEqual({});
    expect(validateCertificate('SICK_LEAVE_CERTIFICATE', { statement: 'Repos', startDate: '2026-01-01', endDate: '2027-01-01' }, RULES))
      .toEqual({ endDate: 'Un arrêt de travail ne peut pas dépasser 365 jours.' });
  });

  it('requires the statement and ordered dates', () => {
    expect(validateCertificate('SICK_LEAVE_CERTIFICATE', { statement: ' ', startDate: '2026-01-05', endDate: '2026-01-04' }, RULES))
      .toEqual({ statement: 'Rédigez le contenu du certificat.', endDate: 'La date de fin doit suivre la date de début.' });
  });
});
