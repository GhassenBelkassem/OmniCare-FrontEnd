import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { OcButton, OcDialog, OcField, OcSelect, OcTextarea } from '../../shared/ui';

import { ClinicInformationReasonCode } from './clinic-api.models';
import { CLINIC_INFORMATION_REASON_OPTIONS, clinicInformationResponseExplanation } from './clinic-case-utils';

@Component({
  selector: 'app-clinic-information-dialog',
  imports: [ReactiveFormsModule, OcButton, OcDialog, OcField, OcSelect, OcTextarea],
  template: `
    <oc-dialog
      [open]="open()"
      title="Request information"
      [description]="'Choose what administrative information is needed from ' + requestLabel() + '.'"
      [error]="error()"
      initialFocus="#clinic-information-reason"
      [backdropDismissible]="true"
      [submitting]="isSubmitting()"
      [hasFooter]="true"
      (dismissed)="cancelled.emit()"
    >
      <form id="clinic-information-form" class="clinic-dialog__form" [formGroup]="form" (ngSubmit)="confirm()">
        <oc-field
          controlId="clinic-information-reason"
          label="Information needed"
          [required]="true"
          [error]="reasonInvalid() ? 'Select the information needed before continuing.' : null"
        >
          <oc-select
            controlId="clinic-information-reason"
            [options]="reasons"
            placeholder="Select a reason"
            ariaLabelledBy="clinic-information-reason-label"
            [ariaDescribedBy]="reasonInvalid() ? 'clinic-information-reason-error' : undefined"
            [invalid]="reasonInvalid()"
            formControlName="reasonCode"
          />
        </oc-field>
        @if (responseExplanation.length > 0) {
          <div class="clinic-dialog__response" aria-live="polite">
            <span>Patient will be asked to provide</span>
            <ul>
              @for (item of responseExplanation; track item) { <li>{{ item }}</li> }
            </ul>
          </div>
        }
        <oc-field
          controlId="clinic-information-instruction"
          label="Patient-safe instruction"
          hint="Optional. Keep the instruction patient-safe and under 240 characters."
        >
          <oc-textarea
            controlId="clinic-information-instruction"
            [rows]="3"
            [maxLength]="240"
            [showCount]="true"
            formControlName="patientInstruction"
            ariaLabelledBy="clinic-information-instruction-label"
            ariaDescribedBy="clinic-information-instruction-hint"
          />
        </oc-field>
      </form>
      <oc-button ocDialogFooter type="button" variant="secondary" [disabled]="isSubmitting()" (click)="cancelled.emit()">Cancel</oc-button>
      <oc-button ocDialogFooter type="submit" form="clinic-information-form" [loading]="isSubmitting()" [disabled]="form.invalid || isSubmitting()">Request information</oc-button>
    </oc-dialog>
  `,
  styleUrl: './clinic-decline-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClinicInformationDialog {
  readonly open = input(false);
  readonly requestLabel = input.required<string>();
  readonly selectedReason = input<ClinicInformationReasonCode | null>(null);
  readonly patientInstruction = input('');
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  readonly reasonChanged = output<ClinicInformationReasonCode | null>();
  readonly instructionChanged = output<string>();
  readonly confirmed = output<ClinicInformationReasonCode>();
  readonly cancelled = output<void>();
  get reasons() {
    return CLINIC_INFORMATION_REASON_OPTIONS;
  }
  get responseExplanation(): readonly string[] { return clinicInformationResponseExplanation(this.form.controls.reasonCode.value); }
  readonly form = new FormGroup({
    reasonCode: new FormControl<ClinicInformationReasonCode | null>(null, Validators.required),
    patientInstruction: new FormControl('', { nonNullable: true }),
  });

  private wasOpen = false;
  private readonly submissionRequested = signal(false);

  constructor() {
    this.form.controls.reasonCode.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((reason) => this.reasonChanged.emit(reason));
    this.form.controls.patientInstruction.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((instruction) => this.instructionChanged.emit(instruction));
    effect(() => {
      const isOpen = this.open();
      const selectedReason = this.selectedReason();
      const patientInstruction = this.patientInstruction();
      const loading = this.loading();
      const error = this.error();

      if (isOpen && !this.wasOpen) {
        this.form.reset(
          {
            reasonCode: selectedReason,
            patientInstruction,
          },
          { emitEvent: false },
        );
      } else if (!isOpen && this.wasOpen) {
        this.form.reset(
          {
            reasonCode: null,
            patientInstruction: '',
          },
          { emitEvent: false },
        );
      }

      if (loading) {
        this.form.disable({ emitEvent: false });
      } else {
        this.form.enable({ emitEvent: false });
      }
      if (!isOpen || error !== null) this.submissionRequested.set(false);
      this.wasOpen = isOpen;
    });
  }

  confirm(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.isSubmitting()) return;
    const reason = this.form.controls.reasonCode.value;
    if (reason !== null) {
      this.submissionRequested.set(true);
      this.confirmed.emit(reason);
    }
  }

  reasonInvalid(): boolean {
    const control = this.form.controls.reasonCode;
    return control.invalid && control.touched;
  }

  isSubmitting(): boolean {
    return this.loading() || this.submissionRequested();
  }
}
