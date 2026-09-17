import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect, signal,
  inject,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { timer } from 'rxjs';

import {
  OcButton,
  OcDataTableShell,
  OcEmptyState,
  OcPageHeader,
  OcStatusBadge, OcSheet, OcIcon,
} from '../../shared/ui';
import { ClinicTaskListItem, hasClinicCapability } from './clinic-api.models';
import { clinicCaseReference, clinicPriorityLabel } from './clinic-case-utils';
import { ClinicContextStore } from './clinic-context.store';
import { ClinicTaskListKind, ClinicTaskStore } from './clinic-task.store';
import {
  clinicTaskReference,
  isAcknowledgementOverdue,
  isTaskDeadlineOverdue,
  clinicTaskStatusLabel,
  clinicTaskStatusTone,
  clinicTaskTypeLabel,
} from './clinic-task-utils';
import { TaskDetailPresentationService } from './task-detail-presentation.service';

const DEFAULT_PAGE_SIZE = 20;

@Component({
  selector: 'app-clinic-task-list-page',
  imports: [
    DatePipe,
    RouterLink,
    OcButton,
    OcDataTableShell,
    OcEmptyState,
    OcPageHeader,
    OcStatusBadge, OcSheet, OcIcon,
  ],
  providers: [ClinicTaskStore],
  templateUrl: './clinic-task-list-page.html',
  styleUrl: './clinic-task-list-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClinicTaskListPage {
  private readonly context = inject(ClinicContextStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly detailPresentation = inject(TaskDetailPresentationService);
  readonly store = inject(ClinicTaskStore);
  private readonly queryParamMap = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  private loadedRequestKey = '';

  readonly kind = (this.route.snapshot.data['kind'] as ClinicTaskListKind | undefined) ?? 'queue';
  readonly isQueue = this.kind === 'queue';
  readonly pageTitle = this.isQueue ? 'Position Queue' : 'My Tasks';
  readonly description = this.isQueue
    ? 'Acknowledge work available to your current clinic position.'
    : 'Active tasks currently assigned to you.';
  readonly page = computed(() => readPage(this.queryParamMap().get('page')));
  readonly tableState = computed<'default' | 'loading' | 'empty'>(() => {
    if (this.store.error() !== null) return 'default';
    if (this.store.loading()) return 'loading';
    return this.store.isEmpty() ? 'empty' : 'default';
  });
  readonly taskTypeLabel = clinicTaskTypeLabel;
  readonly statusLabel = clinicTaskStatusLabel;
  readonly statusTone = clinicTaskStatusTone;
  readonly priorityLabel = clinicPriorityLabel;
  readonly taskReference = clinicTaskReference;
  readonly caseReference = clinicCaseReference;
  readonly taskDeadlineOverdue = isTaskDeadlineOverdue;
  readonly selectedTask = signal<ClinicTaskListItem | null>(null);

  constructor() {
    this.context.initialize({ route: false });
    effect(() => {
      const clinicId = this.context.selectedClinicId();
      const bootstrap = this.context.bootstrap();
      const page = this.page();
      if (clinicId === null || !hasClinicCapability(bootstrap, 'CLINIC_TASK_READ')) return;
      const requestKey = `${clinicId}|${this.kind}|${page}`;
      if (requestKey === this.loadedRequestKey) return;
      this.loadedRequestKey = requestKey;
      this.store.loadList({ clinicId, kind: this.kind, page, pageSize: DEFAULT_PAGE_SIZE });
    });
    timer(30_000, 30_000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.store.refreshList());
  }

  refresh(): void {
    this.store.refreshList();
  }

  acknowledge(task: ClinicTaskListItem): void {
    this.store.acknowledge(task);
  }

  previousPage(): void {
    if (this.page() > 0) void this.goToPage(this.page() - 1);
  }

  nextPage(): void {
    if (this.store.hasNext()) void this.goToPage(this.page() + 1);
  }

  selectTask(task: ClinicTaskListItem): void {
    if (this.kind === 'my' && this.detailPresentation.usePanel()) {
      this.selectedTask.set(task);
      return;
    }
    void this.router.navigate(['/clinic/tasks', task.taskId]);
  }

  closeTaskPanel(): void { this.selectedTask.set(null); }

  acknowledgementDeadlineOverdue(task: ClinicTaskListItem): boolean {
    return task.status === 'ASSIGNED' && isAcknowledgementOverdue({ ...task, acknowledgedAt: null });
  }

  private goToPage(page: number): Promise<boolean> {
    return this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: page === 0 ? null : page },
      queryParamsHandling: 'merge',
    });
  }
}

function readPage(raw: string | null): number {
  if (raw === null || !/^\d+$/.test(raw)) return 0;
  const page = Number(raw);
  return Number.isSafeInteger(page) && page <= 10_000 ? page : 0;
}
