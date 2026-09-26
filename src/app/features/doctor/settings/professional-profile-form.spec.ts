import { describe, expect, it } from 'vitest';

import { MeProfessionalProfileResponse } from './professional-profile-api.models';
import {
  buildProfessionalProfilePatch,
  draftFromProfile,
  emptyProfessionalProfileDraft,
  hasFieldErrors,
  validateDraft,
} from './professional-profile-form';

function profile(overrides: Partial<MeProfessionalProfileResponse> = {}): MeProfessionalProfileResponse {
  return {
    userId: 'doctor-1',
    professionalLicenseNumber: 'LIC-2020-001',
    specialty: 'Medecine generale',
    governorate: 'Tunis',
    affiliatedClinicId: null,
    alsoIndependent: true,
    verifiedAt: '2026-01-10T09:00:00Z',
    mfaMethod: 'NONE',
    consultationPriceTnd: 60,
    experienceYears: 12,
    practiceLatitude: 36.8065,
    practiceLongitude: 10.1815,
    practiceCity: 'Tunis',
    acceptingNewPatients: true,
    subSpecialties: null,
    languages: ['Francais', 'Arabe'],
    areasOfCare: null,
    expertise: null,
    visitReasons: null,
    patientAgeGroups: null,
    consultationTypes: null,
    biography: 'Generaliste a Tunis.',
    updatedAt: '2026-09-24T01:35:00Z',
    ...overrides,
  };
}

describe('professional-profile-form', () => {
  describe('draftFromProfile', () => {
    it('maps every editable field, preserving empty strings for absent numbers', () => {
      const draft = draftFromProfile(profile());
      expect(draft.specialty).toBe('Medecine generale');
      expect(draft.consultationPriceTnd).toBe('60');
      expect(draft.experienceYears).toBe('12');
      expect(draft.practiceLatitude).toBe('36.8065');
      expect(draft.practiceLongitude).toBe('10.1815');
      expect(draft.practiceCity).toBe('Tunis');
      expect(draft.acceptingNewPatients).toBe(true);
      expect(draft.subSpecialties).toEqual([]);
      expect(draft.languages).toEqual(['Francais', 'Arabe']);
      expect(draft.biography).toBe('Generaliste a Tunis.');
    });

    it('defaults acceptingNewPatients to true and list fields to empty arrays', () => {
      const draft = draftFromProfile(profile({ acceptingNewPatients: undefined, languages: undefined }));
      expect(draft.acceptingNewPatients).toBe(true);
      expect(draft.languages).toEqual([]);
      expect(draft.consultationTypes).toEqual([]);
    });
  });

  describe('emptyProfessionalProfileDraft', () => {
    it('produces a blank but boolean-initialized draft', () => {
      expect(emptyProfessionalProfileDraft().acceptingNewPatients).toBe(true);
      expect(emptyProfessionalProfileDraft().subSpecialties).toEqual([]);
      expect(emptyProfessionalProfileDraft().biography).toBe('');
    });
  });

  describe('buildProfessionalProfilePatch', () => {
    it('emits an empty body when nothing changed', () => {
      const draft = draftFromProfile(profile());
      expect(buildProfessionalProfilePatch(draft, profile())).toEqual({});
    });

    it('sends only the changed fields', () => {
      const baseline = profile();
      const draft = draftFromProfile(baseline);
      const patch = buildProfessionalProfilePatch(
        { ...draft, specialty: 'Cardiologie', experienceYears: '15' },
        baseline,
      );
      expect(patch).toEqual({ specialty: 'Cardiologie', experienceYears: 15 });
    });

    it('treats an emptied list as a real change (empty array clears)', () => {
      const baseline = profile({ languages: ['Francais', 'Arabe'] });
      const draft = { ...draftFromProfile(baseline), languages: [] };
      const patch = buildProfessionalProfilePatch(draft, baseline);
      expect(patch.languages).toEqual([]);
    });

    it('omits untouched list fields entirely', () => {
      const baseline = profile({ subSpecialties: ['Cardiologie'] });
      const patch = buildProfessionalProfilePatch(draftFromProfile(baseline), baseline);
      expect(patch).toEqual({});
    });

    it('omits empty number inputs (leave unchanged)', () => {
      const baseline = profile({ consultationPriceTnd: 60 });
      const draft = { ...draftFromProfile(baseline), consultationPriceTnd: '' };
      const patch = buildProfessionalProfilePatch(draft, baseline);
      expect(patch.consultationPriceTnd).toBeUndefined();
    });

    it('sends an explicit price when the value changes', () => {
      const baseline = profile({ consultationPriceTnd: 60 });
      const draft = { ...draftFromProfile(baseline), consultationPriceTnd: '85.50' };
      const patch = buildProfessionalProfilePatch(draft, baseline);
      expect(patch.consultationPriceTnd).toBe(85.5);
    });

    it('sends the acceptingNewPatients toggle only when toggled', () => {
      const baseline = profile({ acceptingNewPatients: true });
      const draft = { ...draftFromProfile(baseline), acceptingNewPatients: false };
      expect(buildProfessionalProfilePatch(draft, baseline)).toEqual({ acceptingNewPatients: false });
    });

    it('normalizes scalar strings before sending', () => {
      const baseline = profile({ specialty: 'Cardiologie' });
      const draft = { ...draftFromProfile(baseline), specialty: '  Cardiologie  ' };
      expect(buildProfessionalProfilePatch(draft, baseline)).toEqual({});
    });
  });

  describe('validateDraft', () => {
    it('accepts a populated valid draft', () => {
      expect(hasFieldErrors(validateDraft(draftFromProfile(profile())))).toBe(false);
    });

    it('rejects malformed pricing', () => {
      expect(validateDraft({ ...emptyProfessionalProfileDraft(), consultationPriceTnd: 'abc' }).consultationPriceTnd).toBeDefined();
      expect(validateDraft({ ...emptyProfessionalProfileDraft(), consultationPriceTnd: '60.123' }).consultationPriceTnd).toBeDefined();
      expect(validateDraft({ ...emptyProfessionalProfileDraft(), consultationPriceTnd: '-5' }).consultationPriceTnd).toBeDefined();
      expect(validateDraft({ ...emptyProfessionalProfileDraft(), consultationPriceTnd: '999999999999' }).consultationPriceTnd).toBeDefined();
      expect(validateDraft({ ...emptyProfessionalProfileDraft(), consultationPriceTnd: '85.50' }).consultationPriceTnd).toBeUndefined();
    });

    it('rejects invalid or out-of-range coordinates', () => {
      expect(validateDraft({ ...emptyProfessionalProfileDraft(), practiceLatitude: '95' }).practiceLatitude).toBeDefined();
      expect(validateDraft({ ...emptyProfessionalProfileDraft(), practiceLongitude: '181' }).practiceLongitude).toBeDefined();
      expect(validateDraft({ ...emptyProfessionalProfileDraft(), practiceLatitude: '36.8065' }).practiceLatitude).toBeUndefined();
    });

    it('rejects invalid experience values', () => {
      expect(validateDraft({ ...emptyProfessionalProfileDraft(), experienceYears: 'trois' }).experienceYears).toBeDefined();
      expect(validateDraft({ ...emptyProfessionalProfileDraft(), experienceYears: '12' }).experienceYears).toBeUndefined();
    });

    it('rejects oversized lists and list elements', () => {
      const tooMany = Array.from({ length: 51 }, (_, i) => `Langue ${i}`);
      expect(validateDraft({ ...emptyProfessionalProfileDraft(), languages: tooMany }).languages).toBeDefined();
      expect(validateDraft({ ...emptyProfessionalProfileDraft(), languages: ['a'.repeat(101)] }).languages).toBeDefined();
    });

    it('rejects an oversized biography', () => {
      expect(validateDraft({ ...emptyProfessionalProfileDraft(), biography: 'a'.repeat(5001) }).biography).toBeDefined();
    });

    it('allows empty scalar numbers (leave unchanged)', () => {
      const errors = validateDraft({ ...emptyProfessionalProfileDraft(), consultationPriceTnd: '', practiceLatitude: '' });
      expect(errors.consultationPriceTnd).toBeUndefined();
      expect(errors.practiceLatitude).toBeUndefined();
    });
  });
});