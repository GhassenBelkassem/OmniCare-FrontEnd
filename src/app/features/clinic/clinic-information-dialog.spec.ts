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

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ClinicInformationDialog],
    });

    fixture = TestBed.createComponent(ClinicInformationDialog);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('requestLabel', 'Amina Trabelsi');
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
  });

  it('renders every backend-supported controlled reason option', () => {
    expect(component.reasons.map((option) => option.value)).toEqual([
      ...CLINIC_INFORMATION_REASON_CODES,
    ]);
    expect(component.reasons.map((option) => option.label)).toEqual(
      CLINIC_INFORMATION_REASON_OPTIONS.map((option) => option.label),
    );
  });

  it('renders an enabled native select with every controlled reason', () => {
    const select = reasonSelect();

    expect(component.form.controls.reasonCode.enabled).toBe(true);
    expect(select.disabled).toBe(false);
    expect(select.options).toHaveLength(component.reasons.length + 1);
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
    expect(reasonSelect().disabled).toBe(false);
    expect(confirmButton().disabled).toBe(false);

    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();

    expect(component.form.controls.reasonCode.disabled).toBe(true);
    expect(reasonSelect().disabled).toBe(true);
    expect(confirmButton().disabled).toBe(true);

    fixture.componentRef.setInput('loading', false);
    fixture.detectChanges();

    expect(component.form.controls.reasonCode.enabled).toBe(true);
    expect(reasonSelect().disabled).toBe(false);
    expect(confirmButton().disabled).toBe(false);
  });

  function reasonSelect(): HTMLSelectElement {
    return fixture.nativeElement.querySelector('#clinic-information-reason') as HTMLSelectElement;
  }

  function confirmButton(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('.clinic-dialog__confirm') as HTMLButtonElement;
  }
});
