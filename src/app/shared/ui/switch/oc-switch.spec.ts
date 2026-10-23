import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';

import { OcSwitch } from './oc-switch';

describe('OcSwitch', () => {
  let fixture: ComponentFixture<OcSwitch>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [OcSwitch] });
    fixture = TestBed.createComponent(OcSwitch);
    fixture.componentRef.setInput('controlId', 'capability-cabinet');
    fixture.componentRef.setInput('labelledBy', 'capability-cabinet-label');
    fixture.detectChanges();
  });

  it('supports a controlled checked state and emits user changes', () => {
    const changed = vi.fn();
    fixture.componentInstance.checkedChange.subscribe(changed);
    fixture.componentRef.setInput('checked', true);
    fixture.detectChanges();

    const control = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '[role="switch"]',
    );
    expect(control?.getAttribute('aria-checked')).toBe('true');
    control?.click();
    expect(changed).toHaveBeenCalledWith(false);
  });
});
