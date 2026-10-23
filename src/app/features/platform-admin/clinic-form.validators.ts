import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Field bounds for `CreateClinicRequest`. Kept in one place so the form cannot drift
 * away from the backend's `@Size` caps and start rejecting values the API would accept.
 */
export const CLINIC_FIELD_LIMITS = {
  name: 160,
  contactEmail: 255,
  contactPhone: 20,
  governorate: 100,
  address: 500,
  inpdpNumber: 64,
} as const;

/** Mirrors the backend's `@NotBlank`, which rejects whitespace-only input. */
const HAS_NON_WHITESPACE = /\S/;

/**
 * `Validators.required` only rejects zero-length values, so a field holding a stray space
 * passes the client and is refused by the backend's `@NotBlank` as an unexplained
 * validation failure. Reports `blank` separately from `required` so the form can say which.
 */
export function notBlank(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const raw: unknown = control.value;
    const value = typeof raw === 'string' ? raw : '';
    if (HAS_NON_WHITESPACE.test(value)) return null;
    return value.length === 0 ? { required: true } : { blank: true };
  };
}

const DISPLAY_SEPARATORS = /[\s().-]/g;
const INTERNATIONAL = /^\+216[0-9]{8}$/;
const NATIONAL = /^[0-9]{8}$/;
const INTERNATIONAL_WITHOUT_PLUS = /^216[0-9]{8}$/;
const INTERNATIONAL_DIALLING = /^00216[0-9]{8}$/;

/**
 * Exact client-side mirror of `PhoneNumberNormalizer`: display separators are stripped,
 * then the result must be a Tunisian number written as `+216…`, `216…`, `00216…`, or
 * eight bare digits. Kept deliberately equivalent rather than looser or stricter so the
 * form never blocks a number the backend would have accepted.
 */
export function tunisianPhoneNumber(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const raw: unknown = control.value;
    const trimmed = typeof raw === 'string' ? raw.trim() : '';
    if (trimmed === '') return null;
    const compact = trimmed.replace(DISPLAY_SEPARATORS, '');
    const accepted =
      INTERNATIONAL.test(compact) ||
      NATIONAL.test(compact) ||
      INTERNATIONAL_WITHOUT_PLUS.test(compact) ||
      INTERNATIONAL_DIALLING.test(compact);
    return accepted ? null : { tunisianPhoneNumber: true };
  };
}
