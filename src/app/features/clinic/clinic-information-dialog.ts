import { ChangeDetectionStrategy, Component, effect, input, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { ClinicInformationReasonCode } from './clinic-api.models';
import { CLINIC_INFORMATION_REASON_OPTIONS, clinicInformationResponseExplanation } from './clinic-case-utils';

@Component({
  selector: 'app-clinic-information-dialog',
  imports: [ReactiveFormsModule],
  template: `
    @if (open()) {
      <div class="clinic-dialog-backdrop" (click)="cancelled.emit()">
        <section
          class="clinic-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="clinic-information-title"
          (click)="$event.stopPropagation()"
          (keydown.escape)="cancelled.emit()"
        >
          <header class="clinic-dialog__header">
            <div>
              <p class="clinic-intake-eyebrow">Patient action required</p>
              <h2 id="clinic-information-title">Request information</h2>
            </div>
            <button type="button" class="clinic-dialog__close" aria-label="Close request information dialog" (click)="cancelled.emit()">×</button>
          </header>
          <p class="clinic-dialog__copy">Choose what administrative information is needed from <strong>{{ requestLabel() }}</strong>.</p>
          <form class="clinic-dialog__form" [formGroup]="form" (ngSubmit)="confirm()">
            <div class="clinic-field">
              <span id="clinic-information-reason-label">Information needed</span>
              <select
                id="clinic-information-reason"
                aria-labelledby="clinic-information-reason-label"
                formControlName="reasonCode"
              >
                <option [ngValue]="null" disabled>Select a reason</option>
                @for (reason of reasons; track reason.value) {
                  <option [value]="reason.value">{{ reason.label }}</option>
                }
              </select>
            </div>
            @if (responseExplanation.length > 0) {
              <div class="clinic-field" aria-live="polite">
                <span>Patient will be asked to provide</span>
                <ul>
                  @for (item of responseExplanation; track item) { <li>{{ item }}</li> }
                </ul>
              </div>
            }
            <label class="clinic-field" for="clinic-information-instruction">
              <span>Patient-safe instruction</span>
              <textarea
                id="clinic-information-instruction"
                rows="3"
                maxlength="240"
                formControlName="patientInstruction"
                aria-label="Patient-safe instruction"
              ></textarea>
            </label>
            <footer class="clinic-dialog__footer">
              <button type="button" class="clinic-dialog__cancel" (click)="cancelled.emit()">Cancel</button>
              <button type="submit" class="clinic-dialog__confirm" [disabled]="form.invalid || loading()">Request information</button>
            </footer>
          </form>
        </section>
      </div>
    }
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
  readonly reasonChanged = output<ClinicInformationReasonCode | null>();
  readonly instructionChanged = output<string>();
  readonly confirmed = output<ClinicInformationReasonCode>();
  readonly cancelled = output<void>();
  readonly reasons = CLINIC_INFORMATION_REASON_OPTIONS;
  get responseExplanation(): readonly string[] { return clinicInformationResponseExplanation(this.form.controls.reasonCode.value); }
  readonly form = new FormGroup({
    reasonCode: new FormControl<ClinicInformationReasonCode | null>(null, Validators.required),
    patientInstruction: new FormControl('', { nonNullable: true }),
  });

  private wasOpen = false;

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
      this.wasOpen = isOpen;
    });
  }

  confirm(): void {
    if (this.form.invalid || this.loading()) return;
    const reason = this.form.controls.reasonCode.value;
    if (reason !== null) this.confirmed.emit(reason);
  }
}
