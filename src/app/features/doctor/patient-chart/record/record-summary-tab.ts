import { ChangeDetectionStrategy, Component, computed, effect, inject, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzSegmentedModule } from 'ng-zorro-antd/segmented';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';

import { OcButton, OcDateBlock, OcTag } from '../../../../shared/ui';
import { ChartAccessRequired } from '../chart-access-required';
import { ChartHistoryTab } from '../chart-history-tab';
import type { SummaryStatus } from '../patient-chart-api.models';
import type { RecordConsultationItem, RecordMedication } from './patient-record.models';
import { PatientRecordStore } from './patient-record.store';
import { bodyMassIndex, formatNumber, medicationState, medicationTags, tunisToday, untilLabel } from './record-format';

const MEDICATION_TABS = [
  { label: 'Actuels', value: 'current' },
  { label: 'Anciens', value: 'past' },
];

/** « Résumé »: essentials (3 tiles), medications, body measurements, last consultation, activity link. */
@Component({
  selector: 'app-record-summary-tab',
  imports: [FormsModule, NzIconModule, NzSegmentedModule, NzSkeletonModule, OcButton, OcDateBlock, OcTag, ChartAccessRequired, ChartHistoryTab],
  template: `
    <div class="r-stack">
      <!-- Informations essentielles -->
      <section class="r-card" aria-labelledby="essentials-title" [attr.data-testid]="store.clinical() ? 'essentials' : null">
        <div class="r-heading">
          <span class="r-tile r-tile--care" aria-hidden="true"><nz-icon nzType="safety-certificate" /></span>
          <div class="r-heading__text">
            <h3 id="essentials-title">Informations essentielles</h3>
            <p>Informations prioritaires pour les professionnels de santé</p>
          </div>
        </div>
        @if (!store.clinical()) {
          <app-chart-access-required />
        } @else {
          @switch (store.summary().state) {
            @case ('ready') {
              @if (store.summary().data; as summary) {
                @if (!summary.essentialInformationShared) {
                  <app-chart-access-required />
                } @else {
                  <div class="r-tiles">
                    <div class="r-info" data-testid="essential-blood">
                      <div class="r-info__head">
                        <span class="r-tile r-tile--small r-tile--blood" aria-hidden="true"><nz-icon nzType="experiment" /></span>
                        <p class="r-label">Groupe sanguin</p>
                      </div>
                      @if (summary.bloodType) { <p class="r-big">{{ summary.bloodType }}</p> }
                      @else { <p class="r-state">Non renseigné</p> }
                    </div>
                    <div class="r-info" data-testid="essential-allergies">
                      <div class="r-info__head">
                        <span class="r-tile r-tile--small r-tile--allergy" aria-hidden="true"><nz-icon nzType="warning" /></span>
                        <p class="r-label">Allergies et réactions</p>
                      </div>
                      @switch (status(summary.allergiesStatus, summary.allergies)) {
                        @case ('NONE_KNOWN') { <p class="r-state">Aucune connue</p> }
                        @case ('LIST') {
                          <div class="r-tags">
                            @for (item of summary.allergies; track $index) { <oc-tag tone="allergy">{{ item }}</oc-tag> }
                          </div>
                        }
                        @default { <p class="r-state">Non renseigné</p> }
                      }
                    </div>
                    <div class="r-info" data-testid="essential-conditions">
                      <div class="r-info__head">
                        <span class="r-tile r-tile--small r-tile--history" aria-hidden="true"><nz-icon nzType="heart" /></span>
                        <p class="r-label">Antécédents</p>
                      </div>
                      @switch (status(summary.conditionsStatus, summary.conditions)) {
                        @case ('NONE_KNOWN') { <p class="r-state">Aucun connu</p> }
                        @case ('LIST') {
                          <div class="r-tags">
                            @for (item of summary.conditions; track $index) { <oc-tag tone="history">{{ item }}</oc-tag> }
                          </div>
                        }
                        @default { <p class="r-state">Non renseigné</p> }
                      }
                    </div>
                  </div>
                }
              }
            }
            @case ('denied') { <app-chart-access-required /> }
            @case ('error') {
              <p class="r-error" role="alert">Les informations n’ont pas pu être chargées.
                <oc-button size="small" (click)="store.loadSummary(true)">Réessayer</oc-button></p>
            }
            @default { <nz-skeleton [nzActive]="true" [nzTitle]="false" [nzParagraph]="{ rows: 3 }" /> }
          }
        }
      </section>

      @if (store.clinical()) {
        <!-- Médicaments -->
        <section class="r-card" aria-labelledby="medications-title" data-testid="medications">
          <div class="r-heading">
            <span class="r-tile r-tile--care" aria-hidden="true"><nz-icon nzType="medicine-box" /></span>
            <div class="r-heading__text">
              <h3 id="medications-title">Médicaments</h3>
              <p>{{ activeLabel() }}</p>
            </div>
          </div>
          <nz-segmented class="r-segmented" [nzOptions]="medicationTabs" [ngModel]="medicationTab()" (ngModelChange)="selectMedications($event)" aria-labelledby="medications-title" />
          @let list = store.medications()[medicationTab()];
          @switch (list.state) {
            @case ('ready') {
              <ul class="m-list" data-testid="medication-list">
                @for (medication of list.data?.items ?? []; track medication.id) {
                  <li class="m-row">
                    <div class="m-row__main">
                      <p class="m-row__name">{{ medication.name }}@if (medication.strength) { {{ ' ' + medication.strength }} }</p>
                      <div class="r-tags" data-testid="medication-tags">
                        @for (tag of tags(medication); track $index) { <oc-tag>{{ tag }}</oc-tag> }
                      </div>
                    </div>
                    <div class="m-row__status">
                      @if (isCurrent(medication)) { <oc-tag tone="care">Actif</oc-tag> }
                      @else { <oc-tag tone="neutral">Terminé</oc-tag> }
                      @if (until(medication); as label) { <span class="m-row__until">{{ label }}</span> }
                    </div>
                  </li>
                } @empty {
                  <li class="r-empty">{{ medicationTab() === 'current' ? 'Aucun traitement en cours.' : 'Aucun ancien traitement.' }}</li>
                }
              </ul>
            }
            @case ('denied') { <app-chart-access-required /> }
            @case ('error') {
              <p class="r-error" role="alert">Les médicaments n’ont pas pu être chargés.
                <oc-button size="small" (click)="store.loadMedications(medicationTab(), true)">Réessayer</oc-button></p>
            }
            @default { <nz-skeleton [nzActive]="true" [nzTitle]="false" [nzParagraph]="{ rows: 2 }" /> }
          }
        </section>

        <!-- Mesures corporelles: only when the patient entered some -->
        @if (measurements(); as measures) {
          <section class="r-card" aria-labelledby="measures-title" data-testid="measurements">
            <div class="r-heading">
              <span class="r-tile r-tile--care" aria-hidden="true"><nz-icon nzType="dashboard" /></span>
              <div class="r-heading__text">
                <h3 id="measures-title">Mesures corporelles</h3>
                <p>Données renseignées par le patient</p>
              </div>
            </div>
            <dl class="r-tiles r-measures">
              @if (measures.height) { <div class="r-info"><dt class="r-label">Taille</dt><dd class="r-value">{{ measures.height }} cm</dd></div> }
              @if (measures.weight) { <div class="r-info"><dt class="r-label">Poids</dt><dd class="r-value">{{ measures.weight }} kg</dd></div> }
              @if (measures.bmi) { <div class="r-info"><dt class="r-label">IMC</dt><dd class="r-value">{{ measures.bmi }}</dd></div> }
            </dl>
          </section>
        }
      }

      <!-- Dernière consultation -->
      @if (lastConsultation(); as last) {
        <section class="r-card l-card" aria-labelledby="last-title" data-testid="last-consultation">
          <oc-date-block [date]="last.date" tone="care" />
          <div class="l-card__body">
            <h3 id="last-title" class="r-label">Dernière consultation</h3>
            @if (store.historyView() === 'CLINICAL') {
              <p class="l-card__title">{{ last.diagnosisSummary || 'Diagnostic non renseigné' }}</p>
              <p class="r-secondary">{{ lastLine(last) }}</p>
            } @else {
              <p class="l-card__title">Consultation</p>
              @if (last.doctor) { <p class="r-secondary">{{ last.doctor.name }}</p> }
            }
          </div>
          <oc-button variant="outline" (click)="openConsultation.emit(last.id)">
            {{ store.historyView() === 'CLINICAL' ? 'Voir le détail' : 'Voir dans l’historique' }}
          </oc-button>
        </section>
      }

      <!-- Activité du dossier (administrative events) -->
      <div class="r-activity">
        <button type="button" class="r-link r-link--quiet" [attr.aria-expanded]="activityOpen()" (click)="activityOpen.set(!activityOpen())">
          Activité du dossier <nz-icon [nzType]="activityOpen() ? 'down' : 'right'" aria-hidden="true" />
        </button>
        @if (activityOpen() && store.chart(); as chart) {
          <app-chart-history-tab [patientId]="chart.id" [access]="chart.access" (openTab)="openTab.emit($event === 'documents' ? 'documents' : 'history')" />
        }
      </div>
    </div>
  `,
  styleUrl: './record-cards.scss',
  styles: `
    .r-segmented { justify-self: start; }
    .m-list { display: grid; gap: var(--oc-space-2); margin: 0; padding: 0; list-style: none; }
    .m-row {
      display: flex; align-items: center; justify-content: space-between; gap: var(--oc-space-4);
      padding: var(--oc-space-4); border-radius: var(--oc-radius-tile); background: var(--oc-tile);
    }
    .m-row__main { display: grid; gap: var(--oc-space-2); min-width: 0; }
    .m-row__name { margin: 0; color: var(--oc-ink); font-size: 16px; font-weight: var(--oc-font-weight-strong); }
    .m-row__status { display: grid; justify-items: end; gap: var(--oc-space-1); flex: 0 0 auto; }
    .m-row__until { color: var(--oc-ink-secondary); font-size: var(--oc-text-small-size); white-space: nowrap; }
    .r-measures { margin: 0; }
    .r-measures dd { margin: 0; }
    .l-card { grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; }
    .l-card__body { display: grid; gap: var(--oc-space-1); min-width: 0; }
    .l-card__title { margin: 0; color: var(--oc-ink); font-size: 18px; font-weight: var(--oc-font-weight-strong); overflow-wrap: anywhere; }
    .r-activity { display: grid; gap: var(--oc-space-3); padding-inline: var(--oc-space-2); }
    @media (max-width: 768px) {
      .m-row { flex-direction: column; align-items: stretch; }
      .m-row__status { display: flex; justify-items: start; align-items: center; }
      .l-card { grid-template-columns: auto minmax(0, 1fr); }
      .l-card oc-button { grid-column: 1 / -1; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecordSummaryTab {
  readonly store = inject(PatientRecordStore);
  readonly openConsultation = output<string>();
  readonly openTab = output<'history' | 'documents'>();

  readonly medicationTabs = MEDICATION_TABS;
  readonly medicationTab = signal<'current' | 'past'>('current');
  readonly activityOpen = signal(false);

  readonly activeLabel = computed(() => {
    const count = this.store.medications().current.data?.activeCount ?? this.store.medications().past.data?.activeCount;
    if (count === undefined) return 'Traitements issus des ordonnances signées';
    return count === 1 ? '1 traitement actif' : `${count} traitements actifs`;
  });

  readonly measurements = computed(() => {
    const value = this.store.summary().data?.bodyMeasurements;
    if (!value || (!value.heightCm && !value.weightKg)) return null;
    return {
      height: value.heightCm ? formatNumber(value.heightCm) : null,
      weight: value.weightKg ? formatNumber(value.weightKg) : null,
      bmi: bodyMassIndex(value.heightCm, value.weightKg),
    };
  });

  readonly lastConsultation = computed<RecordConsultationItem | null>(() =>
    this.store.consultations().find((item) => item.status === 'COMPLETED') ?? null);

  constructor() {
    effect(() => {
      if (this.store.chart() === null) return;
      untracked(() => {
        this.store.loadSummary();
        this.store.loadMedications('current');
        this.store.loadHistory();
      });
    });
  }

  selectMedications(value: string | number): void {
    const state = value === 'past' ? 'past' : 'current';
    this.medicationTab.set(state);
    this.store.loadMedications(state);
  }

  status(status: SummaryStatus | null | undefined, items: readonly string[]): SummaryStatus {
    return status ?? (items.length > 0 ? 'LIST' : 'UNKNOWN');
  }

  isCurrent(medication: RecordMedication): boolean {
    return medicationState(medication.endsAt, tunisToday()) === 'current';
  }

  tags(medication: RecordMedication): readonly string[] {
    return medicationTags(medication);
  }

  until(medication: RecordMedication): string {
    return medication.longTerm ? '' : untilLabel(medication.endsAt);
  }

  /** « Motif : Fièvre · Dr Sami Ben Ali » */
  lastLine(item: RecordConsultationItem): string {
    return [`Motif : ${item.reason || 'non renseigné'}`, item.doctor?.name].filter(Boolean).join(' · ');
  }
}
