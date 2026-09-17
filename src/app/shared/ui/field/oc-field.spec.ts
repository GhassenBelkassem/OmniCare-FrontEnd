import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OcField } from './oc-field';

@Component({
  imports: [OcField],
  template: `<oc-field controlId="request-reason" label="Reason" [required]="true" hint="Choose one" error="A reason is required"><input id="request-reason" /></oc-field>`,
})
class FieldHarness {}

describe('OcField', () => {
  let fixture: ComponentFixture<FieldHarness>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [FieldHarness] });
    fixture = TestBed.createComponent(FieldHarness);
    fixture.detectChanges();
  });

  it('provides deterministic label, hint, and error identifiers', () => {
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('label')?.getAttribute('for')).toBe('request-reason');
    expect(root.querySelector('#request-reason-label')?.textContent).toContain('Reason');
    expect(root.querySelector('#request-reason-hint')?.textContent).toContain('Choose one');
    expect(root.querySelector('#request-reason-error')?.getAttribute('role')).toBe('alert');
  });
});
