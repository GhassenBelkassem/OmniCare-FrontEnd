import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { Subscription } from 'rxjs';

import { OcButton } from '../../shared/ui';
import {
  ArtifactVerificationApiService,
  isWellFormedReference,
  verificationFailureView,
  verificationView,
  type VerificationView,
} from './artifact-verification';

/**
 * `/verifier/:ref` — public page (no login) opened by scanning the QR code of a signed document.
 * Shows only the document type, the issuing doctor, the date and « Valide » / « Invalide ».
 */
@Component({
  selector: 'app-artifact-verification-page',
  imports: [NzIconModule, OcButton],
  template: `
    <main class="verify">
      <section class="verify__card" aria-labelledby="verify-title" [attr.aria-busy]="view().kind === 'loading'">
        <p class="verify__brand">OmniCare</p>
        <h1 id="verify-title">Vérification d’un document OmniCare</h1>

        @switch (view().kind) {
          @case ('loading') {
            <p class="verify__message" role="status">Vérification en cours…</p>
          }
          @case ('valid') {
            @if (validView(); as valid) {
              <div class="verify__status verify__status--valid" role="status">
                <span nz-icon nzType="check-circle" nzTheme="outline" aria-hidden="true"></span>
                <strong>Valide</strong>
              </div>
              <p class="verify__type">{{ valid.typeLabel }}</p>
              @if (valid.issuer) {
                <p class="verify__line">Émis par {{ valid.issuer }}</p>
              }
              @if (valid.signedOn) {
                <p class="verify__line">le {{ valid.signedOn }}</p>
              }
              <p class="verify__note">Ce document a bien été signé par ce médecin sur OmniCare.</p>
            }
          }
          @case ('invalid') {
            <div class="verify__status verify__status--invalid" role="alert">
              <span nz-icon nzType="exclamation-circle" nzTheme="outline" aria-hidden="true"></span>
              <strong>Invalide</strong>
            </div>
            <p class="verify__message">Ce document n’a pas pu être vérifié.</p>
          }
          @case ('rate-limited') {
            <p class="verify__message" role="alert">Trop de vérifications. Réessayez dans une minute.</p>
            <oc-button variant="secondary" [fullWidth]="true" (click)="retry()">Réessayer</oc-button>
          }
          @case ('unavailable') {
            <p class="verify__message" role="alert">
              La vérification n’a pas pu aboutir. Vérifiez votre connexion internet puis réessayez.
            </p>
            <oc-button variant="secondary" [fullWidth]="true" (click)="retry()">Réessayer</oc-button>
          }
        }

        <p class="verify__footer">
          Cette page confirme uniquement l’authenticité du document. Elle n’affiche aucune information médicale.
        </p>
      </section>
    </main>
  `,
  styles: `
    :host { display: block; }
    .verify {
      box-sizing: border-box;
      min-height: 100dvh;
      display: grid;
      align-content: start;
      justify-items: center;
      padding: var(--oc-space-6) var(--oc-space-4);
      background: var(--oc-color-surface-app);
      color: var(--oc-color-text-primary);
      font-family: var(--oc-font-family);
    }
    .verify__card {
      box-sizing: border-box;
      width: 100%;
      max-width: 28rem;
      display: grid;
      gap: var(--oc-space-3);
      padding: var(--oc-space-6) var(--oc-space-4);
      border: 1px solid var(--oc-hairline);
      border-radius: var(--oc-radius-card);
      background: var(--oc-color-surface-card);
      box-shadow: var(--oc-shadow-soft);
    }
    .verify__brand { margin: 0; color: var(--oc-color-text-link); font-weight: var(--oc-font-weight-semibold); }
    h1 { margin: 0; font-size: var(--oc-text-h2-size); line-height: var(--oc-text-h2-line-height); font-weight: var(--oc-text-h2-weight); }
    .verify__status {
      display: flex;
      align-items: center;
      gap: var(--oc-space-2);
      padding: var(--oc-space-3) var(--oc-space-4);
      border: 1px solid;
      border-radius: var(--oc-radius-tile);
      font-size: var(--oc-text-h3-size);
    }
    .verify__status strong { font-weight: var(--oc-font-weight-heavy); }
    .verify__status [nz-icon] { font-size: 24px; }
    .verify__status--valid { border-color: var(--oc-color-success); background: var(--oc-color-success-surface); color: var(--oc-info-care); }
    .verify__status--invalid { border-color: var(--oc-error); background: var(--oc-error-tint); color: var(--oc-error-dark); }
    .verify__type { margin: 0; font-size: var(--oc-text-h3-size); font-weight: var(--oc-text-h3-weight); }
    .verify__line, .verify__message { margin: 0; color: var(--oc-color-text-secondary); }
    .verify__note, .verify__footer { margin: 0; color: var(--oc-color-text-muted); font-size: var(--oc-text-small-size); }
    .verify__footer { padding-top: var(--oc-space-3); border-top: 1px solid var(--oc-hairline); }
    @media (min-width: 40rem) {
      .verify { align-content: center; }
      .verify__card { padding: var(--oc-space-8); }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArtifactVerificationPage {
  private readonly api = inject(ArtifactVerificationApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ref = inject(ActivatedRoute).snapshot.paramMap.get('ref');
  private request: Subscription | null = null;

  readonly view = signal<VerificationView>({ kind: 'loading' });

  constructor() {
    this.verify();
  }

  validView(): Extract<VerificationView, { kind: 'valid' }> | null {
    const view = this.view();
    return view.kind === 'valid' ? view : null;
  }

  retry(): void {
    this.verify();
  }

  private verify(): void {
    this.request?.unsubscribe();
    if (!isWellFormedReference(this.ref)) {
      this.view.set({ kind: 'invalid' });
      return;
    }
    this.view.set({ kind: 'loading' });
    this.request = this.api
      .verify(this.ref)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (body) => this.view.set(verificationView(body)),
        error: (error: unknown) => this.view.set(verificationFailureView(error)),
      });
  }
}
