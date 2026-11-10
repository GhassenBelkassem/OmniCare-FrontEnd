import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { Subject, catchError, distinctUntilChanged, map, of, startWith, switchMap, tap } from 'rxjs';

import { OcButton, OcEmptyState, OcIcon, OcSectionCard, OcStatusTag, OcTabs, type OcTab } from '../../../shared/ui';
import { ActiveConsultationStore } from '../active-consultation.store';
import { QuickBookingDrawer } from '../calendar/quick-booking-drawer';
import { PracticePatientApiService } from '../practice-patient-api.service';
import { ChartConsultationsTab } from './chart-consultations-tab';
import { ChartDocumentsTab } from './chart-documents-tab';
import { ChartHistoryTab } from './chart-history-tab';
import { ChartMedicalSummaryCard } from './chart-medical-summary-card';
import type { PatientChartDto } from './patient-chart-api.models';
import { PatientChartApiService, newChartIdempotencyKey } from './patient-chart-api.service';
import {
  ageLabel,
  chartDateTime,
  chartLongDate,
  chartShortDate,
  chartTime,
  consultationStatusLabel,
  patientInitials,
  sexLabel,
} from './patient-chart-format';

export type PatientChartTab = 'summary' | 'consultations' | 'documents' | 'history';
type PageState = 'loading' | 'ready' | 'not-found' | 'error';

const TAB_IDS: readonly PatientChartTab[] = ['summary', 'consultations', 'documents', 'history'];

export function isPatientChartTab(value: string | null): value is PatientChartTab {
  return value !== null && (TAB_IDS as readonly string[]).includes(value);
}

@Component({
  selector: 'app-patient-chart-page',
  imports: [
    RouterLink,
    NzSkeletonModule,
    NzTagModule,
    NzTooltipModule,
    OcButton,
    OcEmptyState,
    OcIcon,
    OcSectionCard,
    OcStatusTag,
    OcTabs,
    QuickBookingDrawer,
    ChartConsultationsTab,
    ChartDocumentsTab,
    ChartHistoryTab,
    ChartMedicalSummaryCard,
  ],
  templateUrl: './patient-chart-page.html',
  styleUrls: ['./patient-chart-page.scss', './patient-chart-cards.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientChartPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(PatientChartApiService);
  private readonly practicePatients = inject(PracticePatientApiService);
  private readonly consultations = inject(ActiveConsultationStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reload = new Subject<void>();

  readonly state = signal<PageState>('loading');
  readonly chart = signal<PatientChartDto | null>(null);
  readonly activeTab = signal<PatientChartTab>(this.tabFrom(this.route.snapshot.queryParamMap.get('tab')));
  readonly drawerOpen = signal(false);
  readonly starting = this.consultations.starting;
  readonly startError = signal<string | null>(null);
  readonly reconciling = signal(false);
  readonly reconcileMessage = signal<string | null>(null);

  readonly tabs = computed<readonly OcTab[]>(() => {
    const counts = this.chart()?.counts;
    return [
      { id: 'summary', label: 'Synthèse', icon: 'user' },
      { id: 'consultations', label: 'Consultations', icon: 'medicine-box', badge: counts?.consultations ?? undefined },
      { id: 'documents', label: 'Documents', icon: 'file-text', badge: counts?.documents ?? undefined },
      { id: 'history', label: 'Historique', icon: 'history' },
    ];
  });

  readonly metaLine = computed(() => {
    const chart = this.chart();
    if (!chart) return '';
    const identity = chart.identity;
    return [ageLabel(identity), identity.sex ? sexLabel(identity.sex) : null, identity.phone]
      .filter(Boolean)
      .join(' · ');
  });

  readonly initials = computed(() => {
    const chart = this.chart();
    return chart ? patientInitials(chart.identity) : '';
  });

  readonly grantLabel = computed(() => {
    const access = this.chart()?.access;
    if (access?.mode !== 'OMNICARE_GRANTED' || !access.grantExpiresAt) return null;
    return `Accès autorisé jusqu’au ${chartShortDate(access.grantExpiresAt)} ${chartTime(access.grantExpiresAt)}`;
  });

  readonly scheduleDisabledReason = computed(() => {
    const chart = this.chart();
    if (!chart || chart.schedulable) return null;
    return chart.patientType === 'OMNICARE'
      ? 'Le patient OmniCare réserve depuis son application.'
      : 'Planification indisponible.';
  });

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.activeTab.set(this.tabFrom(params.get('tab')));
    });
    this.route.paramMap
      .pipe(
        map((params) => params.get('id')?.trim() ?? ''),
        distinctUntilChanged(),
        switchMap((id) =>
          this.reload.pipe(
            startWith(undefined),
            tap(() => {
              if (this.chart()?.id !== id) this.chart.set(null);
              if (this.chart() === null) this.state.set('loading');
            }),
            switchMap(() => this.load(id)),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ state, chart }) => {
        this.chart.set(chart);
        this.state.set(state);
      });
  }

  retry(): void {
    this.chart.set(null);
    this.state.set('loading');
    this.reload.next();
  }

  refresh(): void {
    this.reload.next();
  }

  selectTab(tab: string): void {
    if (!isPatientChartTab(tab)) return;
    this.activeTab.set(tab);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tab === 'summary' ? null : tab },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  openSchedule(): void {
    if (this.chart()?.schedulable) this.drawerOpen.set(true);
  }

  onAppointmentCreated(): void {
    this.drawerOpen.set(false);
    this.refresh();
  }

  async startConsultation(): Promise<void> {
    const appointment = this.chart()?.startableAppointment;
    if (!appointment || this.starting()) return;
    this.startError.set(null);
    const outcome = await this.consultations.startScheduledAppointment(appointment.id, appointment.version);
    if (outcome.kind === 'STARTED' || outcome.kind === 'RECOVERED') {
      await this.router.navigate(['/doctor', 'consultation', outcome.consultation.consultationId]);
      return;
    }
    this.startError.set(this.consultations.startError() ?? 'La consultation n’a pas pu démarrer. Réessayez.');
  }

  retryPreparation(): void {
    const chart = this.chart();
    if (!chart || chart.patientType !== 'EXTERNAL' || this.reconciling()) return;
    this.reconciling.set(true);
    this.reconcileMessage.set(null);
    this.practicePatients
      .reconcileMrsPatient(chart.id, newChartIdempotencyKey('chart-record'))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.reconciling.set(false);
          this.reconcileMessage.set('Préparation relancée. La fiche se mettra à jour dans un instant.');
          setTimeout(() => this.refresh(), 1500);
        },
        error: () => {
          this.reconciling.set(false);
          this.reconcileMessage.set('La préparation n’a pas pu être relancée. Réessayez.');
        },
      });
  }

  sex(value: PatientChartDto['identity']['sex']): string {
    return sexLabel(value);
  }

  shortDate(value: string | null): string {
    return chartShortDate(value);
  }

  longDate(value: string | null): string {
    return chartLongDate(value);
  }

  dateTime(value: string | null): string {
    return chartDateTime(value);
  }

  consultationStatus(status: string): string {
    return consultationStatusLabel(status);
  }

  private load(id: string) {
    if (!id) return of({ state: 'not-found' as PageState, chart: null });
    return this.api.getChart(id).pipe(
      map((chart) => ({ state: 'ready' as PageState, chart })),
      catchError((error: unknown) =>
        of({
          state: (error instanceof HttpErrorResponse && error.status === 404
            ? 'not-found'
            : 'error') as PageState,
          chart: null,
        }),
      ),
    );
  }

  private tabFrom(value: string | null): PatientChartTab {
    return isPatientChartTab(value) ? value : 'summary';
  }
}
