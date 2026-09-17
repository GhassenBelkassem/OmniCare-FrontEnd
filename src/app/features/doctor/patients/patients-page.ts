import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzPaginationModule } from 'ng-zorro-antd/pagination';

import {
  OcAvatar,
  OcButton,
  OcDataTableShell,
  OcEmptyState,
  OcPageHeader,
  OcSegmentedControl,
  type OcSegmentOption,
} from '../../../shared/ui';
import { AddPatientDialog } from './add-patient-dialog';
import { PracticePatientApiService } from '../practice-patient-api.service';
import {
  PracticePatientDto,
  PracticePatientFilterDto,
  PracticePatientSourceDto,
} from '../practice-patient-api.models';

const PATIENTS_PAGE_SIZE = 20;

type PatientsLoadState = 'loading' | 'ready' | 'error';
type LinkStatus = 'linked' | 'match' | 'unlinked';

@Component({
  selector: 'app-patients-page',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    NzAlertModule,
    NzIconModule,
    NzInputModule,
    NzPaginationModule,
    OcPageHeader,
    OcDataTableShell,
    OcEmptyState,
    OcButton,
    OcAvatar,
    OcSegmentedControl,
    AddPatientDialog,
  ],
  templateUrl: './patients-page.html',
  styleUrls: ['./patients-page.scss'],
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

  readonly patients = signal<readonly PracticePatientDto[]>([]);
  readonly totalElements = signal(0);
  readonly loadState = signal<PatientsLoadState>('loading');

  readonly addDialogOpen = signal(false);
  readonly lastCreated = signal<PracticePatientDto | null>(null);

  readonly filterOptions: readonly OcSegmentOption[] = [
    { value: 'ALL', label: 'Tous' },
    { value: 'LINKED', label: 'Liés à OmniCare' },
    { value: 'EXTERNAL', label: 'Non liés' },
  ];

  private static readonly SOURCE_LABELS: Record<PracticePatientSourceDto, string> = {
    MANUAL: 'Manuel',
    IMPORTED: 'Importé',
    OMNICARE: 'OmniCare',
  };

  private static readonly LINK_LABELS: Record<LinkStatus, string> = {
    linked: 'Lié à OmniCare',
    match: 'Correspondance possible',
    unlinked: 'Non lié',
  };

  readonly shellState = computed(() => {
    if (this.loadState() === 'loading') {
      return 'loading' as const;
    }
    return this.patients().length === 0 ? ('empty' as const) : ('default' as const);
  });

  readonly hasMultiplePages = computed(() => this.totalElements() > this.pageSize);

  constructor() {
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        const term = value.trim();
        if (term === this.searchTerm()) {
          return;
        }
        this.searchTerm.set(term);
        this.pageIndex.set(1);
        this.loadPatients();
      });
    this.loadPatients();
  }

  onSegmentChange(value: string): void {
    const filter = value as PracticePatientFilterDto;
    if (this.activeFilter() === filter) {
      return;
    }
    this.activeFilter.set(filter);
    this.pageIndex.set(1);
    this.loadPatients();
  }

  onPageIndexChange(index: number): void {
    if (index === this.pageIndex()) {
      return;
    }
    this.pageIndex.set(index);
    this.loadPatients();
  }

  onRetry(): void {
    this.loadPatients();
  }

  onAddPatient(): void {
    this.addDialogOpen.set(true);
  }

  onPatientCreated(patient: PracticePatientDto): void {
    this.lastCreated.set(patient);
    this.pageIndex.set(1);
    this.loadPatients();
  }

  onDuplicateConfirmed(existingPatientId: string): void {
    void this.router.navigate(['/doctor', 'patient', existingPatientId]);
  }

  onPatientClick(patient: PracticePatientDto): void {
    void this.router.navigate(['/doctor', 'patient', patient.id]);
  }

  dismissCreatedNotice(): void {
    this.lastCreated.set(null);
  }

  sourceLabel(patient: PracticePatientDto): string {
    return PatientsPage.SOURCE_LABELS[patient.source];
  }

  linkStatus(patient: PracticePatientDto): LinkStatus {
    if (patient.linkedOmniCareUserId) {
      return 'linked';
    }
    return patient.possibleOmniCareMatch ? 'match' : 'unlinked';
  }

  linkLabel(patient: PracticePatientDto): string {
    return PatientsPage.LINK_LABELS[this.linkStatus(patient)];
  }

  trackByPatientId(_index: number, patient: PracticePatientDto): string {
    return patient.id;
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
          this.loadState.set('ready');
        },
        error: () => {
          this.loadState.set('error');
        },
      });
  }
}
