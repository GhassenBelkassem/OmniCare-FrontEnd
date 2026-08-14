import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NzSelectModule } from 'ng-zorro-antd/select';

import {
  OcButton,
  OcDataTableShell,
  OcEmptyState,
  OcPageHeader,
  OcStatusBadge,
} from '../../shared/ui';
import {
  CLINIC_CASE_STATUSES,
  CLINIC_REQUESTS_READ_CAPABILITY,
  ClinicCaseListItem,
  ClinicCaseStatus,
  hasClinicCapability,
} from './clinic-api.models';
import { ClinicCaseStore } from './clinic-case.store';
import {
  CLINIC_CASE_STATUS_OPTIONS,
  clinicCaseReference,
  clinicCaseSituationLabel,
  clinicCaseStatusLabel,
  clinicCaseStatusTone,
  clinicPriorityLabel,
  clinicWorkflowStepLabel,
} from './clinic-case-utils';
import { ClinicContextStore } from './clinic-context.store';

type StatusFilter = 'ALL' | ClinicCaseStatus;
type TableState = 'default' | 'loading' | 'empty';

const PAGE_SIZES = [20, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 20;

@Component({
  selector: 'app-clinic-intake-page',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    NzSelectModule,
    OcButton,
    OcDataTableShell,
    OcEmptyState,
    OcPageHeader,
    OcStatusBadge,
  ],
  providers: [ClinicCaseStore],
  templateUrl: './clinic-intake-page.html',
  styleUrl: './clinic-intake-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClinicIntakePage {
  private readonly context = inject(ClinicContextStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly store = inject(ClinicCaseStore);

  private readonly queryParamMap = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  private loadedRequestKey = '';

  readonly statusControl = new FormControl<StatusFilter>(this.readStatus(), { nonNullable: true });
  readonly pageSizeControl = new FormControl<number>(this.readPageSize(), { nonNullable: true });
  readonly statusOptions = CLINIC_CASE_STATUS_OPTIONS;
  readonly pageSizes = PAGE_SIZES;
  readonly statusLabel = clinicCaseStatusLabel;
  readonly statusTone = clinicCaseStatusTone;
  readonly situationLabel = clinicCaseSituationLabel;
  readonly priorityLabel = clinicPriorityLabel;
  readonly stepLabel = clinicWorkflowStepLabel;
  readonly reference = clinicCaseReference;

  readonly statusFilter = computed(() => this.readStatus());
  readonly page = computed(() => this.readPage());
  readonly pageSize = computed(() => this.readPageSize());
  readonly hasActiveFilter = computed(() => this.statusFilter() !== 'ALL');
  readonly tableState = computed<TableState>(() => {
    if (this.store.error() !== null) return 'default';
    if (this.store.loading()) return 'loading';
    if (this.store.isEmpty()) return 'empty';
    return 'default';
  });

  constructor() {
    this.context.initialize({ route: false });

    this.statusControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((status) => void this.updateQuery({ status, page: 0 }));
    this.pageSizeControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((pageSize) => void this.updateQuery({ pageSize, page: 0 }));

    effect(() => {
      const clinicId = this.context.selectedClinicId();
      const bootstrap = this.context.bootstrap();
      const status = this.statusFilter();
      const page = this.page();
      const pageSize = this.pageSize();

      this.statusControl.setValue(status, { emitEvent: false });
      this.pageSizeControl.setValue(pageSize, { emitEvent: false });

      if (
        clinicId === null ||
        !hasClinicCapability(bootstrap, CLINIC_REQUESTS_READ_CAPABILITY)
      ) {
        return;
      }

      const requestKey = `${clinicId}|${status}|${page}|${pageSize}`;
      if (requestKey === this.loadedRequestKey) return;
      this.loadedRequestKey = requestKey;
      this.store.loadList({
        clinicId,
        statuses: status === 'ALL' ? [] : [status],
        page,
        pageSize,
      });
    });
  }

  refresh(): void {
    this.store.refreshList();
  }

  clearFilters(): void {
    void this.updateQuery({ status: 'ALL', page: 0 });
  }

  previousPage(): void {
    if (this.page() > 0) void this.updateQuery({ page: this.page() - 1 });
  }

  nextPage(): void {
    if (this.store.hasNext()) void this.updateQuery({ page: this.page() + 1 });
  }

  trackRequest(_index: number, request: ClinicCaseListItem): string {
    return request.clinicCaseId;
  }

  private readStatus(): StatusFilter {
    const value = this.queryParamMap().get('status');
    return value !== null && (CLINIC_CASE_STATUSES as readonly string[]).includes(value)
      ? (value as ClinicCaseStatus)
      : 'ALL';
  }

  private readPage(): number {
    return readBoundedInteger(this.queryParamMap().get('page'), 0, 0, 10_000);
  }

  private readPageSize(): number {
    const value = readBoundedInteger(
      this.queryParamMap().get('pageSize'),
      DEFAULT_PAGE_SIZE,
      PAGE_SIZES[0],
      PAGE_SIZES[PAGE_SIZES.length - 1],
    );
    return (PAGE_SIZES as readonly number[]).includes(value) ? value : DEFAULT_PAGE_SIZE;
  }

  private updateQuery(
    update: { readonly status?: StatusFilter; readonly page?: number; readonly pageSize?: number },
  ): Promise<boolean> {
    const status = update.status ?? this.statusFilter();
    const page = update.page ?? this.page();
    const pageSize = update.pageSize ?? this.pageSize();
    return this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        status: status === 'ALL' ? null : status,
        page: page === 0 ? null : page,
        pageSize: pageSize === DEFAULT_PAGE_SIZE ? null : pageSize,
      },
      queryParamsHandling: 'merge',
    });
  }
}

function readBoundedInteger(
  raw: string | null,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (raw === null || !/^\d+$/.test(raw)) return fallback;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= minimum && value <= maximum ? value : fallback;
}
