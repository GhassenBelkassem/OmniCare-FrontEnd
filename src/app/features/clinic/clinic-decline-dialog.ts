import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';

import { OcButton, OcDialog, OcField, OcSelect } from '../../shared/ui';

import { ClinicCaseDeclineReasonCode } from './clinic-api.models';
import { CLINIC_CASE_DECLINE_REASON_OPTIONS } from './clinic-case-utils';

@Component({
  selector: 'app-clinic-decline-dialog',
  imports: [ReactiveFormsModule, OcButton, OcDialog, OcField, OcSelect],
  template: `
    <oc-dialog
      [open]="open()"
      title="Decline request"
      [description]="'Choose an internal reason for ' + requestLabel() + '.'"
      [error]="error()"
      intent="destructive"
      initialFocus="#clinic-decline-reason"
      [submitting]="isSubmitting()"
      [hasFooter]="true"
      (dismissed)="cancelled.emit()"
    >
      <oc-field
        controlId="clinic-decline-reason"
        label="Internal reason"
        [required]="true"
        [error]="reasonInvalid() ? 'Select an internal reason before declining this request.' : null"
      >
        <oc-select
          controlId="clinic-decline-reason"
          [options]="reasons"
          placeholder="Select a reason"
          ariaLabelledBy="clinic-decline-reason-label"
          [ariaDescribedBy]="reasonInvalid() ? 'clinic-decline-reason-error' : undefined"
          [invalid]="reasonInvalid()"
          [formControl]="reasonControl"
        />
      </oc-field>
      <oc-button ocDialogFooter type="button" variant="secondary" [disabled]="isSubmitting()" (click)="cancelled.emit()">Cancel</oc-button>
      <oc-button ocDialogFooter type="button" variant="destructive" [loading]="isSubmitting()" [disabled]="reasonControl.invalid || isSubmitting()" (click)="confirm()">Decline request</oc-button>
    </oc-dialog>
  `,
  styleUrl: './clinic-decline-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClinicDeclineDialog {
  readonly open = input(false);
  readonly requestLabel = input.required<string>();
  readonly selectedReason = input<ClinicCaseDeclineReasonCode | null>(null);
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  readonly reasonChanged = output<ClinicCaseDeclineReasonCode | null>();
  readonly confirmed = output<ClinicCaseDeclineReasonCode>();
  readonly cancelled = output<void>();
  readonly reasons = CLINIC_CASE_DECLINE_REASON_OPTIONS;
  readonly reasonControl = new FormControl<ClinicCaseDeclineReasonCode | null>(null, Validators.required);
  private readonly submissionRequested = signal(false);

  constructor() {
    this.reasonControl.valueChanges.subscribe((reason) => this.reasonChanged.emit(reason));
    effect(() => {
      const selectedReason = this.selectedReason();
      if (this.reasonControl.value !== selectedReason) this.reasonControl.setValue(selectedReason, { emitEvent: false });
      if (this.isSubmitting()) this.reasonControl.disable({ emitEvent: false });
      else this.reasonControl.enable({ emitEvent: false });
      if (!this.open() || this.error() !== null) this.submissionRequested.set(false);
    });
  }

  confirm(): void {
    this.reasonControl.markAsTouched();
    const reason = this.reasonControl.value;
    if (reason !== null && !this.isSubmitting()) {
      this.submissionRequested.set(true);
      this.confirmed.emit(reason);
    }
  }

  isSubmitting(): boolean {
    return this.loading() || this.submissionRequested();
  }

  reasonInvalid(): boolean {
    return this.reasonControl.invalid && this.reasonControl.touched;
  }
}
