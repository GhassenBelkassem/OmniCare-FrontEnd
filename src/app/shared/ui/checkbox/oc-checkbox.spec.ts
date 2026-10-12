import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';

import { OcCheckbox } from './oc-checkbox';

describe('OcCheckbox', () => {
  let fixture: ComponentFixture<OcCheckbox>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [OcCheckbox] });
    fixture = TestBed.createComponent(OcCheckbox);
    fixture.componentRef.setInput('controlId', 'equipment-ecg');
    fixture.componentRef.setInput('labelledBy', 'equipment-ecg-label');
    fixture.detectChanges();
  });

  it('exposes the Spartan checkbox state and accessible label relationship', () => {
    const changed = vi.fn();
    fixture.componentInstance.checkedChange.subscribe(changed);
    const control = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '[role="checkbox"]',
    );

    expect(control?.getAttribute('aria-labelledby')).toBe('equipment-ecg-label');
    expect(control?.getAttribute('aria-checked')).toBe('false');
    control?.click();
    fixture.detectChanges();
    expect(changed).toHaveBeenCalledWith(true);
    expect(control?.getAttribute('aria-checked')).toBe('true');
  });
});
