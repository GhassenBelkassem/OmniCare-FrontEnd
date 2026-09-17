import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzSelectModule } from 'ng-zorro-antd/select';

import { ClinicCaseDeclineReasonCode } from './clinic-api.models';
import { CLINIC_CASE_DECLINE_REASON_OPTIONS } from './clinic-case-utils';

@Component({
  selector: 'app-clinic-decline-dialog',
  imports: [FormsModule, NzSelectModule],
  template: `
    @if (open()) {
      <div class="clinic-dialog-backdrop" (click)="cancelled.emit()">
        <section
          class="clinic-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="clinic-decline-title"
          (click)="$event.stopPropagation()"
          (keydown.escape)="cancelled.emit()"
        >
          <header class="clinic-dialog__header">
            <div>
              <p class="clinic-intake-eyebrow">Per-case action</p>
              <h2 id="clinic-decline-title">Decline request</h2>
            </div>
            <button type="button" class="clinic-dialog__close" aria-label="Close decline dialog" (click)="cancelled.emit()">×</button>
          </header>
          <p class="clinic-dialog__copy">Choose an internal reason for <strong>{{ requestLabel() }}</strong>.</p>
          <label class="clinic-field" for="clinic-decline-reason">
            <span>Internal reason</span>
            <nz-select
              id="clinic-decline-reason"
              nzSize="small"
              nzPlaceHolder="Select a reason"
              aria-label="Internal reason"
              [ngModel]="selectedReason()"
              (ngModelChange)="reasonChanged.emit($event)"
            >
              @for (reason of reasons; track reason.value) {
                <nz-option [nzValue]="reason.value" [nzLabel]="reason.label" />
              }
            </nz-select>
          </label>
          <footer class="clinic-dialog__footer">
            <button type="button" class="clinic-dialog__cancel" (click)="cancelled.emit()">Cancel</button>
            <button type="button" class="clinic-dialog__confirm" [disabled]="selectedReason() === null || loading()" (click)="confirm()">Decline request</button>
          </footer>
        </section>
      </div>
    }
  `,
  styleUrl: './clinic-decline-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClinicDeclineDialog {
  readonly open = input(false);
  readonly requestLabel = input.required<string>();
  readonly selectedReason = input<ClinicCaseDeclineReasonCode | null>(null);
  readonly loading = input(false);
  readonly reasonChanged = output<ClinicCaseDeclineReasonCode | null>();
  readonly confirmed = output<ClinicCaseDeclineReasonCode>();
  readonly cancelled = output<void>();
  readonly reasons = CLINIC_CASE_DECLINE_REASON_OPTIONS;

  confirm(): void {
    const reason = this.selectedReason();
    if (reason !== null) this.confirmed.emit(reason);
  }
}
