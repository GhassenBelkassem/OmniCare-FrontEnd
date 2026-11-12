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
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { Subject, catchError, distinctUntilChanged, map, of, startWith, switchMap, tap } from 'rxjs';

import { OcButton, OcEmptyState, OcTag } from '../../../shared/ui';
import { RealtimeService } from '../../../core/realtime/realtime.service';
import type { AccessRequestState } from '../active-consultation.models';
import { ActiveConsultationStore } from '../active-consultation.store';
import { AccessRequestPanel } from './access-request-panel';
import { QuickBookingDrawer } from '../calendar/quick-booking-drawer';
import { PracticePatientApiService } from '../practice-patient-api.service';
import type { PatientChartDto, PatientChartIdentityDto } from './patient-chart-api.models';
import { PatientChartApiService, newChartIdempotencyKey } from './patient-chart-api.service';
import { ChartContactCard } from './chart-contact-card';
import { ChartDocumentUpload } from './chart-document-upload';
import { ChartNextAppointmentCard } from './chart-next-appointment-card';
import { PatientRecordView, isRecordTab, type RecordTab } from './record/patient-record-view';
import {
  ageLabel,
  chartShortDate,
  chartTime,
  patientInitials,
  sexLabel,
} from './patient-chart-format';

/** The chart page shows the shared « Dossier patient » view: Résumé / Historique / Documents. */
export type PatientChartTab = RecordTab;
type PageState = 'loading' | 'ready' | 'not-found' | 'error';

export function isPatientChartTab(value: string | null): value is PatientChartTab {
  return isRecordTab(value);
}

@Component({
  selector: 'app-patient-chart-page',
  imports: [
    RouterLink,
    NzSkeletonModule,
    NzTooltipModule,
    OcButton,
    OcEmptyState,
    OcTag,
    QuickBookingDrawer,
    PatientRecordView,
    ChartContactCard,
    ChartNextAppointmentCard,
    ChartDocumentUpload,
    AccessRequestPanel,
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
  private readonly realtime = inject(RealtimeService);

  readonly state = signal<PageState>('loading');
  readonly chart = signal<PatientChartDto | null>(null);
  /** G-1 D2: the patient revoked the access (or it expired) while this page was open. */
  readonly accessRevoked = signal(false);
  /** « Demander l'accès » banner: OmniCare patient without access, during this doctor's consultation. */
  readonly accessBanner = computed(() => {
    const chart = this.chart();
    return chart?.access.mode === 'OMNICARE_RESTRICTED' ? (chart.accessRequest ?? null) : null;
  });
  readonly activeTab = signal<PatientChartTab>(this.tabFrom(this.route.snapshot.queryParamMap.get('tab')));
  readonly drawerOpen = signal(false);
  readonly starting = this.consultations.starting;
  readonly startError = signal<string | null>(null);
  readonly reconciling = signal(false);
  readonly reconcileMessage = signal<string | null>(null);
  readonly uploadOpen = signal(false);
  readonly documentsRevision = signal(0);

  /** « Ajouter un document »: the owner of an external patient only (server-decided access). */
  readonly canUpload = computed(() => {
    const access = this.chart()?.access;
    return access?.mode === 'EXTERNAL_OWNER' && access.editable;
  });
  readonly uploadDisabledReason = computed(() =>
    this.chart()?.medicalRecord.status === 'READY' ? null : 'Le dossier médical est en cours de préparation.');


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
        const previous = this.chart();
        if (chart && previous?.id === chart.id) {
          if (chart.access.mode === 'OMNICARE_GRANTED') this.accessRevoked.set(false);
          else if (previous.access.mode === 'OMNICARE_GRANTED' && chart.access.mode === 'OMNICARE_RESTRICTED') this.accessRevoked.set(true);
        } else {
          this.accessRevoked.set(false);
        }
        this.chart.set(chart);
        this.state.set(state);
      });
    // G-1 D2: the patient's answer, a revoke or an expiry updates the page live (no reload).
    this.realtime.scheduledCareEvents$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event) => {
      if (event.eventType === 'CLINICAL_ACCESS_CHANGED' && event.resourceType === 'CONSULTATION'
        && this.chart()?.patientType === 'OMNICARE') {
        this.refresh();
      }
    });
  }

  onAccessRequestChange(state: AccessRequestState): void {
    this.chart.update((chart) => (chart?.accessRequest ? { ...chart, accessRequest: { ...state, consultationId: chart.accessRequest.consultationId } } : chart));
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

  /** Coordonnées saved: the page shows the new identity at once (header line included). */
  onContactUpdated(identity: PatientChartIdentityDto): void {
    this.chart.update((chart) => (chart === null ? chart : { ...chart, identity }));
  }

  /** A document was added: open Documents and reload its list. */
  onDocumentUploaded(): void {
    this.documentsRevision.update((value) => value + 1);
    this.selectTab('documents');
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
    // Links to the former « Consultations » tab land on Historique.
    if (value === 'consultations') return 'history';
    return isPatientChartTab(value) ? value : 'summary';
  }
}
