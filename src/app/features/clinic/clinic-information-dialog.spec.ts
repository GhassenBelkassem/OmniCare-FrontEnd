import { ComponentFixture, TestBed } from '@angular/core/testing';

import {
  CLINIC_INFORMATION_REASON_CODES,
  ClinicInformationReasonCode,
} from './clinic-api.models';
import { CLINIC_INFORMATION_REASON_OPTIONS } from './clinic-case-utils';
import { ClinicInformationDialog } from './clinic-information-dialog';

describe('ClinicInformationDialog', () => {
  let fixture: ComponentFixture<ClinicInformationDialog>;
  let component: ClinicInformationDialog;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [ClinicInformationDialog],
    });

    fixture = TestBed.createComponent(ClinicInformationDialog);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('requestLabel', 'Amina Trabelsi');
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('renders every backend-supported controlled reason option', () => {
    expect(component.reasons.map((option) => option.value)).toEqual([
      ...CLINIC_INFORMATION_REASON_CODES,
    ]);
    expect(component.reasons.map((option) => option.label)).toEqual(
      CLINIC_INFORMATION_REASON_OPTIONS.map((option) => option.label),
    );
  });

  it('renders an enabled Spartan select trigger for the controlled reasons', () => {
    const select = reasonTrigger();

    expect(component.form.controls.reasonCode.enabled).toBe(true);
    expect(select.disabled).toBe(false);
    expect(select.getAttribute('role')).toBe('combobox');
  });

  it('emits the selected backend enum value without converting it to the label', () => {
    const confirmed: ClinicInformationReasonCode[] = [];
    component.confirmed.subscribe((reason) => confirmed.push(reason));

    component.form.controls.reasonCode.setValue('REQUEST_ADMINISTRATIVE_DETAILS');
    fixture.detectChanges();
    confirmButton().click();
    fixture.detectChanges();

    expect(confirmed).toEqual(['REQUEST_ADMINISTRATIVE_DETAILS']);
  });

  it('emits a valid request only once while the parent action is becoming loading', () => {
    const confirmed: ClinicInformationReasonCode[] = [];
    component.confirmed.subscribe((reason) => confirmed.push(reason));
    component.form.controls.reasonCode.setValue('CONTACT_INFORMATION');

    component.confirm();
    component.confirm();

    expect(confirmed).toEqual(['CONTACT_INFORMATION']);
  });

  it('does not emit for an invalid form and marks the required field as invalid', () => {
    const confirmed: ClinicInformationReasonCode[] = [];
    component.confirmed.subscribe((reason) => confirmed.push(reason));

    component.confirm();
    fixture.detectChanges();

    expect(confirmed).toEqual([]);
    expect(reasonTrigger().getAttribute('aria-invalid')).toBe('true');
    expect(dialogRoot().querySelector('[role="alert"]')?.textContent).toContain('Select the information needed');
  });

  it('keeps submit disabled until reasonCode makes the form valid', () => {
    expect(confirmButton().disabled).toBe(true);

    component.form.controls.reasonCode.setValue('CONTACT_INFORMATION');
    fixture.detectChanges();

    expect(confirmButton().disabled).toBe(false);
  });

  it('resets safely after close and reopen', () => {
    component.form.setValue({
      reasonCode: 'AVAILABILITY_INFORMATION',
      patientInstruction: 'Please confirm your weekday availability.',
    });
    fixture.detectChanges();

    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();

    expect(component.form.getRawValue()).toEqual({
      reasonCode: null,
      patientInstruction: '',
    });

    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();

    expect(component.form.getRawValue()).toEqual({
      reasonCode: null,
      patientInstruction: '',
    });
    expect(confirmButton().disabled).toBe(true);
  });

  it('disables the select and submit only while the request mutation is active', () => {
    component.form.controls.reasonCode.setValue('OTHER_ADMINISTRATIVE');
    fixture.detectChanges();
    expect(reasonTrigger().disabled).toBe(false);
    expect(confirmButton().disabled).toBe(false);

    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();

    expect(component.form.controls.reasonCode.disabled).toBe(true);
    expect(reasonTrigger().disabled).toBe(true);
    expect(confirmButton().disabled).toBe(true);

    fixture.componentRef.setInput('loading', false);
    fixture.detectChanges();

    expect(component.form.controls.reasonCode.enabled).toBe(true);
    expect(reasonTrigger().disabled).toBe(false);
    expect(confirmButton().disabled).toBe(false);
  });

  it('keeps the dialog content and entered instruction after a server error', () => {
    component.form.setValue({ reasonCode: 'OTHER_ADMINISTRATIVE', patientInstruction: 'Please add the missing document.' });
    fixture.componentRef.setInput('error', 'This request changed while you were reviewing it.');
    fixture.detectChanges();

    expect(reasonTrigger().textContent).toContain('Other administrative information');
    expect((dialogRoot().querySelector('#clinic-information-instruction') as HTMLTextAreaElement).value).toBe('Please add the missing document.');
    expect(dialogRoot().querySelector('[role="alert"]')?.textContent).toContain('This request changed');
  });

  function dialogRoot(): ParentNode {
    return document.querySelector('.cdk-overlay-container') ?? fixture.nativeElement;
  }

  function reasonTrigger(): HTMLButtonElement {
    return dialogRoot().querySelector('#clinic-information-reason') as HTMLButtonElement;
  }

  function confirmButton(): HTMLButtonElement {
    return Array.from(dialogRoot().querySelectorAll('button')).find(
      (button) => button.textContent?.includes('Request information'),
    ) as HTMLButtonElement;
  }
});
