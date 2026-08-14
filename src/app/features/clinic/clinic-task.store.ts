import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Observable, Subject, catchError, switchMap, tap } from 'rxjs';

import {
  ClinicCaseDetail,
  ClinicTaskDetail,
  ClinicGenericTaskBlockReason,
  ClinicTaskFailureReason,
  ClinicTaskListItem,
  ClinicTaskPage,
  ClinicTaskQuery,
} from './clinic-api.models';
import { ClinicApiService } from './clinic-api.service';
import {
  clinicTaskFailureMessage,
  isTaskVersionConflict,
  readClinicTaskFailureReason,
} from './clinic-task-utils';

export type ClinicTaskListKind = 'queue' | 'my';

export interface ClinicTaskListRequest {
  readonly clinicId: string;
  readonly kind: ClinicTaskListKind;
  readonly page: number;
  readonly pageSize: number;
  readonly refresh?: boolean;
}

export interface ClinicTaskDetailRequest {
  readonly clinicId: string;
  readonly taskId: string;
  readonly includeCase: boolean;
}

export type ClinicTaskCommand =
  'ACKNOWLEDGE' | 'START' | 'BLOCK' | 'UNBLOCK' | 'COMPLETE' | 'REASSIGN';

@Injectable()
export class ClinicTaskStore {
  private readonly api = inject(ClinicApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly listRequests = new Subject<ClinicTaskListRequest>();
  private readonly detailRequests = new Subject<ClinicTaskDetailRequest>();

  private readonly itemsState = signal<readonly ClinicTaskListItem[]>([]);
  private readonly pageState = signal(0);
  private readonly pageSizeState = signal(20);
  private readonly hasNextState = signal(false);
  private readonly generatedAtState = signal<string | null>(null);
  private readonly loadingState = signal(false);
  private readonly refreshingState = signal(false);
  private readonly errorState = signal<ClinicTaskFailureReason | null>(null);
  private readonly detailState = signal<ClinicTaskDetail | null>(null);
  private readonly caseState = signal<ClinicCaseDetail | null>(null);
  private readonly detailLoadingState = signal(false);
  private readonly detailErrorState = signal<ClinicTaskFailureReason | null>(null);
  private readonly commandState = signal<ClinicTaskCommand | null>(null);
  private readonly commandErrorState = signal<string | null>(null);
  private readonly commandNoticeState = signal<string | null>(null);

  readonly items = this.itemsState.asReadonly();
  readonly page = this.pageState.asReadonly();
  readonly pageSize = this.pageSizeState.asReadonly();
  readonly hasNext = this.hasNextState.asReadonly();
  readonly generatedAt = this.generatedAtState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly refreshing = this.refreshingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly errorMessage = computed(() => {
    const error = this.errorState();
    return error === null ? null : clinicTaskFailureMessage(error);
  });
  readonly detail = this.detailState.asReadonly();
  readonly caseDetail = this.caseState.asReadonly();
  readonly detailLoading = this.detailLoadingState.asReadonly();
  readonly detailError = this.detailErrorState.asReadonly();
  readonly detailNotFound = computed(() => {
    const error = this.detailErrorState();
    return error === 'CLINIC_TASK_NOT_FOUND' || error === 'CLINIC_TASK_VISIBILITY_FORBIDDEN';
  });
  readonly detailErrorMessage = computed(() => {
    const error = this.detailErrorState();
    return error === null ? null : clinicTaskFailureMessage(error);
  });
  readonly command = this.commandState.asReadonly();
  readonly commandError = this.commandErrorState.asReadonly();
  readonly commandNotice = this.commandNoticeState.asReadonly();
  readonly isEmpty = computed(() => !this.loadingState() && this.itemsState().length === 0);

  private lastListRequest: ClinicTaskListRequest | null = null;
  private lastDetailRequest: ClinicTaskDetailRequest | null = null;

  constructor() {
    this.listRequests
      .pipe(
        tap((request) => this.beginList(request)),
        switchMap((request) =>
          this.list(request).pipe(
            tap((page) => this.applyPage(page)),
            catchError((error: unknown) => {
              this.loadingState.set(false);
              this.refreshingState.set(false);
              this.errorState.set(readClinicTaskFailureReason(error));
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    this.detailRequests
      .pipe(
        tap((request) => {
          this.lastDetailRequest = request;
          this.detailLoadingState.set(true);
          this.detailErrorState.set(null);
          this.caseState.set(null);
        }),
        switchMap((request) =>
          this.api.getTask(request.clinicId, request.taskId).pipe(
            tap((detail) => {
              this.detailState.set(detail);
              this.detailLoadingState.set(false);
              if (request.includeCase) this.loadCase(request.clinicId, detail.caseId);
            }),
            catchError((error: unknown) => {
              this.detailState.set(null);
              this.detailLoadingState.set(false);
              this.detailErrorState.set(readClinicTaskFailureReason(error));
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  loadList(request: ClinicTaskListRequest): void {
    this.listRequests.next(request);
  }

  refreshList(): void {
    if (this.lastListRequest !== null) {
      this.listRequests.next({ ...this.lastListRequest, refresh: true });
    }
  }

  loadDetail(request: ClinicTaskDetailRequest): void {
    this.detailRequests.next(request);
  }

  refreshDetail(): void {
    if (this.lastDetailRequest !== null) this.detailRequests.next(this.lastDetailRequest);
  }

  acknowledge(task: ClinicTaskListItem): void {
    const clinicId = this.lastListRequest?.clinicId;
    if (clinicId === undefined) return;
    this.runCommand(
      'ACKNOWLEDGE',
      this.api.acknowledgeTask(clinicId, task.taskId, { expectedVersion: task.version }),
      'Task acknowledged. It is now available in My Tasks.',
      true,
    );
  }

  acknowledgeDetail(task: ClinicTaskDetail): void {
    const request = this.lastDetailRequest;
    if (request === null) return;
    this.runCommand(
      'ACKNOWLEDGE',
      this.api.acknowledgeTask(request.clinicId, task.taskId, { expectedVersion: task.version }),
      'Task acknowledged. It is now available in My Tasks.',
    );
  }

  start(task: ClinicTaskDetail): void {
    const request = this.lastDetailRequest;
    if (request === null) return;
    this.runCommand(
      'START',
      this.api.startTask(request.clinicId, task.taskId, { expectedVersion: task.version }),
      task.startedAt === null ? 'Task started.' : 'Task resumed.',
    );
  }

  reassign(task: ClinicTaskDetail, targetPositionId: string): void {
    const request = this.lastDetailRequest;
    if (request === null) return;
    this.runCommand(
      'REASSIGN',
      this.api.reassignTask(request.clinicId, task.taskId, {
        targetPositionId,
        expectedVersion: task.version,
      }),
      'Task reassigned to the selected position queue.',
    );
  }

  block(task: ClinicTaskDetail, reasonCode: ClinicGenericTaskBlockReason): void {
    const request = this.lastDetailRequest;
    if (request === null) return;
    this.runCommand(
      'BLOCK',
      this.api.blockTask(request.clinicId, task.taskId, {
        reasonCode,
        expectedVersion: task.version,
      }),
      'Task blocked. The backend preserved its ownership and deadlines.',
    );
  }

  unblock(task: ClinicTaskDetail): void {
    const request = this.lastDetailRequest;
    if (request === null) return;
    this.runCommand(
      'UNBLOCK',
      this.api.unblockTask(request.clinicId, task.taskId, { expectedVersion: task.version }),
      'Task unblocked and returned to in progress.',
    );
  }

  complete(task: ClinicTaskDetail): void {
    const request = this.lastDetailRequest;
    if (request === null) return;
    this.runCommand(
      'COMPLETE',
      this.api.completeTask(request.clinicId, task.taskId, { expectedVersion: task.version }),
      'Task completed.',
    );
  }

  runCaseCommand(
    command: 'BLOCK' | 'COMPLETE',
    request$: Observable<ClinicCaseDetail>,
    notice: string,
  ): void {
    if (this.commandState() !== null) return;
    this.commandState.set(command);
    this.commandErrorState.set(null);
    this.commandNoticeState.set(null);
    request$.subscribe({
      next: (caseDetail) => {
        this.caseState.set(caseDetail);
        this.commandState.set(null);
        this.commandNoticeState.set(notice);
        this.refreshDetail();
      },
      error: (error: unknown) => this.failCommand(command, error, false),
    });
  }

  clearCommandFeedback(): void {
    this.commandErrorState.set(null);
    this.commandNoticeState.set(null);
  }

  private list(request: ClinicTaskListRequest): Observable<ClinicTaskPage> {
    const query: ClinicTaskQuery = { page: request.page, pageSize: request.pageSize };
    return request.kind === 'queue'
      ? this.api.listPositionQueue(request.clinicId, query)
      : this.api.listMyTasks(request.clinicId, query);
  }

  private beginList(request: ClinicTaskListRequest): void {
    this.lastListRequest = { ...request, refresh: false };
    this.pageState.set(request.page);
    this.pageSizeState.set(request.pageSize);
    this.errorState.set(null);
    if (request.refresh === true || this.itemsState().length > 0) {
      this.refreshingState.set(true);
      this.loadingState.set(false);
    } else {
      this.itemsState.set([]);
      this.loadingState.set(true);
    }
  }

  private applyPage(page: ClinicTaskPage): void {
    this.itemsState.set(page.items);
    this.pageState.set(page.page);
    this.pageSizeState.set(page.pageSize);
    this.hasNextState.set(page.hasNext);
    this.generatedAtState.set(page.generatedAt);
    this.loadingState.set(false);
    this.refreshingState.set(false);
    this.errorState.set(null);
  }

  private runCommand(
    command: 'ACKNOWLEDGE' | 'START' | 'BLOCK' | 'UNBLOCK' | 'COMPLETE' | 'REASSIGN',
    request$: Observable<ClinicTaskDetail>,
    notice: string,
    refreshList = false,
  ): void {
    if (this.commandState() !== null) return;
    this.commandState.set(command);
    this.commandErrorState.set(null);
    this.commandNoticeState.set(null);
    request$.subscribe({
      next: (detail) => {
        this.detailState.set(detail);
        this.commandState.set(null);
        this.commandNoticeState.set(notice);
        if (refreshList) this.refreshList();
        if (this.lastDetailRequest !== null) this.refreshDetail();
      },
      error: (error: unknown) => this.failCommand(command, error, refreshList),
    });
  }

  private failCommand(command: ClinicTaskCommand, error: unknown, refreshList: boolean): void {
    const reason = readClinicTaskFailureReason(error);
    this.commandState.set(null);
    this.commandErrorState.set(
      command === 'ACKNOWLEDGE' && error instanceof HttpErrorResponse && error.status === 409
        ? 'This task has already been acknowledged by another team member.'
        : clinicTaskFailureMessage(reason),
    );
    if (refreshList || isTaskVersionConflict(reason)) this.refreshList();
    if (this.lastDetailRequest !== null) this.refreshDetail();
  }

  private loadCase(clinicId: string, caseId: string): void {
    this.api.getCase(clinicId, caseId).subscribe({
      next: (detail) => this.caseState.set(detail),
      error: () => this.caseState.set(null),
    });
  }
}
