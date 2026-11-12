import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { NzIconModule } from 'ng-zorro-antd/icon';

import { OcButton } from '../../../shared/ui';
import { ActiveConsultationApiService } from '../active-consultation-api.service';
import type { AccessRequestState } from '../active-consultation.models';

/** Shown when the doctor's access was revoked by the patient or expired (existing wording). */
export const ACCESS_REVOKED_MESSAGE = 'Votre accès au dossier médical de ce patient a été retiré.';

const PASSIVE_MESSAGE =
  'Les données médicales de ce patient sont chiffrées. Le patient peut vous accorder l’accès depuis son application OmniCare.';

const ERROR_MESSAGES: Readonly<Record<string, string>> = {
  ACCESS_REQUEST_ALREADY_PENDING: 'Une demande d’accès est déjà en attente de réponse.',
  ACCESS_REQUEST_LIMIT_REACHED: 'Vous avez atteint le nombre maximal de demandes d’accès pour cette consultation.',
  ACCESS_ALREADY_GRANTED: 'Le patient vous a déjà donné accès à son dossier.',
  CONSULTATION_NOT_IN_PROGRESS: 'La consultation n’est plus en cours.',
  ACCESS_REQUEST_NOT_PENDING: 'Cette demande n’est plus en attente.',
};

/** French message for a failed request / cancel; never a raw code. */
export function accessRequestErrorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    const body = error.error as { errorCode?: string; code?: string } | null;
    const code = body?.errorCode ?? body?.code;
    if (code && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
    if (error.status === 409) return 'La demande n’a pas pu être prise en compte. La page a été actualisée.';
  }
  return 'La demande n’a pas pu être envoyée. Réessayez.';
}

type PanelState = 'revoked' | 'pending' | 'refused' | 'limit' | 'can-request' | 'passive';

/**
 * G-1 D2: « Demander l'accès » for an OmniCare patient during the doctor's consultation, on
 * the chart page and in the consultation. The server decides (canRequest, limit, statuses);
 * the patient answers in their app, and the page updates live on CLINICAL_ACCESS_CHANGED.
 */
@Component({
  selector: 'app-access-request-panel',
  imports: [NzIconModule, OcButton],
  template: `
    <div class="ar" role="status" aria-live="polite" data-testid="access-request-panel" [attr.data-state]="view()">
      <span class="ar__icon" aria-hidden="true"><nz-icon nzType="lock" /></span>
      <div class="ar__body">
        <p class="ar__title">{{ title() }}</p>
        <p class="ar__text">{{ text() }}</p>
        @if (view() === 'pending') { <p class="ar__text" data-testid="access-request-hint">Le patient peut accepter depuis son application, dans « Mes rendez-vous ».</p> }
        @if (error(); as message) { <p class="ar__error" role="alert">{{ message }}</p> }
        <div class="ar__actions">
          @if (view() === 'pending') {
            <oc-button variant="ghost" size="small" [loading]="busy()" (click)="cancel()" data-testid="access-request-cancel">Annuler la demande</oc-button>
          } @else if (state()?.canRequest) {
            <oc-button variant="primary" size="small" [loading]="busy()" (click)="request()" data-testid="access-request-send">
              {{ view() === 'refused' || view() === 'revoked' ? 'Redemander' : 'Demander l’accès' }}
            </oc-button>
          }
        </div>
      </div>
    </div>
  `,
  styles: `
    .ar { display: flex; gap: var(--oc-space-3); align-items: flex-start; padding: var(--oc-space-3) var(--oc-space-4);
      border-radius: var(--oc-radius-tile); background: var(--oc-tile); }
    .ar__icon { display: inline-grid; flex: 0 0 36px; width: 36px; height: 36px; place-items: center;
      border-radius: var(--oc-radius-icon); background: var(--oc-info-care-tint); color: var(--oc-info-care-icon); }
    .ar__body { display: grid; gap: 2px; min-width: 0; }
    .ar__title { margin: 0; color: var(--oc-ink); font-size: 15px; font-weight: var(--oc-font-weight-strong); }
    .ar__text { margin: 0; color: var(--oc-ink-secondary); font-size: var(--oc-text-small-size); line-height: var(--oc-text-small-line-height); }
    .ar__error { margin: var(--oc-space-1) 0 0; color: var(--oc-error-dark); font-size: var(--oc-text-small-size); }
    .ar__actions { display: flex; flex-wrap: wrap; gap: var(--oc-space-2); margin-top: var(--oc-space-2); }
    .ar__actions:empty { display: none; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccessRequestPanel {
  private readonly api = inject(ActiveConsultationApiService);
  private readonly destroyRef = inject(DestroyRef);
  private command: { readonly signature: string; readonly key: string } | null = null;

  /** The doctor's consultation in progress with this patient. */
  readonly consultationId = input.required<string>();
  readonly state = input<AccessRequestState | null>(null);
  /** Access was granted earlier and is now revoked or expired. */
  readonly revoked = input(false);
  readonly stateChange = output<AccessRequestState>();

  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  readonly view = computed((): PanelState => {
    const state = this.state();
    const status = state?.request?.status ?? null;
    if (status === 'PENDING') return 'pending';
    if (this.revoked()) return 'revoked';
    if (status === 'REFUSED') return 'refused';
    if (state && !state.canRequest && state.used >= state.max) return 'limit';
    if (state?.canRequest) return 'can-request';
    return 'passive';
  });

  readonly title = computed(() => {
    switch (this.view()) {
      case 'pending': return 'Demande envoyée…';
      case 'revoked': return 'Accès retiré';
      case 'refused': return 'Le patient a refusé l’accès.';
      default: return 'Accès requis';
    }
  });

  readonly text = computed(() => {
    switch (this.view()) {
      case 'pending': return 'Le patient répond depuis son application OmniCare. Cette page se met à jour automatiquement.';
      case 'revoked': return ACCESS_REVOKED_MESSAGE;
      case 'refused': return 'Vous pouvez redemander l’accès si nécessaire.';
      case 'limit': return 'Vous avez atteint le nombre maximal de demandes d’accès pour cette consultation.';
      case 'can-request': return 'Les données médicales de ce patient sont chiffrées. Demandez l’accès : le patient répond depuis son application OmniCare.';
      default: return PASSIVE_MESSAGE;
    }
  });

  request(): void {
    if (this.busy()) return;
    this.run(`request:${this.state()?.used ?? 0}`, (key) => this.api.requestAccess(this.consultationId(), key));
  }

  cancel(): void {
    const request = this.state()?.request;
    if (this.busy() || !request || request.status !== 'PENDING') return;
    this.run(`cancel:${request.requestId}:${request.version}`,
      (key) => this.api.cancelAccessRequest(this.consultationId(), request.requestId, request.version, key));
  }

  /** Same key while the same command is retried after an ambiguous failure. */
  private run(signature: string, call: (key: string) => ReturnType<ActiveConsultationApiService['requestAccess']>): void {
    if (this.command?.signature !== signature) {
      this.command = { signature, key: `access-request:${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}` };
    }
    this.busy.set(true);
    this.error.set(null);
    call(this.command.key).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (state) => {
        this.busy.set(false);
        this.command = null;
        this.stateChange.emit(state);
      },
      error: (failure: unknown) => {
        this.busy.set(false);
        const ambiguous = !(failure instanceof HttpErrorResponse) || failure.status === 0 || failure.status >= 500;
        if (!ambiguous) this.command = null;
        this.error.set(accessRequestErrorMessage(failure));
      },
    });
  }
}
