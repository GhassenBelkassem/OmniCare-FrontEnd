import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';

import { PracticePatientApiService } from '../practice-patient-api.service';
import type {
  PracticePatientDto,
  PracticePatientFilterDto,
  PracticePatientSourceDto,
} from '../practice-patient-api.models';
import { AddPatientDialog } from './add-patient-dialog';
import { PatientDirectoryView } from './patient-directory-view';
import type {
  PatientDirectoryAction,
  PatientDirectoryLinkage,
  PatientDirectoryRow,
  PatientDirectorySource,
  PatientDirectoryViewModel,
} from './patient-directory-view.models';

const PATIENTS_PAGE_SIZE = 20;
type PatientsLoadState = 'loading' | 'ready' | 'error';

const SOURCE_LABELS: Record<
  PracticePatientSourceDto,
  { readonly key: PatientDirectorySource; readonly label: string }
> = {
  MANUAL: { key: 'manual', label: 'Manuel' },
  IMPORTED: { key: 'imported', label: 'Importé' },
  OMNICARE: { key: 'omnicare', label: 'OmniCare' },
};

@Component({
  selector: 'app-patients-page',
  host: { class: 'patients-page--production' },
  imports: [PatientDirectoryView, AddPatientDialog],
  templateUrl: './patients-page.html',
  styleUrl: './patients-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientsPage {
  private readonly router = inject(Router);
  private readonly api = inject(PracticePatientApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly searchTerm = signal('');
  readonly activeFilter = signal<PracticePatientFilterDto>('ALL');
  readonly pageIndex = signal(1);
  readonly pageSize = PATIENTS_PAGE_SIZE;
  readonly totalPages = signal(1);
  readonly patients = signal<readonly PracticePatientDto[]>([]);
  readonly totalElements = signal(0);
  readonly loadState = signal<PatientsLoadState>('loading');
  readonly addDialogOpen = signal(false);
  readonly lastCreated = signal<PracticePatientDto | null>(null);

  readonly viewModel = computed<PatientDirectoryViewModel>(() => {
    const page = this.pageIndex();
    const total = this.totalElements();
    const rows = this.patients().map((patient) => productionPatientRow(patient));
    return {
      notice: null,
      headingCount: total,
      createdMessage: createdMessage(this.lastCreated()),
      categories: [
        { value: 'ALL', label: 'Tous' },
        { value: 'LINKED', label: 'Liés à OmniCare' },
        { value: 'EXTERNAL', label: 'Non liés' },
      ],
      activeCategory: this.activeFilter(),
      searchTerm: this.searchTerm(),
      searchPlaceholder: 'Rechercher par nom ou téléphone…',
      advancedFilters: null,
      state: this.loadState(),
      loadingDescription: 'Chargement de votre répertoire de pratique.',
      errorDescription: 'Le répertoire n’a pas pu être chargé. Réessayez dans un instant.',
      rows,
      totalResults: total,
      selectable: false,
      selectedIds: new Set<string>(),
      allVisibleSelected: false,
      sortable: false,
      sortKey: 'patient',
      sortDirection: 'asc',
      resultStart: total === 0 ? 0 : (page - 1) * this.pageSize + 1,
      resultEnd: total === 0 ? 0 : Math.min((page - 1) * this.pageSize + rows.length, total),
      page,
      pageCount: Math.max(1, this.totalPages()),
      pageNumbers: pageNumbers(page, this.totalPages()),
      pageSize: this.pageSize,
      pageSizeOptions: [],
    };
  });

  constructor() {
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        const term = value.trim();
        if (term === this.searchTerm()) return;
        this.searchTerm.set(term);
        this.pageIndex.set(1);
        this.loadPatients();
      });
    this.loadPatients();
  }

  handleViewAction(action: PatientDirectoryAction): void {
    switch (action.kind) {
      case 'ADD_PATIENT':
        this.addDialogOpen.set(true);
        return;
      case 'DISMISS_CREATED':
        this.lastCreated.set(null);
        return;
      case 'SEARCH':
        this.searchControl.setValue(action.value);
        return;
      case 'SELECT_CATEGORY':
        this.selectFilter(action.value);
        return;
      case 'RESET_FILTERS':
        this.resetFilters();
        return;
      case 'RETRY':
        this.loadPatients();
        return;
      case 'OPEN_PATIENT':
        void this.router.navigate(['/doctor', 'patient', action.id]);
        return;
      case 'SET_PAGE':
        this.setPage(action.value);
        return;
      case 'TOGGLE_FILTERS':
      case 'SELECT_LAST_CONSULTATION':
      case 'SELECT_SOURCE':
      case 'SELECT_LINKAGE':
      case 'SORT':
      case 'TOGGLE_VISIBLE':
      case 'TOGGLE_PATIENT':
      case 'SET_PAGE_SIZE':
        return;
    }
  }

  onPatientCreated(patient: PracticePatientDto): void {
    this.lastCreated.set(patient);
    this.pageIndex.set(1);
    this.loadPatients();
  }

  onDuplicateConfirmed(existingPatientId: string): void {
    void this.router.navigate(['/doctor', 'patient', existingPatientId]);
  }

  private selectFilter(value: string): void {
    if (value !== 'ALL' && value !== 'LINKED' && value !== 'EXTERNAL') return;
    if (this.activeFilter() === value) return;
    this.activeFilter.set(value);
    this.pageIndex.set(1);
    this.loadPatients();
  }

  private resetFilters(): void {
    const alreadyReset =
      this.searchTerm() === '' && this.activeFilter() === 'ALL' && this.pageIndex() === 1;
    this.searchControl.setValue('', { emitEvent: false });
    this.searchTerm.set('');
    this.activeFilter.set('ALL');
    this.pageIndex.set(1);
    if (!alreadyReset || this.loadState() === 'error') this.loadPatients();
  }

  private setPage(page: number): void {
    const next = Math.min(Math.max(1, page), Math.max(1, this.totalPages()));
    if (next === this.pageIndex()) return;
    this.pageIndex.set(next);
    this.loadPatients();
  }

  private loadPatients(): void {
    this.loadState.set('loading');
    this.api
      .listPatients({
        query: this.searchTerm(),
        filter: this.activeFilter(),
        page: this.pageIndex() - 1,
        size: this.pageSize,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.patients.set(page.content);
          this.totalElements.set(page.totalElements);
          this.totalPages.set(page.totalPages);
          this.loadState.set('ready');
        },
        error: () => this.loadState.set('error'),
      });
  }
}

function productionPatientRow(patient: PracticePatientDto): PatientDirectoryRow {
  const name = `${patient.lastName} ${patient.firstName}`;
  const source = SOURCE_LABELS[patient.source];
  const linkage = productionLinkage(patient);
  return {
    id: patient.id,
    href: `/doctor/patient/${encodeURIComponent(patient.id)}`,
    initials: `${patient.firstName[0] ?? ''}${patient.lastName[0] ?? ''}`.toLocaleUpperCase(
      'fr-FR',
    ),
    displayName: name,
    accessibleName: `${patient.firstName} ${patient.lastName}`,
    secondaryLabel: patientSecondaryLabel(patient),
    phone: patient.phone,
    emailLabel: patient.email?.trim() || 'Email non renseigné',
    lastConsultation: null,
    nextAppointment: null,
    linkage,
    linkageLabel: {
      linked: 'Lié à OmniCare',
      possible: 'Correspondance possible',
      unlinked: 'Non lié',
    }[linkage],
    source: source.key,
    sourceLabel: source.label,
  };
}

function productionLinkage(patient: PracticePatientDto): PatientDirectoryLinkage {
  if (patient.linkedOmniCareUserId) return 'linked';
  return patient.possibleOmniCareMatch ? 'possible' : 'unlinked';
}

function patientSecondaryLabel(patient: PracticePatientDto): string {
  const sex = patient.sex === 'F' ? 'Femme' : patient.sex === 'M' ? 'Homme' : 'Autre';
  const age = ageFromDateOfBirth(patient.dateOfBirth);
  return age === null ? `Âge non renseigné · ${sex}` : `${age} ans · ${sex}`;
}

function ageFromDateOfBirth(value: string | null): number | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const now = new Date();
  let age = now.getFullYear() - year;
  if (now.getMonth() + 1 < month || (now.getMonth() + 1 === month && now.getDate() < day)) {
    age -= 1;
  }
  return age >= 0 && age <= 130 ? age : null;
}

function createdMessage(patient: PracticePatientDto | null): string | null {
  if (!patient) return null;
  const name = `${patient.firstName} ${patient.lastName}`;
  return patient.possibleOmniCareMatch
    ? `${name} a été ajouté. Une correspondance OmniCare est possible.`
    : `${name} a été ajouté.`;
}

function pageNumbers(currentPage: number, totalPages: number): readonly number[] {
  const total = Math.max(1, totalPages);
  const current = Math.min(Math.max(1, currentPage), total);
  const start = Math.max(1, Math.min(current - 2, total - 4));
  const end = Math.min(total, start + 4);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}
