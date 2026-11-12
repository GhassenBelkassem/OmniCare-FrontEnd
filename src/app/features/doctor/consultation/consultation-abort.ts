import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { firstValueFrom } from 'rxjs';

import { normalizeHttpError } from '../../../core/http/app-http-error';
import { OcButton } from '../../../shared/ui';
import { ActiveConsultationApiService } from '../active-consultation-api.service';
import type { ConsultationAbortReason } from '../active-consultation.models';
import { ActiveConsultationStore } from '../active-consultation.store';
import { ConsultationFinishFlow } from './consultation-finish.flow';
import { ConsultationSessionStore } from './consultation-session.store';
import { consultationErrorMessage } from './model/consultation-errors';

export interface AbortReasonOption {
  readonly value: ConsultationAbortReason;
  readonly label: string;
  readonly consequence: string;
}

/**
 * The four reasons (CTO decision, G-1 P3a) and what each does to the appointment, in one line.
 * « Démarrée par erreur » / « Problème technique »: back to « Confirmé » while the slot has not
 * started (Africa/Tunis), cancelled otherwise; `slotStart` unknown says both.
 */
export function abortReasonOptions(slotStart: string | null, now: Date = new Date()): readonly AbortReasonOption[] {
  const start = slotStart === null ? Number.NaN : Date.parse(slotStart);
  const back = Number.isNaN(start)
    ? 'Le rendez-vous redevient confirmé si son horaire n’est pas encore passé, sinon il est annulé.'
    : start >= now.getTime()
      ? 'Le rendez-vous redevient confirmé.'
      : 'Le rendez-vous sera annulé (son horaire est passé).';
  return [
    { value: 'PATIENT_ABSENT', label: 'Patient absent', consequence: 'Le rendez-vous sera marqué absent.' },
    { value: 'PATIENT_LEFT', label: 'Patient parti avant la fin', consequence: 'Le rendez-vous sera annulé.' },
    { value: 'STARTED_BY_MISTAKE', label: 'Démarrée par erreur', consequence: back },
    { value: 'TECHNICAL_ISSUE', label: 'Problème technique', consequence: back },
  ];
}

/**
 * « Annuler la consultation »: header action (IN_PROGRESS, nothing signed, no closure running) and
 * its confirmation dialog. On success the autosave stops and the page shows « Consultation annulée ».
 */
@Component({
  selector: 'app-consultation-abort',
  imports: [FormsModule, NzModalModule, NzRadioModule, OcButton],
  template: `
    @if (available()) {
      <oc-button variant="ghost" size="small" class="c-abort" data-testid="abort-action" (click)="openDialog()">
        Annuler la consultation
      </oc-button>
    }

    <nz-modal
      [nzVisible]="open()"
      nzTitle="Annuler la consultation ?"
      [nzClosable]="!busy()"
      [nzMaskClosable]="!busy()"
      [nzKeyboard]="!busy()"
      [nzFooter]="footer"
      (nzOnCancel)="close()"
    >
      <ng-container *nzModalContent>
        <p class="c-abort__intro" id="abort-reason-label">Pourquoi la consultation est-elle annulée ?</p>
        <nz-radio-group class="c-abort__reasons" aria-labelledby="abort-reason-label" [ngModel]="reason()" (ngModelChange)="selectReason($event)">
          @for (option of options(); track option.value) {
            <label nz-radio class="c-abort__reason" [nzValue]="option.value" [attr.data-reason]="option.value">
              <span class="c-abort__label">{{ option.label }}</span>
              <span class="c-abort__consequence">{{ option.consequence }}</span>
            </label>
          }
        </nz-radio-group>
        <p class="c-abort__note">Les brouillons non signés sont écartés. La note reste conservée mais n’apparaît pas dans le dossier du patient.</p>
        @if (error(); as message) { <p class="c-abort__error" role="alert">{{ message }}</p> }
      </ng-container>
    </nz-modal>
    <ng-template #footer>
      <oc-button variant="secondary" [disabled]="busy()" (click)="close()">Revenir</oc-button>
      <oc-button variant="destructive" data-testid="abort-confirm" [disabled]="reason() === null" [loading]="busy()" (click)="confirm()">
        Annuler la consultation
      </oc-button>
    </ng-template>
  `,
  styles: `
    :host { display: contents; }
    /* Ghost danger: the ghost button in the error text colour (AA on white). */
    .c-abort { --oc-color-text-secondary: var(--oc-error-dark); --oc-color-text-primary: var(--oc-error-dark); }
    .c-abort__intro { margin: 0 0 var(--oc-space-3); color: var(--oc-ink); font-weight: var(--oc-font-weight-semibold); }
    .c-abort__reasons { display: grid; gap: var(--oc-space-2); width: 100%; }
    .c-abort__reason {
      display: flex; align-items: flex-start; margin: 0; padding: var(--oc-space-3);
      border: 1px solid var(--oc-hairline); border-radius: var(--oc-radius-icon);
    }
    .c-abort__reason.ant-radio-wrapper-checked { border-color: var(--oc-primary); background: var(--oc-info-care-tint); }
    .c-abort__label { display: block; color: var(--oc-ink); font-weight: var(--oc-font-weight-semibold); }
    .c-abort__consequence { display: block; color: var(--oc-ink-secondary); font-size: var(--oc-text-small-size); }
    .c-abort__note { margin: var(--oc-space-3) 0 0; color: var(--oc-ink-secondary); font-size: var(--oc-text-small-size); }
    .c-abort__error { margin: var(--oc-space-3) 0 0; color: var(--oc-error-dark); font-weight: var(--oc-font-weight-semibold); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConsultationAbort {
  private readonly session = inject(ConsultationSessionStore);
  private readonly flow = inject(ConsultationFinishFlow);
  private readonly api = inject(ActiveConsultationApiService);
  private readonly activeConsultation = inject(ActiveConsultationStore);
  private key: { readonly operation: string; readonly value: string } | null = null;

  readonly open = signal(false);
  readonly busy = signal(false);
  readonly reason = signal<ConsultationAbortReason | null>(null);
  readonly error = signal<string | null>(null);

  /** Only while IN_PROGRESS, before anything is signed and outside a « Terminer » run. */
  readonly available = computed(() =>
    this.session.consultation()?.status === 'IN_PROGRESS'
    && this.session.loadState() === 'ready'
    && !this.session.hasSignedItems()
    && !this.flow.busy());

  readonly options = computed(() => abortReasonOptions(this.session.appointmentStartAt()));

  openDialog(): void {
    this.reason.set(null);
    this.error.set(null);
    this.open.set(true);
  }

  close(): void {
    if (this.busy()) return;
    this.open.set(false);
  }

  selectReason(value: ConsultationAbortReason): void {
    this.reason.set(value);
    this.error.set(null);
  }

  async confirm(): Promise<void> {
    const reason = this.reason();
    const consultation = this.session.consultation();
    if (reason === null || consultation === null || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      const result = await firstValueFrom(this.api.abort(
        consultation.consultationId, reason, consultation.version, this.keyFor(`${reason}:${consultation.version}`),
      ));
      this.key = null;
      this.session.stopAutosave();
      this.session.consultation.set(result);
      this.open.set(false);
      void this.activeConsultation.refresh().catch(() => undefined);
    } catch (raw: unknown) {
      // Same key on an ambiguous failure (network, 5xx) so a retry replays instead of aborting twice.
      if (!(raw instanceof HttpErrorResponse && (raw.status === 0 || raw.status >= 500))) this.key = null;
      this.error.set(consultationErrorMessage(normalizeHttpError(raw)));
    } finally {
      this.busy.set(false);
    }
  }

  private keyFor(operation: string): string {
    if (this.key?.operation !== operation) {
      this.key = { operation, value: `consultation-abort:${globalThis.crypto.randomUUID()}` };
    }
    return this.key.value;
  }
}
