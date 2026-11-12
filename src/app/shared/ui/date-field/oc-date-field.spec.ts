import { describe, expect, it } from 'vitest';

import { dateValueToUiDate, uiDateToDateValue } from './oc-date-field';

describe('OcDateField value conversion', () => {
  it('round-trips a wall-clock date without timezone drift', () => {
    const ui = dateValueToUiDate('2026-11-09');
    expect(ui?.getDate()).toBe(9);
    expect(uiDateToDateValue(ui)).toBe('2026-11-09');
  });

  it('rejects malformed values', () => {
    expect(dateValueToUiDate('09/11/2026')).toBeNull();
    expect(uiDateToDateValue(null)).toBeNull();
  });
});
