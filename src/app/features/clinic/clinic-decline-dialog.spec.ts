import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClinicCaseDeclineReasonCode } from './clinic-api.models';
import { ClinicDeclineDialog } from './clinic-decline-dialog';

describe('ClinicDeclineDialog', () => {
  let fixture: ComponentFixture<ClinicDeclineDialog>;
  let component: ClinicDeclineDialog;

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [ClinicDeclineDialog] });
    fixture = TestBed.createComponent(ClinicDeclineDialog);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('requestLabel', 'Amina Trabelsi');
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('requires a decline reason and exposes a destructive dialog', () => {
    expect(confirmButton().disabled).toBe(true);
    expect(overlayRoot().querySelector('[role="dialog"]')).toBeTruthy();
    expect(overlayRoot().querySelector('.oc-dialog--destructive')).toBeTruthy();
    expect(overlayRoot().textContent).toContain('Destructive action');
  });

  it('emits the selected backend reason exactly once', () => {
    const confirmed: ClinicCaseDeclineReasonCode[] = [];
    component.confirmed.subscribe((reason) => confirmed.push(reason));
    fixture.componentRef.setInput('selectedReason', 'CAPACITY_UNAVAILABLE');
    fixture.detectChanges();

    confirmButton().click();
    confirmButton().click();

    expect(confirmed).toEqual(['CAPACITY_UNAVAILABLE']);
  });

  it('prevents submission while loading without discarding the selected reason', () => {
    fixture.componentRef.setInput('selectedReason', 'OUT_OF_SCOPE');
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();

    expect(confirmButton().disabled).toBe(true);
    component.confirm();
    expect(component.selectedReason()).toBe('OUT_OF_SCOPE');
  });

  it('keeps the dialog open after an error and exposes it to assistive technology', () => {
    fixture.componentRef.setInput('error', 'The request changed while you were reviewing it.');
    fixture.detectChanges();

    expect(overlayRoot().textContent).toContain('The request changed while you were reviewing it.');
    expect(overlayRoot().querySelector('[role="alert"]')).toBeTruthy();
  });

  function overlayRoot(): ParentNode {
    return document.querySelector('.cdk-overlay-container') ?? fixture.nativeElement;
  }

  function confirmButton(): HTMLButtonElement {
    return Array.from(overlayRoot().querySelectorAll('button')).find(
      (button) => button.textContent?.includes('Decline request'),
    ) as HTMLButtonElement;
  }
});
