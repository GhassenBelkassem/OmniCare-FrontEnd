import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { Observable } from 'rxjs';

import type { PatientChartDto, PatientChartMedicalSummaryDto } from '../patient-chart-api.models';
import { PatientChartApiService } from '../patient-chart-api.service';
import { isAccessRequiredError, mayLoadClinical } from '../patient-chart-format';
import type {
  RecordConsultationDetail,
  RecordConsultationItem,
  RecordMedicationList,
} from './patient-record.models';

export type LoadState = 'idle' | 'loading' | 'ready' | 'error' | 'denied';

export interface Loadable<T> {
  readonly state: LoadState;
  readonly data: T | null;
}

const IDLE = { state: 'idle', data: null } as const;
export const HISTORY_PAGE_SIZE = 20;

/**
 * Data of one « Dossier patient » view (provided by the view, so the drawer and the chart page
 * each have their own). Every read goes through the existing chart endpoints; nothing is fetched
 * until a tab or a card needs it, and nothing clinical is fetched without clinical access.
 */
@Injectable()
export class PatientRecordStore {
  private readonly api = inject(PatientChartApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly chart = signal<PatientChartDto | null>(null);
  readonly clinical = computed(() => {
    const chart = this.chart();
    return chart !== null && mayLoadClinical(chart.access) && chart.medicalRecord.status === 'READY';
  });

  readonly summary = signal<Loadable<PatientChartMedicalSummaryDto>>(IDLE);
  readonly medications = signal<Readonly<Record<'current' | 'past', Loadable<RecordMedicationList>>>>({ current: IDLE, past: IDLE });

  readonly historyState = signal<LoadState>('idle');
  readonly historyView = signal<'CLINICAL' | 'ADMINISTRATIVE'>('ADMINISTRATIVE');
  readonly consultations = signal<readonly RecordConsultationItem[]>([]);
  readonly nextCursor = signal<string | null>(null);
  readonly total = signal<number | null>(null);
  readonly loadingMore = signal(false);
  readonly details = signal<ReadonlyMap<string, Loadable<RecordConsultationDetail>>>(new Map());

  attach(chart: PatientChartDto): void {
    if (this.chart()?.id === chart.id) {
      this.chart.set(chart);
      return;
    }
    this.chart.set(chart);
    this.summary.set(IDLE);
    this.medications.set({ current: IDLE, past: IDLE });
    this.historyState.set('idle');
    this.consultations.set([]);
    this.nextCursor.set(null);
    this.total.set(null);
    this.details.set(new Map());
  }

  loadSummary(force = false): void {
    if (!this.clinical() || (!force && this.summary().state !== 'idle')) return;
    this.summary.set({ state: 'loading', data: null });
    this.run(this.api.getMedicalSummary(this.chartId()), (data) => this.summary.set({ state: 'ready', data }),
      (state) => this.summary.set({ state, data: null }));
  }

  loadMedications(state: 'current' | 'past', force = false): void {
    if (!this.clinical() || (!force && this.medications()[state].state !== 'idle')) return;
    this.medications.update((value) => ({ ...value, [state]: { state: 'loading', data: null } }));
    this.run(this.api.getMedications(this.chartId(), state),
      (data) => this.medications.update((value) => ({ ...value, [state]: { state: 'ready', data } })),
      (failure) => this.medications.update((value) => ({ ...value, [state]: { state: failure, data: null } })));
  }

  /** First history page. Allowed in every mode: RESTRICTED gets the administrative view. */
  loadHistory(force = false): void {
    if (this.chart() === null || (!force && this.historyState() !== 'idle')) return;
    this.historyState.set('loading');
    this.run(this.api.getConsultationPage(this.chartId(), null, HISTORY_PAGE_SIZE), (page) => {
      this.historyView.set(page.view);
      this.consultations.set(page.items);
      this.nextCursor.set(page.nextCursor);
      this.total.set(page.total ?? null);
      this.historyState.set('ready');
    }, (state) => this.historyState.set(state));
  }

  loadMore(): void {
    const cursor = this.nextCursor();
    if (cursor === null || this.loadingMore()) return;
    this.loadingMore.set(true);
    this.run(this.api.getConsultationPage(this.chartId(), cursor, HISTORY_PAGE_SIZE), (page) => {
      const known = new Set(this.consultations().map((item) => item.id));
      this.consultations.update((items) => [...items, ...page.items.filter((item) => !known.has(item.id))]);
      this.nextCursor.set(page.nextCursor);
      this.loadingMore.set(false);
    }, () => this.loadingMore.set(false));
  }

  /** One request per card, on first expansion (again only after a failure). */
  loadDetail(consultationId: string): void {
    if (!this.clinical() || this.historyView() !== 'CLINICAL') return;
    const current = this.details().get(consultationId);
    if (current !== undefined && current.state !== 'error') return;
    this.setDetail(consultationId, { state: 'loading', data: null });
    this.run(this.api.getConsultationDetail(this.chartId(), consultationId),
      (data) => this.setDetail(consultationId, { state: 'ready', data }),
      (state) => this.setDetail(consultationId, { state, data: null }));
  }

  private setDetail(id: string, value: Loadable<RecordConsultationDetail>): void {
    this.details.update((map) => new Map(map).set(id, value));
  }

  private chartId(): string {
    return this.chart()!.id;
  }

  private run<T>(source: Observable<T>, next: (value: T) => void, fail: (state: 'error' | 'denied') => void): void {
    source.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next,
      error: (error: unknown) => fail(isAccessRequiredError(error) ? 'denied' : 'error'),
    });
  }
}
