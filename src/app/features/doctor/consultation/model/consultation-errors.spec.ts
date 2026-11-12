import { describe, expect, it } from 'vitest';

import {
  GENERIC_ERROR_MESSAGE,
  consultationErrorMessage,
  fieldMessage,
  mapServerFieldErrors,
  readinessItem,
} from './consultation-errors';

const ENGLISH = /\b(must|required|invalid|select|enter|field|null|blank|error|not|should)\b/i;

describe('mapServerFieldErrors (one mapping utility for every surface)', () => {
  it('keeps note paths and picks the client message by path + code, never the server text', () => {
    const mapped = mapServerFieldErrors({
      fieldErrors: {
        'clinicalRecord.diagnoses.0.label': 'must not be longer than 500',
        'clinicalRecord.chiefComplaint': 'whatever the server says',
      },
      fieldErrorCodes: {
        'clinicalRecord.diagnoses.0.label': 'TOO_LONG',
        'clinicalRecord.chiefComplaint': 'REQUIRED',
      },
    }, { kind: 'note' });
    expect(mapped).toEqual({
      'clinicalRecord.diagnoses.0.label': 'Texte trop long (500 caractères maximum).',
      'clinicalRecord.chiefComplaint': 'Indiquez le motif de consultation.',
    });
  });

  it('maps prescription line N fields onto the same line', () => {
    const mapped = mapServerFieldErrors({
      fieldErrors: {},
      fieldErrorCodes: {
        'prescription.medications.2.route': 'INVALID_VALUE',
        'prescription.medications.2.duration.value': 'OUT_OF_RANGE',
        'prescription.medications': 'TOO_MANY_ITEMS',
      },
    }, { kind: 'prescription' });
    expect(mapped['prescription.medications.2.route']).toBe('Choisissez une voie d’administration.');
    expect(mapped['prescription.medications.2.duration.value']).toContain('365 jours, 52 semaines ou 12 mois');
    expect(mapped['prescription.medications']).toBe('Une ordonnance peut contenir au plus 15 médicaments.');
  });

  it('re-keys order and artifact paths to their row', () => {
    expect(mapServerFieldErrors({
      fieldErrors: {}, fieldErrorCodes: { 'order.definition.requestedExamination': 'TOO_SHORT' },
    }, { kind: 'order', rowKey: 'r3' })).toEqual({ 'order:r3.target': 'Texte trop court (2 caractères minimum).' });

    expect(mapServerFieldErrors({
      fieldErrors: {}, fieldErrorCodes: { 'artifact.endDate': 'OUT_OF_RANGE', 'artifact.statement': 'REQUIRED' },
    }, { kind: 'artifact', type: 'SICK_LEAVE_CERTIFICATE' })).toEqual({
      'artifact:SICK_LEAVE_CERTIFICATE.endDate': 'Un arrêt de travail ne peut pas dépasser 365 jours.',
      'artifact:SICK_LEAVE_CERTIFICATE.statement': 'Rédigez le contenu du certificat.',
    });
  });

  it('falls back to a generic French message when a path has no code, and drops foreign or unsafe paths', () => {
    const mapped = mapServerFieldErrors({
      fieldErrors: { 'clinicalRecord.unknownThing': 'Something English', 'prescription.medications.0.name': 'x', '<script>': 'x' },
      fieldErrorCodes: {},
    }, { kind: 'note' });
    expect(mapped).toEqual({ 'clinicalRecord.unknownThing': 'Valeur non valide.' });
  });

  it('never produces English or a raw code for any catalogue code', () => {
    const codes = ['REQUIRED', 'TOO_LONG', 'TOO_SHORT', 'TOO_MANY_ITEMS', 'OUT_OF_RANGE', 'INVALID_VALUE', 'INVALID_DATE',
      'DATE_ORDER', 'NOT_ALLOWED', 'ITEMS_REQUIRED', 'DUPLICATE', 'INCONSISTENT', 'NO_CONTENT', 'MALFORMED', 'WHATEVER'];
    for (const code of codes) {
      for (const path of ['clinicalRecord.foo', 'prescription.medications.0.bar', 'order:r1.target', 'artifact:MEDICAL_CERTIFICATE.statement']) {
        const message = fieldMessage(path, code);
        expect(message).not.toMatch(ENGLISH);
        expect(message).not.toMatch(/[A-Z]{3,}_[A-Z]/);
      }
    }
  });
});

describe('consultationErrorMessage (non-field errors, by code)', () => {
  it('maps known codes to French and never uses the server message', () => {
    expect(consultationErrorMessage({ code: 'CLINICAL_RECORD_VERSION_CONFLICT', status: 409 }))
      .toBe('Cette consultation a été modifiée ailleurs.');
    expect(consultationErrorMessage({ code: 'ARTIFACT_NOT_FINALIZABLE', status: 409 }))
      .toBe('Ce document ne peut pas encore être signé.');
  });

  it('maps an unknown code to one generic French message', () => {
    expect(consultationErrorMessage({ code: 'SOMETHING_NEW_FROM_SERVER', status: 409 })).toBe(GENERIC_ERROR_MESSAGE);
    expect(consultationErrorMessage(null)).toBe(GENERIC_ERROR_MESSAGE);
    expect(GENERIC_ERROR_MESSAGE).not.toMatch(ENGLISH);
  });

  it('gives a connection message for a network failure', () => {
    expect(consultationErrorMessage({ code: null, status: 0 })).toContain('Connexion impossible');
  });

  it('labels every readiness code in French, including CHIEF_COMPLAINT_MISSING', () => {
    expect(readinessItem('CHIEF_COMPLAINT_MISSING')).toEqual({ label: 'Motif de consultation', target: 'motif' });
    expect(readinessItem('PRESCRIPTION_NOT_FINALIZED').target).toBe('traitement');
    expect(readinessItem('NEW_CODE').label).toBe('Un élément est à vérifier');
  });
});
