import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NzIconModule } from 'ng-zorro-antd/icon';

import { OcButton, OcDataTableShell, OcEmptyState, OcIcon } from '../../../shared/ui';
import { PracticePatientDto } from '../practice-patient-api.models';
import { AddPatientDialog } from './add-patient-dialog';
import {
  DemoPatientCategory,
  DemoPatientLinkage,
  DemoPatientRecord,
  DemoPatientSource,
  demoPatientAge,
  demoPatientFullName,
} from './patient-directory-demo.fixtures';
import { PatientDirectoryDemoStore } from './patient-directory-demo.store';

type DirectoryState = 'ready' | 'loading' | 'error';
type SortKey =
  'patient' | 'contact' | 'lastConsultation' | 'nextAppointment' | 'linkage' | 'source';
type SortDirection = 'asc' | 'desc';
type LastConsultationFilter = 'ALL' | '30' | '90' | '365' | 'NONE';

const DEMO_NOW = new Date('2026-10-29T12:00:00+01:00').getTime();
const DAY_MS = 86_400_000;

function allowedValue<T extends string>(
  value: string | null,
  allowed: readonly T[],
  fallback: T,
): T {
  return value !== null && allowed.includes(value as T) ? (value as T) : fallback;
}

function positiveInteger(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalized(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr-FR');
}

function compareNullableDates(left: string | null, right: string | null): number {
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left.localeCompare(right);
}

@Component({
  selector: 'app-patients-page',
  imports: [
    RouterLink,
    NzIconModule,
    OcButton,
    OcDataTableShell,
    OcEmptyState,
    OcIcon,
    AddPatientDialog,
  ],
  templateUrl: './patients-page.static-demo.html',
  styleUrl: './patients-page.static-demo.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientsPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly patientStore = inject(PatientDirectoryDemoStore);

  readonly demoNotice =
    'Données administratives fictives présentées uniquement dans la démonstration statique OmniCare.';
  readonly searchTerm = signal(this.route.snapshot.queryParamMap.get('q') ?? '');
  readonly activeCategory = signal<DemoPatientCategory | 'ALL'>(
    allowedValue(
      this.route.snapshot.queryParamMap.get('category'),
      ['ALL', 'LINKED', 'CABINET', 'WALK_IN'],
      'ALL',
    ),
  );
  readonly sourceFilter = signal<DemoPatientSource | 'ALL'>(
    allowedValue(
      this.route.snapshot.queryParamMap.get('source'),
      ['ALL', 'OMNICARE', 'MANUAL', 'IMPORTED', 'WALK_IN'],
      'ALL',
    ),
  );
  readonly linkageFilter = signal<DemoPatientLinkage | 'ALL'>(
    allowedValue(
      this.route.snapshot.queryParamMap.get('linkage'),
      ['ALL', 'LINKED', 'POSSIBLE', 'UNLINKED'],
      'ALL',
    ),
  );
  readonly lastConsultationFilter = signal<LastConsultationFilter>(
    allowedValue(
      this.route.snapshot.queryParamMap.get('last'),
      ['ALL', '30', '90', '365', 'NONE'],
      'ALL',
    ),
  );
  readonly sortKey = signal<SortKey>(
    allowedValue(
      this.route.snapshot.queryParamMap.get('sort'),
      ['patient', 'contact', 'lastConsultation', 'nextAppointment', 'linkage', 'source'],
      'patient',
    ),
  );
  readonly sortDirection = signal<SortDirection>(
    allowedValue(this.route.snapshot.queryParamMap.get('direction'), ['asc', 'desc'], 'asc'),
  );
  readonly page = signal(positiveInteger(this.route.snapshot.queryParamMap.get('page'), 1));
  readonly pageSize = signal(
    Number(allowedValue(this.route.snapshot.queryParamMap.get('size'), ['10', '20', '50'], '10')),
  );
  readonly selectedIds = signal<ReadonlySet<string>>(new Set());
  readonly filtersExpanded = signal(this.route.snapshot.queryParamMap.get('filters') === 'open');
  readonly addDialogOpen = signal(false);
  readonly createdMessage = signal<string | null>(null);
  readonly tableState = signal<DirectoryState>(this.initialState());

  readonly patients = this.patientStore.patients;
  readonly categoryCounts = computed(() => {
    const counts = { ALL: 0, LINKED: 0, CABINET: 0, WALK_IN: 0 };
    for (const patient of this.patients()) {
      counts.ALL += 1;
      counts[patient.category] += 1;
    }
    return counts;
  });
  readonly categoryOptions = computed(() => {
    const counts = this.categoryCounts();
    return [
      { value: 'ALL', label: `Tous (${this.formatInteger(counts.ALL)})` },
      { value: 'LINKED', label: `Liés à OmniCare (${this.formatInteger(counts.LINKED)})` },
      { value: 'CABINET', label: `Patients cabinet (${this.formatInteger(counts.CABINET)})` },
      { value: 'WALK_IN', label: `Patients de passage (${this.formatInteger(counts.WALK_IN)})` },
    ];
  });

  readonly filteredPatients = computed(() => {
    const query = normalized(this.searchTerm().trim());
    const category = this.activeCategory();
    const source = this.sourceFilter();
    const linkage = this.linkageFilter();
    const lastConsultation = this.lastConsultationFilter();

    return this.patients().filter((patient) => {
      if (category !== 'ALL' && patient.category !== category) return false;
      if (source !== 'ALL' && patient.source !== source) return false;
      if (linkage !== 'ALL' && patient.linkage !== linkage) return false;
      if (query) {
        const searchable = normalized(
          `${demoPatientFullName(patient)} ${patient.phone} ${patient.insuranceNumber} ${patient.email ?? ''}`,
        );
        if (!searchable.includes(query)) return false;
      }
      if (lastConsultation === 'NONE') return patient.lastConsultation === null;
      if (lastConsultation !== 'ALL') {
        if (!patient.lastConsultation) return false;
        const elapsedDays = (DEMO_NOW - new Date(patient.lastConsultation).getTime()) / DAY_MS;
        return elapsedDays >= 0 && elapsedDays <= Number(lastConsultation);
      }
      return true;
    });
  });

  readonly sortedPatients = computed(() => {
    const key = this.sortKey();
    const multiplier = this.sortDirection() === 'asc' ? 1 : -1;
    return [...this.filteredPatients()].sort((left, right) => {
      let comparison = 0;
      switch (key) {
        case 'patient':
          comparison = demoPatientFullName(left).localeCompare(demoPatientFullName(right), 'fr');
          break;
        case 'contact':
          comparison = left.phone.localeCompare(right.phone, 'fr');
          break;
        case 'lastConsultation':
          comparison = compareNullableDates(left.lastConsultation, right.lastConsultation);
          break;
        case 'nextAppointment':
          comparison = compareNullableDates(left.nextAppointment, right.nextAppointment);
          break;
        case 'linkage':
          comparison = left.linkage.localeCompare(right.linkage, 'fr');
          break;
        case 'source':
          comparison = left.source.localeCompare(right.source, 'fr');
          break;
      }
      return comparison * multiplier;
    });
  });

  readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.sortedPatients().length / this.pageSize())),
  );
  readonly visiblePatients = computed(() => {
    const validPage = Math.min(this.page(), this.pageCount());
    const start = (validPage - 1) * this.pageSize();
    return this.sortedPatients().slice(start, start + this.pageSize());
  });
  readonly resultStart = computed(() =>
    this.sortedPatients().length === 0
      ? 0
      : (Math.min(this.page(), this.pageCount()) - 1) * this.pageSize() + 1,
  );
  readonly resultEnd = computed(() =>
    Math.min(this.resultStart() + this.visiblePatients().length - 1, this.sortedPatients().length),
  );
  readonly pageNumbers = computed(() => {
    const total = this.pageCount();
    const current = Math.min(this.page(), total);
    const start = Math.max(1, Math.min(current - 2, total - 4));
    const end = Math.min(total, start + 4);
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  });
  readonly activeFilterCount = computed(
    () =>
      Number(this.sourceFilter() !== 'ALL') +
      Number(this.linkageFilter() !== 'ALL') +
      Number(this.lastConsultationFilter() !== 'ALL'),
  );
  readonly allVisibleSelected = computed(() => {
    const visible = this.visiblePatients();
    return visible.length > 0 && visible.every((patient) => this.selectedIds().has(patient.id));
  });

  onSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
    this.page.set(1);
    this.syncQueryState();
  }

  onCategoryChange(value: string): void {
    this.activeCategory.set(value as DemoPatientCategory | 'ALL');
    this.page.set(1);
    this.selectedIds.set(new Set());
    this.syncQueryState();
  }

  onSourceChange(event: Event): void {
    this.sourceFilter.set((event.target as HTMLSelectElement).value as DemoPatientSource | 'ALL');
    this.page.set(1);
    this.syncQueryState();
  }

  onLinkageChange(event: Event): void {
    this.linkageFilter.set((event.target as HTMLSelectElement).value as DemoPatientLinkage | 'ALL');
    this.page.set(1);
    this.syncQueryState();
  }

  onLastConsultationChange(event: Event): void {
    this.lastConsultationFilter.set(
      (event.target as HTMLSelectElement).value as LastConsultationFilter,
    );
    this.page.set(1);
    this.syncQueryState();
  }

  onPageSizeChange(event: Event): void {
    this.pageSize.set(Number((event.target as HTMLSelectElement).value));
    this.page.set(1);
    this.syncQueryState();
  }

  resetFilters(): void {
    this.searchTerm.set('');
    this.sourceFilter.set('ALL');
    this.linkageFilter.set('ALL');
    this.lastConsultationFilter.set('ALL');
    this.page.set(1);
    this.syncQueryState();
  }

  toggleFilters(): void {
    this.filtersExpanded.update((value) => !value);
    this.syncQueryState();
  }

  toggleSort(key: SortKey): void {
    if (this.sortKey() === key) {
      this.sortDirection.update((direction) => (direction === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortKey.set(key);
      this.sortDirection.set('asc');
    }
    this.page.set(1);
    this.syncQueryState();
  }

  ariaSort(key: SortKey): 'ascending' | 'descending' | 'none' {
    if (this.sortKey() !== key) return 'none';
    return this.sortDirection() === 'asc' ? 'ascending' : 'descending';
  }

  setPage(page: number): void {
    this.page.set(Math.min(Math.max(1, page), this.pageCount()));
    this.syncQueryState();
  }

  togglePatient(id: string, checked: boolean): void {
    const next = new Set(this.selectedIds());
    if (checked) next.add(id);
    else next.delete(id);
    this.selectedIds.set(next);
  }

  toggleVisible(checked: boolean): void {
    const next = new Set(this.selectedIds());
    for (const patient of this.visiblePatients()) {
      if (checked) next.add(patient.id);
      else next.delete(patient.id);
    }
    this.selectedIds.set(next);
  }

  onPatientCreated(patient: PracticePatientDto): void {
    const created = this.patientStore.add(patient);
    this.createdMessage.set(this.patientStore.createdMessage(created));
    this.activeCategory.set('ALL');
    this.resetFilters();
    this.sortKey.set('patient');
    this.sortDirection.set('asc');
    this.syncQueryState();
  }

  openDuplicate(id: string): void {
    void this.router.navigate(['/doctor/patient', id]);
  }

  retry(): void {
    this.tableState.set('ready');
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { state: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  fullName(patient: DemoPatientRecord): string {
    return demoPatientFullName(patient);
  }

  age(patient: DemoPatientRecord): number {
    return demoPatientAge(patient);
  }

  initials(patient: DemoPatientRecord): string {
    return `${patient.firstName[0] ?? ''}${patient.lastName[0] ?? ''}`.toLocaleUpperCase('fr-FR');
  }

  formatDate(value: string | null): string {
    if (!value) return '—';
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'Africa/Tunis',
    }).format(new Date(value));
  }

  formatTime(value: string | null): string {
    if (!value) return '';
    return new Intl.DateTimeFormat('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Africa/Tunis',
    }).format(new Date(value));
  }

  sourceLabel(source: DemoPatientSource): string {
    return { OMNICARE: 'OmniCare', MANUAL: 'Manuel', IMPORTED: 'Importé', WALK_IN: 'Passage' }[
      source
    ];
  }

  linkageLabel(linkage: DemoPatientLinkage): string {
    return {
      LINKED: 'Lié à OmniCare',
      POSSIBLE: 'Correspondance possible',
      UNLINKED: 'Non lié',
    }[linkage];
  }

  formatInteger(value: number): string {
    return new Intl.NumberFormat('fr-FR').format(value);
  }

  private initialState(): DirectoryState {
    const requested = this.route.snapshot.queryParamMap.get('state');
    return requested === 'loading' || requested === 'error' ? requested : 'ready';
  }

  private syncQueryState(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: this.searchTerm().trim() || null,
        category: this.activeCategory() === 'ALL' ? null : this.activeCategory(),
        source: this.sourceFilter() === 'ALL' ? null : this.sourceFilter(),
        linkage: this.linkageFilter() === 'ALL' ? null : this.linkageFilter(),
        last: this.lastConsultationFilter() === 'ALL' ? null : this.lastConsultationFilter(),
        sort: this.sortKey() === 'patient' ? null : this.sortKey(),
        direction: this.sortDirection() === 'asc' ? null : this.sortDirection(),
        page: this.page() === 1 ? null : this.page(),
        size: this.pageSize() === 10 ? null : this.pageSize(),
        filters: this.filtersExpanded() ? 'open' : null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
