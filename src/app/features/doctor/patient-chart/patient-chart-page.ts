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
import { ActivatedRoute, Router } from '@angular/router';
import {
  Subject,
  catchError,
  distinctUntilChanged,
  map,
  of,
  startWith,
  switchMap,
  tap,
} from 'rxjs';

import type { PracticePatientDto, PracticePatientSourceDto } from '../practice-patient-api.models';
import { PracticePatientApiService } from '../practice-patient-api.service';
import { PatientDetailView, isPatientDetailTab } from './patient-detail-view';
import type {
  PatientDetailAction,
  PatientDetailLinkage,
  PatientDetailPerson,
  PatientDetailSource,
  PatientDetailState,
  PatientDetailTab,
  PatientDetailViewModel,
} from './patient-detail-view.models';

const DETAIL_TABS: PatientDetailViewModel['tabs'] = [
  { id: 'overview', label: 'Vue d’ensemble', icon: 'user' },
  { id: 'consultations', label: 'Consultations', icon: 'medicine-box' },
  { id: 'documents', label: 'Documents', icon: 'file-text' },
  { id: 'timeline', label: 'Timeline', icon: 'history' },
];

const SOURCE_LABELS: Record<
  PracticePatientSourceDto,
  { readonly source: PatientDetailSource; readonly label: string }
> = {
  MANUAL: { source: 'manual', label: 'Saisie manuelle' },
  IMPORTED: { source: 'imported', label: 'Import' },
  OMNICARE: { source: 'omnicare', label: 'OmniCare' },
};

interface PatientLoadResult {
  readonly state: Exclude<PatientDetailState, 'loading'>;
  readonly patient: PracticePatientDto | null;
}

@Component({
  selector: 'app-patient-chart-page',
  imports: [PatientDetailView],
  templateUrl: './patient-chart-page.html',
  styleUrl: './patient-chart-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientChartPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(PracticePatientApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly retryRequest = new Subject<void>();

  readonly state = signal<PatientDetailState>('loading');
  readonly patient = signal<PracticePatientDto | null>(null);
  readonly activeTab = signal<PatientDetailTab>(this.initialTab());

  readonly viewModel = computed<PatientDetailViewModel>(() => {
    const patient = this.patient();
    const state = this.state();
    return {
      notice: null,
      state,
      stateDescription: stateDescription(state),
      directoryHref: '/doctor/patients',
      scheduleHref: patient ? `/doctor/calendar?patientId=${encodeURIComponent(patient.id)}` : null,
      patient: patient ? productionPatient(patient) : null,
      tabs: DETAIL_TABS,
      activeTab: this.activeTab(),
      appointments: [],
      timeline: [],
    };
  });

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const requested = params.get('tab');
      this.activeTab.set(isPatientDetailTab(requested) ? requested : 'overview');
    });

    this.route.paramMap
      .pipe(
        map((params) => params.get('id')?.trim() ?? ''),
        distinctUntilChanged(),
        switchMap((id) =>
          this.retryRequest.pipe(
            startWith(undefined),
            tap(() => {
              this.patient.set(null);
              this.state.set('loading');
            }),
            switchMap(() => this.loadPatient(id)),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        this.patient.set(result.patient);
        this.state.set(result.state);
      });
  }

  handleViewAction(action: PatientDetailAction): void {
    switch (action.kind) {
      case 'SELECT_TAB':
        this.setTab(action.value);
        return;
      case 'RETRY':
        this.retryRequest.next();
        return;
      case 'NAVIGATE_DIRECTORY':
        void this.router.navigate(['/doctor/patients']);
        return;
      case 'SCHEDULE': {
        const patient = this.patient();
        if (patient) {
          void this.router.navigate(['/doctor/calendar'], {
            queryParams: { patientId: patient.id },
          });
        }
        return;
      }
    }
  }

  private loadPatient(id: string) {
    if (!id) return of<PatientLoadResult>({ state: 'not-found', patient: null });
    return this.api.getPatient(id).pipe(
      map((patient): PatientLoadResult => ({ state: 'ready', patient })),
      catchError((error: unknown) =>
        of<PatientLoadResult>({ state: stateForError(error), patient: null }),
      ),
    );
  }

  private setTab(value: PatientDetailTab): void {
    this.activeTab.set(value);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: value === 'overview' ? null : value },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private initialTab(): PatientDetailTab {
    const requested = this.route.snapshot.queryParamMap.get('tab');
    return isPatientDetailTab(requested) ? requested : 'overview';
  }
}

function stateForError(error: unknown): PatientLoadResult['state'] {
  if (error instanceof HttpErrorResponse && error.status === 404) return 'not-found';
  if (error instanceof HttpErrorResponse && error.status === 403) return 'forbidden';
  return 'error';
}

function stateDescription(state: PatientDetailState): string {
  switch (state) {
    case 'loading':
      return 'Chargement des informations administratives du patient.';
    case 'not-found':
      return 'Aucune fiche patient accessible ne correspond à l’identifiant demandé.';
    case 'forbidden':
      return 'Vous n’êtes pas autorisé à consulter cette fiche administrative.';
    case 'error':
      return 'La fiche administrative n’a pas pu être chargée. Réessayez dans un instant.';
    case 'ready':
      return '';
  }
}

function productionPatient(patient: PracticePatientDto): PatientDetailPerson {
  const source = SOURCE_LABELS[patient.source];
  const linkage = productionLinkage(patient);
  const firstName = patient.firstName.trim();
  const lastName = patient.lastName.trim();
  return {
    id: patient.id,
    fullName: [firstName, lastName].filter(Boolean).join(' ') || 'Patient sans nom',
    initials: `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toLocaleUpperCase('fr-FR'),
    dateOfBirth: patient.dateOfBirth,
    dateOfBirthLabel: dateLabel(patient.dateOfBirth),
    age: ageFromDateOfBirth(patient.dateOfBirth),
    sexLabel:
      patient.sex === 'F'
        ? 'Femme'
        : patient.sex === 'M'
          ? 'Homme'
          : patient.sex === 'autre'
            ? 'Autre'
            : 'Non renseigné',
    phone: patient.phone.trim() || 'Non renseigné',
    email: patient.email?.trim() || null,
    address: patient.address?.trim() || null,
    administrativeId: patient.id,
    insuranceNumber: null,
    source: source.source,
    sourceLabel: source.label,
    linkage,
    linkageLabel: {
      linked: 'Lié à OmniCare',
      possible: 'Correspondance possible',
      unlinked: 'Non lié',
    }[linkage],
  };
}

function productionLinkage(patient: PracticePatientDto): PatientDetailLinkage {
  if (patient.linkedOmniCareUserId) return 'linked';
  return patient.possibleOmniCareMatch ? 'possible' : 'unlinked';
}

function dateLabel(value: string | null): string {
  const date = patientDate(value);
  if (!date) return 'Non renseignée';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Africa/Tunis',
  }).format(date);
}

function ageFromDateOfBirth(value: string | null): number | null {
  const date = patientDate(value);
  if (!date) return null;
  const now = new Date();
  let age = now.getFullYear() - date.getUTCFullYear();
  const birthdayPending =
    now.getMonth() < date.getUTCMonth() ||
    (now.getMonth() === date.getUTCMonth() && now.getDate() < date.getUTCDate());
  if (birthdayPending) age -= 1;
  return age >= 0 && age <= 130 ? age : null;
}

function patientDate(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return null;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}
