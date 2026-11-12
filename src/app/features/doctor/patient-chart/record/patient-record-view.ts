import { ChangeDetectionStrategy, Component, computed, effect, input, inject, output, signal, untracked } from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';

import { OcTabs, OcTag, type OcTab } from '../../../../shared/ui';
import { ChartDocumentsTab } from '../chart-documents-tab';
import type { PatientChartDto, PatientChartMedicalSummaryDto } from '../patient-chart-api.models';
import { ageLabel, chartShortDate, chartTime, patientInitials, sexLabel } from '../patient-chart-format';
import { PatientRecordStore } from './patient-record.store';
import { RecordHistoryTab } from './record-history-tab';
import { RecordSummaryTab } from './record-summary-tab';

export type RecordTab = 'summary' | 'history' | 'documents';

const TABS: readonly OcTab[] = [
  { id: 'summary', label: 'Résumé' },
  { id: 'history', label: 'Historique' },
  { id: 'documents', label: 'Documents' },
];

/** Safety strip content: listed allergies and/or a known blood group (null = no strip). */
export interface SafetyStrip {
  readonly allergyLabel: 'Allergie' | 'Allergies';
  readonly allergies: string | null;
  readonly bloodType: string | null;
}

export function safetyStrip(summary: PatientChartMedicalSummaryDto | null): SafetyStrip | null {
  if (!summary || !summary.essentialInformationShared) return null;
  const status = summary.allergiesStatus ?? (summary.allergies.length > 0 ? 'LIST' : 'UNKNOWN');
  const allergies = status === 'LIST' && summary.allergies.length > 0 ? summary.allergies : [];
  const bloodType = summary.bloodType && summary.bloodType !== 'UNKNOWN' ? summary.bloodType : null;
  if (allergies.length === 0 && bloodType === null) return null;
  return {
    allergyLabel: allergies.length > 1 ? 'Allergies' : 'Allergie',
    allergies: allergies.length > 0 ? allergies.join(', ') : null,
    bloodType,
  };
}

export function isRecordTab(value: string | null | undefined): value is RecordTab {
  return value === 'summary' || value === 'history' || value === 'documents';
}

/**
 * « Dossier patient »: the patient's medical record, doctor view, read-only, in the patient app's
 * « Passeport médical » structure (Résumé / Historique / Documents). Rendered by the consultation
 * side panel and by the patient chart page. Access is the server's: nothing clinical is requested
 * without clinical access, and each tab loads its data only when shown.
 */
@Component({
  selector: 'app-patient-record-view',
  imports: [NzIconModule, OcTabs, OcTag, ChartDocumentsTab, RecordHistoryTab, RecordSummaryTab],
  providers: [PatientRecordStore],
  template: `
    @if (showHeader()) {
      <header class="pr-header">
        <span class="pr-header__avatar" aria-hidden="true">{{ initials() }}</span>
        <div class="pr-header__identity">
          <h2 class="pr-header__name">{{ chart().identity.fullName }}</h2>
          @if (metaLine()) { <p class="pr-header__meta">{{ metaLine() }}</p> }
          <div class="pr-header__tags">
            <oc-tag tone="care">{{ chart().patientType === 'EXTERNAL' ? 'Patient externe' : 'Patient OmniCare' }}</oc-tag>
            @if (grantLabel(); as label) { <oc-tag tone="care">{{ label }}</oc-tag> }
          </div>
        </div>
        @if (closable()) {
          <button type="button" class="pr-close" aria-label="Fermer le dossier" (click)="closed.emit()">
            <nz-icon nzType="close" aria-hidden="true" />
          </button>
        }
      </header>
    }

    @if (safety(); as strip) {
      <div class="pr-safety" role="note" aria-label="Informations de sécurité" data-testid="safety-strip">
        @if (strip.allergies) {
          <p class="pr-safety__allergies">
            <nz-icon nzType="warning" class="pr-safety__icon" aria-hidden="true" />
            <span><strong>{{ strip.allergyLabel }} :</strong> {{ strip.allergies }}</span>
          </p>
        }
        @if (strip.bloodType) {
          <p class="pr-safety__blood"><strong>Groupe :</strong> {{ strip.bloodType }}</p>
        }
      </div>
    }

    <oc-tabs label="Sections du dossier patient" variant="prominent" [tabs]="tabs()" [selected]="tab()" (selectedChange)="select($event)" />

    <div class="pr-body" role="tabpanel" [attr.aria-label]="tabLabel()">
      @switch (tab()) {
        @case ('summary') {
          <app-record-summary-tab (openConsultation)="openConsultation($event)" (openTab)="select($event)" />
        }
        @case ('history') {
          <app-record-history-tab [currentConsultationId]="currentConsultationId()" [focusId]="focusId()" />
        }
        @case ('documents') {
          <app-chart-documents-tab
            [patientId]="chart().id"
            [access]="chart().access"
            [recordStatus]="chart().medicalRecord.status"
            [reloadToken]="documentsRevision()"
          />
        }
      }
    </div>
  `,
  styles: `
    :host { display: grid; gap: var(--oc-space-4); min-width: 0; }
    .pr-header { display: flex; align-items: center; gap: var(--oc-space-4); }
    .pr-header__avatar {
      display: inline-grid; width: 60px; height: 60px; flex: 0 0 60px; place-items: center;
      border-radius: 50%; background: var(--oc-info-care-tint); color: var(--oc-info-care-icon);
      font-size: 20px; font-weight: var(--oc-font-weight-heavy);
    }
    .pr-header__identity { display: grid; flex: 1; gap: var(--oc-space-1); min-width: 0; }
    .pr-header__name { margin: 0; color: var(--oc-ink); font-size: 26px; font-weight: var(--oc-font-weight-heavy); letter-spacing: -0.02em; line-height: 1.2; overflow-wrap: anywhere; }
    .pr-header__meta { margin: 0; color: var(--oc-ink-secondary); }
    .pr-header__tags { display: flex; flex-wrap: wrap; gap: var(--oc-space-2); }
    .pr-close {
      display: inline-grid; flex: 0 0 44px; width: 44px; height: 44px; place-items: center; align-self: flex-start;
      border: 1px solid var(--oc-hairline); border-radius: var(--oc-radius-icon); background: var(--oc-surface);
      color: var(--oc-ink); font-size: 18px; cursor: pointer;
    }
    .pr-close:hover { box-shadow: var(--oc-shadow-soft); }
    .pr-close:focus-visible { outline: 2px solid var(--oc-color-border-focus); outline-offset: 2px; }
    .pr-safety {
      display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--oc-space-2) var(--oc-space-4);
      padding: var(--oc-space-3) var(--oc-space-4); border-radius: var(--oc-radius-tile);
      background: var(--oc-info-allergy-tint); color: var(--oc-info-allergy);
    }
    .pr-safety p { display: flex; align-items: center; gap: var(--oc-space-2); margin: 0; }
    .pr-safety__blood { margin-inline-start: auto !important; }
    .pr-safety__icon { color: var(--oc-info-allergy-icon); font-size: 18px; }
    .pr-body { display: grid; gap: var(--oc-space-4); min-width: 0; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientRecordView {
  private readonly store = inject(PatientRecordStore);

  readonly chart = input.required<PatientChartDto>();
  /** The consultation the view is opened from (pinned first in Historique). */
  readonly currentConsultationId = input<string | null>(null);
  /** The chart page already has its own header (with its actions). */
  readonly showHeader = input(true);
  readonly initialTab = input<RecordTab>('summary');
  /** The chart page bumps it after « Ajouter un document » so the Documents tab reloads. */
  readonly documentsRevision = input(0);
  readonly tabChange = output<RecordTab>();
  /** Drawer: a 44px close button in the header. */
  readonly closable = input(false);
  readonly closed = output<void>();

  /** Text tabs; Historique carries the consultation count once known. */
  readonly tabs = computed<readonly OcTab[]>(() => {
    const total = this.store.total() ?? (this.store.historyState() === 'ready' ? this.store.consultations().length : null);
    return TABS.map((tab) => (tab.id === 'history' && total !== null ? { ...tab, badge: total } : tab));
  });
  /** Under the header whenever the data exists; never without clinical access (no summary is read). */
  readonly safety = computed(() => (this.store.clinical() ? safetyStrip(this.store.summary().data) : null));
  readonly tab = signal<RecordTab>('summary');
  readonly focusId = signal<string | null>(null);

  readonly initials = computed(() => patientInitials(this.chart().identity));
  readonly metaLine = computed(() => {
    const identity = this.chart().identity;
    return [ageLabel(identity), identity.sex ? sexLabel(identity.sex) : null, identity.phone].filter(Boolean).join(' · ');
  });
  readonly grantLabel = computed(() => {
    const access = this.chart().access;
    if (access.mode !== 'OMNICARE_GRANTED' || !access.grantExpiresAt) return null;
    return `Accès autorisé jusqu’au ${chartShortDate(access.grantExpiresAt)} ${chartTime(access.grantExpiresAt)}`;
  });
  readonly tabLabel = computed(() => TABS.find((tab) => tab.id === this.tab())?.label ?? '');

  constructor() {
    effect(() => {
      const chart = this.chart();
      untracked(() => {
        this.store.attach(chart);
        // The safety strip needs the medical summary whatever the opened tab (same read as Résumé).
        this.store.loadSummary();
      });
    });
    effect(() => {
      const initial = this.initialTab();
      untracked(() => this.tab.set(initial));
    });
  }

  select(tab: string): void {
    if (!isRecordTab(tab)) return;
    this.tab.set(tab);
    this.tabChange.emit(tab);
  }

  /** « Dernière consultation » → Historique, with that card open. */
  openConsultation(id: string): void {
    this.focusId.set(id);
    this.select('history');
  }
}
