import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { NzTagModule } from 'ng-zorro-antd/tag';

import { OcButton, OcDateBlock } from '../../../../shared/ui';
import type { ConsultationSummary } from '../../medical-record.models';
import { ChartAccessRequired } from '../../patient-chart/chart-access-required';
import { ACCESS_REVOKED_MESSAGE, AccessRequestPanel } from '../../patient-chart/access-request-panel';
import { ConsultationSessionStore, summaryFromEssential } from '../consultation-session.store';
import { ConsultationUi } from '../consultation-ui';

/** Right column: the patient's medical summary and recent history, read-only. */
@Component({
  selector: 'app-medical-context-card',
  imports: [NzIconModule, NzSkeletonModule, NzTagModule, OcButton, OcDateBlock, AccessRequestPanel, ChartAccessRequired],
  template: `
    <section class="c-card" aria-labelledby="context-title">
      <header class="c-card__header">
        <div class="c-card__title">
          <span class="x-tile x-tile--care" aria-hidden="true"><nz-icon nzType="medicine-box" /></span>
          <h2 id="context-title">Dossier médical</h2>
        </div>
      </header>
      <div class="c-card__body">
        @if (!session.canReadContext()) {
          @if (requestable(); as consultation) {
            <app-access-request-panel
              [consultationId]="consultation.consultationId"
              [state]="consultation.accessRequest ?? null"
              [revoked]="session.accessRevoked()"
              (stateChange)="session.applyAccessRequest($event)"
            />
          } @else {
            <app-chart-access-required />
          }
        } @else if (record.workspace(); as workspace) {
          @if (workspace.access.sections['ESSENTIAL_INFORMATION'] === 'AUTHORIZED') {
            <dl class="x-essentials" data-testid="context-essentials">
              <div class="x-row">
                <span class="x-tile x-tile--blood" aria-hidden="true"><nz-icon nzType="experiment" /></span>
                <dt>Groupe sanguin</dt>
                <dd>
                  @if (summary().bloodType !== 'UNKNOWN') { <span class="x-blood">{{ summary().bloodType }}</span> }
                  @else { <span class="x-state">Non renseigné</span> }
                </dd>
              </div>
              <div class="x-row">
                <span class="x-tile x-tile--allergy" aria-hidden="true"><nz-icon nzType="warning" /></span>
                <dt>Allergies</dt>
                <dd>
                  @switch (summary().allergies.status) {
                    @case ('NONE_KNOWN') { <span class="x-state">Aucune connue</span> }
                    @case ('LIST') {
                      @for (item of summary().allergies.items; track $index) { <nz-tag class="c-chip c-chip--allergy">{{ item }}</nz-tag> }
                    }
                    @default { <span class="x-state">Non renseigné</span> }
                  }
                </dd>
              </div>
              <div class="x-row">
                <span class="x-tile x-tile--history" aria-hidden="true"><nz-icon nzType="heart" /></span>
                <dt>Antécédents</dt>
                <dd>
                  @switch (summary().conditions.status) {
                    @case ('NONE_KNOWN') { <span class="x-state">Aucun connu</span> }
                    @case ('LIST') {
                      @for (item of summary().conditions.items; track $index) { <nz-tag class="c-chip c-chip--history">{{ item }}</nz-tag> }
                    }
                    @default { <span class="x-state">Non renseigné</span> }
                  }
                </dd>
              </div>
              @if (workspace.access.sections['CURRENT_MEDICATIONS'] === 'AUTHORIZED') {
                <div class="x-row">
                  <span class="x-tile x-tile--care" aria-hidden="true"><nz-icon nzType="medicine-box" /></span>
                  <dt>Traitements en cours</dt>
                  <dd>
                    @for (medication of workspace.currentMedications; track $index) {
                      <span class="x-line">{{ medication.name || medication.code }}</span>
                    } @empty {
                      <span class="x-state">Aucun traitement en cours</span>
                    }
                  </dd>
                </div>
              }
            </dl>
          }
          @if (workspace.access.sections['CONSULTATION_SUMMARIES'] === 'AUTHORIZED') {
            <div class="x-history">
              <h3>Consultations précédentes</h3>
              @for (item of history(); track item.consultationId; let first = $first) {
                <p class="x-visit">
                  <oc-date-block size="small" [date]="item.occurredAt" [tone]="first ? 'care' : 'neutral'" />
                  <span class="x-visit__label">{{ historyLabel(item) }}</span>
                </p>
              } @empty {
                <p class="x-empty">Aucune consultation précédente.</p>
              }
            </div>
          }
        } @else if (accessLost()) {
          <!-- Revoked or expired before the live refresh landed: no « Réessayer » that would keep failing. -->
          <p class="x-error" role="alert" data-testid="access-revoked">{{ revokedMessage }}</p>
        } @else if (record.failure()) {
          <p class="x-error" role="alert">Le dossier médical n’a pas pu être chargé.
            <oc-button size="small" (click)="record.refresh()">Réessayer</oc-button></p>
        } @else {
          <nz-skeleton [nzActive]="true" [nzTitle]="false" [nzParagraph]="{ rows: 4 }" />
        }
        @if (session.consultation()?.patient) {
          <button type="button" class="x-link" aria-haspopup="dialog" (click)="ui.recordOpen.set(true)">
            Voir le dossier complet <nz-icon nzType="right" aria-hidden="true" />
          </button>
        }
      </div>
    </section>
  `,
  styleUrl: './consultation-sections.scss',
  styles: `
    .x-tile { display: inline-grid; flex: 0 0 40px; width: 40px; height: 40px; place-items: center; border-radius: var(--oc-radius-icon); font-size: 18px; }
    .x-tile--care { background: var(--oc-info-care-tint); color: var(--oc-info-care-icon); }
    .x-tile--blood { background: var(--oc-info-blood-tint); color: var(--oc-info-blood); }
    .x-tile--allergy { background: var(--oc-info-allergy-tint); color: var(--oc-info-allergy-icon); }
    .x-tile--history { background: var(--oc-info-history-tint); color: var(--oc-info-history); }
    .x-essentials { display: grid; gap: var(--oc-space-2); margin: 0; }
    .x-row {
      display: grid; grid-template-columns: 40px minmax(0, 1fr); column-gap: var(--oc-space-3); row-gap: 2px; align-items: center;
      padding: var(--oc-space-3); border-radius: var(--oc-radius-tile); background: var(--oc-tile);
    }
    .x-row .x-tile { grid-row: span 2; }
    dt { color: var(--oc-ink-secondary); font-size: var(--oc-text-small-size); font-weight: var(--oc-font-weight-semibold); }
    dd { display: flex; flex-wrap: wrap; gap: var(--oc-space-1); margin: 0; color: var(--oc-ink); }
    .x-blood { color: var(--oc-info-blood); font-size: 20px; font-weight: var(--oc-font-weight-heavy); line-height: 1.1; }
    .x-state { color: var(--oc-ink); font-weight: var(--oc-font-weight-semibold); }
    .x-line { display: block; width: 100%; font-weight: var(--oc-font-weight-semibold); }
    .x-history { display: grid; gap: var(--oc-space-2); }
    h3 { margin: 0; color: var(--oc-ink); font-size: 15px; font-weight: var(--oc-font-weight-strong); }
    .x-visit { display: flex; align-items: center; gap: var(--oc-space-3); margin: 0; }
    .x-visit__label { min-width: 0; color: var(--oc-ink); font-weight: var(--oc-font-weight-semibold); overflow-wrap: anywhere; }
    .x-empty { margin: 0; color: var(--oc-ink-secondary); }
    .x-error { display: flex; flex-wrap: wrap; align-items: center; gap: var(--oc-space-3); margin: 0; color: var(--oc-error-dark); }
    .x-link { display: inline-flex; align-items: center; justify-self: start; gap: var(--oc-space-1); padding: 0; border: 0; background: none; color: var(--oc-info-care-icon); font: inherit; font-weight: var(--oc-font-weight-semibold); cursor: pointer; }
    .x-link:hover, .x-link:focus-visible { text-decoration: underline; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MedicalContextCard {
  readonly session = inject(ConsultationSessionStore);
  readonly ui = inject(ConsultationUi);
  readonly record = this.session.medicalRecord;
  // A getter, not a field: module constants are read when rendering (load order, see the P2b report §7).
  get revokedMessage(): string { return ACCESS_REVOKED_MESSAGE; }
  /** G-1 D2: the consultation in progress of an OmniCare patient carries the request state. */
  readonly requestable = computed(() => {
    const consultation = this.session.consultation();
    return consultation?.status === 'IN_PROGRESS' && consultation.accessRequest ? consultation : null;
  });
  readonly accessLost = computed(() => {
    const failure = this.record.failure();
    return failure === 'CLINICAL_ACCESS_REVOKED' || failure === 'CLINICAL_ACCESS_EXPIRED';
  });

  readonly summary = computed(() => summaryFromEssential(this.record.workspace()?.essentialInformation ?? null));
  readonly history = computed(() =>
    (this.record.workspace()?.consultationSummaries.items ?? [])
      .filter((item) => item.consultationId !== this.session.consultationId)
      .slice(0, 3),
  );

  historyLabel(item: ConsultationSummary): string {
    return item.diagnoses.find((diagnosis) => diagnosis.label)?.label || item.chiefComplaint || 'Consultation';
  }
}
