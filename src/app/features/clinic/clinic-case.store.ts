import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Subject, catchError, switchMap, tap } from 'rxjs';

import {
  ClinicCaseDetail,
  ClinicCaseFailureReason,
  ClinicCaseListItem,
  ClinicCaseQuery,
  ClinicCaseStatus,
} from './clinic-api.models';
import { ClinicApiService } from './clinic-api.service';
import { clinicCaseFailureMessage, readClinicCaseFailureReason } from './clinic-case-utils';

export interface ClinicCaseListRequest {
  readonly clinicId: string;
  readonly statuses: readonly ClinicCaseStatus[];
  readonly page: number;
  readonly pageSize: number;
  readonly refresh?: boolean;
}

export interface ClinicCaseDetailRequest {
  readonly clinicId: string;
  readonly caseId: string;
}

@Injectable()
export class ClinicCaseStore {
  private readonly api = inject(ClinicApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly listRequests = new Subject<ClinicCaseListRequest>();
  private readonly detailRequests = new Subject<ClinicCaseDetailRequest>();

  private readonly itemsState = signal<readonly ClinicCaseListItem[]>([]);
  private readonly detailState = signal<ClinicCaseDetail | null>(null);
  private readonly pageState = signal(0);
  private readonly pageSizeState = signal(20);
  private readonly hasNextState = signal(false);
  private readonly statusesState = signal<readonly ClinicCaseStatus[]>([]);
  private readonly loadingState = signal(false);
  private readonly refreshingState = signal(false);
  private readonly errorState = signal<ClinicCaseFailureReason | null>(null);
  private readonly detailLoadingState = signal(false);
  private readonly detailErrorState = signal<ClinicCaseFailureReason | null>(null);
  private readonly lastGeneratedAtState = signal<string | null>(null);
  private lastListRequest: ClinicCaseListRequest | null = null;
  private lastDetailRequest: ClinicCaseDetailRequest | null = null;

  readonly items = this.itemsState.asReadonly();
  readonly detail = this.detailState.asReadonly();
  readonly page = this.pageState.asReadonly();
  readonly pageSize = this.pageSizeState.asReadonly();
  readonly hasNext = this.hasNextState.asReadonly();
  readonly statuses = this.statusesState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly refreshing = this.refreshingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly detailLoading = this.detailLoadingState.asReadonly();
  readonly detailError = this.detailErrorState.asReadonly();
  readonly lastGeneratedAt = this.lastGeneratedAtState.asReadonly();

  readonly hasPrevious = computed(() => this.pageState() > 0);
  readonly isEmpty = computed(
    () => !this.loadingState() && this.errorState() === null && this.itemsState().length === 0,
  );
  readonly errorMessage = computed(() => {
    const reason = this.errorState();
    return reason === null ? null : clinicCaseFailureMessage(reason);
  });
  readonly detailErrorMessage = computed(() => {
    const reason = this.detailErrorState();
    return reason === null ? null : clinicCaseFailureMessage(reason);
  });
  readonly detailNotFound = computed(() => this.detailErrorState() === 'CLINIC_CASE_NOT_FOUND');

  constructor() {
    this.listRequests
      .pipe(
        tap((request) => this.beginList(request)),
        switchMap((request) => this.api.listCases(request.clinicId, toQuery(request)).pipe(
          tap((response) => {
            this.itemsState.set(response.items ?? []);
            this.pageState.set(response.page);
            this.pageSizeState.set(response.pageSize);
            this.hasNextState.set(response.hasNext === true);
            this.lastGeneratedAtState.set(response.generatedAt);
            this.loadingState.set(false);
            this.refreshingState.set(false);
            this.errorState.set(null);
          }),
          catchError((error: unknown) => {
            this.itemsState.set([]);
            this.hasNextState.set(false);
            this.loadingState.set(false);
            this.refreshingState.set(false);
            this.errorState.set(readClinicCaseFailureReason(error));
            return EMPTY;
          }),
        )),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    this.detailRequests
      .pipe(
        tap((request) => {
          this.lastDetailRequest = request;
          this.detailState.set(null);
          this.detailErrorState.set(null);
          this.detailLoadingState.set(true);
        }),
        switchMap((request) => this.api.getCase(request.clinicId, request.caseId).pipe(
          tap((detail) => {
            this.detailState.set(detail);
            this.detailLoadingState.set(false);
            this.detailErrorState.set(null);
          }),
          catchError((error: unknown) => {
            this.detailState.set(null);
            this.detailLoadingState.set(false);
            this.detailErrorState.set(readClinicCaseFailureReason(error));
            return EMPTY;
          }),
        )),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  loadList(request: ClinicCaseListRequest): void {
    this.listRequests.next({ ...request, statuses: Array.from(new Set(request.statuses)) });
  }

  refreshList(): void {
    if (this.lastListRequest !== null) {
      this.listRequests.next({ ...this.lastListRequest, refresh: true });
    }
  }

  loadDetail(request: ClinicCaseDetailRequest): void {
    this.detailRequests.next(request);
  }

  refreshDetail(): void {
    if (this.lastDetailRequest !== null) this.detailRequests.next(this.lastDetailRequest);
  }

  private beginList(request: ClinicCaseListRequest): void {
    this.lastListRequest = { ...request, refresh: false };
    this.pageState.set(request.page);
    this.pageSizeState.set(request.pageSize);
    this.statusesState.set(request.statuses);
    this.errorState.set(null);
    if (request.refresh === true || this.itemsState().length > 0) {
      this.refreshingState.set(true);
      this.loadingState.set(false);
    } else {
      this.itemsState.set([]);
      this.loadingState.set(true);
      this.refreshingState.set(false);
    }
  }
}

function toQuery(request: ClinicCaseListRequest): ClinicCaseQuery {
  return {
    page: request.page,
    pageSize: request.pageSize,
    ...(request.statuses.length > 0 ? { statuses: request.statuses } : {}),
  };
}
