import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { OcTextarea } from './oc-textarea';

@Component({
  imports: [ReactiveFormsModule, OcTextarea],
  template: `<oc-textarea controlId="instruction" [formControl]="control" [maxLength]="12" [showCount]="true" [invalid]="invalid" />`,
})
class TextareaHarness {
  readonly control = new FormControl('', { nonNullable: true });
  invalid = false;
}

describe('OcTextarea', () => {
  let fixture: ComponentFixture<TextareaHarness>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [TextareaHarness] });
    fixture = TestBed.createComponent(TextareaHarness);
    fixture.detectChanges();
  });

  it('propagates values, state, count, and disabled state through its CVA', () => {
    const textarea = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
    textarea.value = 'Patient note';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.componentInstance.control.value).toBe('Patient note');
    expect(fixture.nativeElement.textContent).toContain('12');

    fixture.componentInstance.invalid = true;
    fixture.componentInstance.control.disable();
    fixture.detectChanges();
    expect(textarea.disabled).toBe(true);
    expect(textarea.getAttribute('aria-invalid')).toBe('true');
  });

  it('is constructible without browser-only initialization', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
