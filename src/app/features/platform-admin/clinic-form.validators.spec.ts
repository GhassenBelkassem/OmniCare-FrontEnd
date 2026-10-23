import { FormControl } from '@angular/forms';

import { CLINIC_FIELD_LIMITS, notBlank, tunisianPhoneNumber } from './clinic-form.validators';

function blankErrors(value: string) {
  return notBlank()(new FormControl(value));
}

function phoneErrors(value: string) {
  return tunisianPhoneNumber()(new FormControl(value));
}

describe('clinic form validators', () => {
  describe('notBlank', () => {
    it('rejects an empty value as required', () => {
      expect(blankErrors('')).toEqual({ required: true });
    });

    it('rejects a whitespace-only value separately from required', () => {
      expect(blankErrors('   ')).toEqual({ blank: true });
    });

    it('rejects a tab-only value', () => {
      expect(blankErrors('\t \n')).toEqual({ blank: true });
    });

    it('accepts a value that has real content', () => {
      expect(blankErrors('Clinique Jasmin')).toBeNull();
    });

    it('accepts a value with surrounding whitespace as long as content remains', () => {
      expect(blankErrors('  Clinique Jasmin  ')).toBeNull();
    });
  });

  describe('tunisianPhoneNumber', () => {
    it('accepts every form the backend normalizer accepts', () => {
      const wronglyRejected = [
        '+21620123456',
        '+216 20 123 456',
        '20 123 456',
        '0021620123456',
        '21620123456',
        '+216.20.123.456',
        '(20) 123 456',
      ].filter((value) => phoneErrors(value) !== null);
      expect(wronglyRejected).toEqual([]);
    });

    it('rejects values the backend refuses', () => {
      const wronglyAccepted = [
        '123',
        'abc',
        '+2162012345',
        '+216201234567',
        '12345678a',
        '+33123456789',
        '201234567',
      ].filter((value) => phoneErrors(value) === null);
      expect(wronglyAccepted).toEqual([]);
    });

    it('reports a distinguishable error key', () => {
      expect(phoneErrors('123')).toEqual({ tunisianPhoneNumber: true });
    });

    it('leaves emptiness to the required validator', () => {
      expect(phoneErrors('   ')).toBeNull();
    });
  });

  describe('CLINIC_FIELD_LIMITS', () => {
    it('matches the bounds declared on CreateClinicRequest', () => {
      expect(CLINIC_FIELD_LIMITS).toEqual({
        name: 160,
        contactEmail: 255,
        contactPhone: 20,
        governorate: 100,
        address: 500,
        inpdpNumber: 64,
      });
    });
  });
});
