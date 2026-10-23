import { FormControl } from '@angular/forms';
import { describe, expect, it } from 'vitest';

import {
  distanceDecimalValidator,
  feeDecimalValidator,
  sameDraft,
  toNullableDecimal,
} from './urgent-care-configuration-form';

describe('urgent configuration decimal form', () => {
  it('keeps blank distinct from explicitly configured zero', () => {
    expect(toNullableDecimal('')).toBeNull();
    expect(toNullableDecimal('0.000')).toBe('0.000');
  });

  it('rejects negative, excessive fee scale, and invalid distance scale', () => {
    expect(feeDecimalValidator(new FormControl('-1'))).toEqual({ negative: true });
    expect(feeDecimalValidator(new FormControl('1.0001'))).toEqual({ fractionDigits: true });
    expect(distanceDecimalValidator(new FormControl('0'))).toEqual({ positive: true });
    expect(distanceDecimalValidator(new FormControl('1.0000001'))).toEqual({
      fractionDigits: true,
    });
  });

  it('compares equivalent decimals without a floating-point conversion', () => {
    expect(
      sameDraft(
        { homeFeeTnd: '0', cabinetFeeTnd: '60.0', maxHomeTravelKm: '20.500000' },
        { homeFeeTnd: '0.000', cabinetFeeTnd: '60.000', maxHomeTravelKm: '20.5' },
      ),
    ).toBe(true);
  });
});
