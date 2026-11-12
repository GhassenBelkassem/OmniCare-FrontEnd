import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';

import { OcDateBlock, dateBlockParts } from './oc-date-block';

describe('OcDateBlock', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('splits a date into the day and the short month in Tunis time', () => {
    expect(dateBlockParts('2026-11-13')).toEqual({ day: '13', month: 'NOV.', full: '13 novembre 2026' });
    // 23:30 UTC on the 12th is already the 13th in Tunis.
    expect(dateBlockParts('2026-11-12T23:30:00Z')?.day).toBe('13');
    expect(dateBlockParts(null)).toBeNull();
  });

  it('shows day + month, reads the full date, and uses the primary tint for « care »', () => {
    const fixture = TestBed.createComponent(OcDateBlock);
    fixture.componentRef.setInput('date', '2026-11-13');
    fixture.componentRef.setInput('tone', 'care');
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.oc-date-block__day')?.textContent).toBe('13');
    expect(root.querySelector('.oc-date-block__month')?.textContent).toBe('NOV.');
    expect(root.querySelector('.oc-sr-only')?.textContent).toBe('13 novembre 2026');
    expect(root.querySelector('.oc-date-block')?.classList).toContain('oc-date-block--care');
  });
});
