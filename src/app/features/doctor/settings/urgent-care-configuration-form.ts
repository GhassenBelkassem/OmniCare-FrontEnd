import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export interface UrgentConfigurationDraft {
  readonly homeFeeTnd: string;
  readonly cabinetFeeTnd: string;
  readonly maxHomeTravelKm: string;
}

export const feeDecimalValidator = exactDecimalValidator(8, 3, true);
export const distanceDecimalValidator = exactDecimalValidator(12, 6, false);

export function toNullableDecimal(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : normalizeDecimal(trimmed);
}

export function sameDraft(
  left: UrgentConfigurationDraft,
  right: UrgentConfigurationDraft,
): boolean {
  return (
    sameDecimalValue(left.homeFeeTnd, right.homeFeeTnd) &&
    sameDecimalValue(left.cabinetFeeTnd, right.cabinetFeeTnd) &&
    sameDecimalValue(left.maxHomeTravelKm, right.maxHomeTravelKm)
  );
}

export function normalizeDecimal(value: string): string {
  const [integerPart, fractionPart] = value.split('.');
  const integer = integerPart.replace(/^0+(?=\d)/, '');
  return fractionPart === undefined ? integer : `${integer}.${fractionPart}`;
}

export function sameDecimalValue(left: string, right: string): boolean {
  const normalizedLeft = semanticDecimal(left);
  const normalizedRight = semanticDecimal(right);
  return normalizedLeft !== null && normalizedLeft === normalizedRight;
}

function semanticDecimal(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === '') return '';
  if (!/^\d+(?:\.\d+)?$/.test(trimmed)) return null;
  const [rawInteger, rawFraction = ''] = trimmed.split('.');
  const integer = rawInteger.replace(/^0+(?=\d)/, '');
  const fraction = rawFraction.replace(/0+$/, '');
  return fraction ? `${integer}.${fraction}` : integer;
}

function exactDecimalValidator(
  maxIntegerDigits: number,
  maxFractionDigits: number,
  zeroAllowed: boolean,
): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = String(control.value ?? '').trim();
    if (value === '') return null;
    if (value.startsWith('-')) return { negative: true };
    if (!/^\d+(?:\.\d+)?$/.test(value)) return { decimal: true };
    const [rawInteger, fraction = ''] = value.split('.');
    const integer = rawInteger.replace(/^0+(?=\d)/, '');
    if (integer.length > maxIntegerDigits) return { integerDigits: true };
    if (fraction.length > maxFractionDigits) return { fractionDigits: true };
    if (!zeroAllowed && /^0+(?:\.0+)?$/.test(value)) return { positive: true };
    return null;
  };
}
