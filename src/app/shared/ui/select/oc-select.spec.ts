import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';

import { OcSelect, OcSelectOption } from './oc-select';

const OPTIONS: readonly OcSelectOption[] = [
  { value: 'intake', label: 'Intake coordination' },
  { value: 'planning', label: 'Care planning' },
  { value: 'disabled', label: 'Unavailable', disabled: true },
];

@Component({
  imports: [ReactiveFormsModule, OcSelect],
  template: `<oc-select controlId="area" [options]="options" placeholder="Choose an area" [invalid]="control.invalid && control.touched" [formControl]="control" />`,
})
class SelectHarness {
  readonly options = OPTIONS;
  readonly control = new FormControl<string | null>(null, Validators.required);
}

describe('OcSelect', () => {
  let fixture: ComponentFixture<SelectHarness>;

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [SelectHarness] });
    fixture = TestBed.createComponent(SelectHarness);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('propagates static option selection through a reactive form', async () => {
    trigger().click();
    fixture.detectChanges();
    await fixture.whenStable();

    const option = Array.from(document.querySelectorAll('.oc-select__option')).find(
      (item) => item.textContent?.includes('Care planning'),
    ) as HTMLButtonElement;
    option.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.control.value).toBe('planning');
    expect(trigger().textContent).toContain('Care planning');
  });

  it('exposes required invalid semantics and CVA disabled state', () => {
    fixture.componentInstance.control.markAsTouched();
    fixture.detectChanges();
    expect(trigger().getAttribute('aria-invalid')).toBe('true');

    fixture.componentInstance.control.disable();
    fixture.detectChanges();
    expect(trigger().disabled).toBe(true);
  });

  it('opens from the keyboard and lets the overlay handle Escape dismissal', async () => {
    trigger().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(trigger().getAttribute('aria-expanded')).toBe('true');

    trigger().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('is constructible without browser-only initialization', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  function trigger(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('#area') as HTMLButtonElement;
  }
});
