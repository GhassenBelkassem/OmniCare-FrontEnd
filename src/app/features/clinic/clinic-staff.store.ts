import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged, map } from 'rxjs';

import {
  ClinicAttachableRole,
  ClinicMembershipStatus,
  ClinicProfessionalRole,
  ClinicStaffFailureReason,
  ClinicStaffMember,
  ClinicStaffPage,
  ClinicStaffQuery,
  ClinicSuspensionReason,
  CLINIC_STAFF_DEFAULT_PAGE_SIZE,
  CLINIC_STAFF_SEARCH_MAX_LENGTH,
} from './clinic-api.models';
import { ClinicApiService } from './clinic-api.service';
import { ClinicContextStore } from './clinic-context.store';
import {
  clinicStaffFailureMessage,
  isClinicStaffVersionConflict,
  readClinicStaffFailureReason,
} from './clinic-staff-utils';

export const CLINIC_STAFF_SEARCH_DEBOUNCE_MS = 300;

export type ClinicStaffMutation = 'attach' | 'suspend' | 'reactivate' | 'end';

export interface ClinicStaffNotice {
  readonly tone: 'success' | 'error';
  readonly message: string;
}

export interface ClinicStaffFilters {
  readonly status: ClinicMembershipStatus | null;
  readonly professionalRole: ClinicProfessionalRole | null;
  readonly search: string;
}

const EMPTY_FILTERS: ClinicStaffFilters = { status: null, professionalRole: null, search: '' };

/**
 * Read/command state for the clinic staff directory.
 *
 * <p>Clinic identity is never duplicated here: the selected clinic stays owned by
 * {@link ClinicContextStore}, and capabilities are always read from the authoritative
 * bootstrap payload rather than inferred from a role string.
 */
@Injectable()
export class ClinicStaffStore {
  private readonly api = inject(ClinicApiService);
  private readonly context = inject(ClinicContextStore);
  private readonly destroyRef = inject(DestroyRef);

  private readonly itemsState = signal<readonly ClinicStaffMember[]>([]);
  private readonly pageState = signal(0);
  private readonly pageSizeState = signal(CLINIC_STAFF_DEFAULT_PAGE_SIZE);
  private readonly hasNextState = signal(false);
  private readonly filtersState = signal<ClinicStaffFilters>(EMPTY_FILTERS);
  private readonly loadingState = signal(false);
  private readonly loadFailedState = signal(false);
  private readonly pendingMutationState = signal<ClinicStaffMutation | null>(null);
  private readonly pendingMembershipIdState = signal<string | null>(null);
  private readonly noticeState = signal<ClinicStaffNotice | null>(null);

  readonly items = this.itemsState.asReadonly();
  readonly page = this.pageState.asReadonly();
  readonly pageSize = this.pageSizeState.asReadonly();
  readonly hasNext = this.hasNextState.asReadonly();
  readonly filters = this.filtersState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly loadFailed = this.loadFailedState.asReadonly();
  readonly pendingMutation = this.pendingMutationState.asReadonly();
  readonly pendingMembershipId = this.pendingMembershipIdState.asReadonly();
  readonly notice = this.noticeState.asReadonly();

  readonly hasPrevious = computed(() => this.pageState() > 0);
  readonly isMutating = computed(() => this.pendingMutationState() !== null);
  readonly isEmpty = computed(
    () => !this.loadingState() && !this.loadFailedState() && this.itemsState().length === 0,
  );

  private readonly capabilities = computed<ReadonlySet<string>>(
    () => new Set(this.context.bootstrap()?.capabilities ?? []),
  );
  readonly canRead = computed(() => this.capabilities().has('CLINIC_STAFF_READ'));
  readonly canInvite = computed(() => this.capabilities().has('CLINIC_STAFF_INVITE'));
  readonly canSuspend = computed(() => this.capabilities().has('CLINIC_STAFF_SUSPEND'));
  readonly canReactivate = computed(() => this.capabilities().has('CLINIC_STAFF_REACTIVATE'));
  readonly canEnd = computed(() => this.capabilities().has('CLINIC_STAFF_END'));

  /** Monotonic sequence so a stale list response can never overwrite a newer query. */
  private listSequence = 0;
  private readonly searchInput = new Subject<string>();

  constructor() {
    this.searchInput
      .pipe(
        map((value) => value.trim().slice(0, CLINIC_STAFF_SEARCH_MAX_LENGTH)),
        debounceTime(CLINIC_STAFF_SEARCH_DEBOUNCE_MS),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((search) => {
        this.filtersState.update((filters) => ({ ...filters, search }));
        this.reload(0);
      });
  }

  /** First load for the resolved clinic. Requires the authoritative read capability. */
  load(): void {
    this.reload(0);
  }

  refresh(): void {
    this.reload(this.pageState());
  }

  setStatus(status: ClinicMembershipStatus | null): void {
    if (this.filtersState().status === status) return;
    this.filtersState.update((filters) => ({ ...filters, status }));
    this.reload(0);
  }

  setProfessionalRole(professionalRole: ClinicProfessionalRole | null): void {
    if (this.filtersState().professionalRole === professionalRole) return;
    this.filtersState.update((filters) => ({ ...filters, professionalRole }));
    this.reload(0);
  }

  /** Debounced: a request is never issued on every raw keystroke. */
  searchChanged(value: string): void {
    this.searchInput.next(value);
  }

  clearFilters(): void {
    this.filtersState.set(EMPTY_FILTERS);
    this.reload(0);
  }

  nextPage(): void {
    if (!this.hasNextState() || this.loadingState()) return;
    this.reload(this.pageState() + 1);
  }

  previousPage(): void {
    if (!this.hasPrevious() || this.loadingState()) return;
    this.reload(this.pageState() - 1);
  }

  dismissNotice(): void {
    this.noticeState.set(null);
  }

  attachProfessional(
    email: string,
    professionalRole: ClinicAttachableRole,
    onSuccess?: () => void,
  ): void {
    const clinicId = this.context.selectedClinicId();
    if (clinicId === null || this.isMutating()) return;

    this.beginMutation('attach', null);
    this.api.attachProfessional(clinicId, { email, professionalRole }).subscribe({
      next: () => {
        this.endMutation();
        this.noticeState.set({
          tone: 'success',
          message: 'The professional was attached to this clinic.',
        });
        onSuccess?.();
        this.reload(0);
      },
      error: (error: unknown) => this.failMutation(error),
    });
  }

  suspend(
    member: ClinicStaffMember,
    reasonCode: ClinicSuspensionReason,
    note: string | null,
    onSuccess?: () => void,
  ): void {
    const clinicId = this.context.selectedClinicId();
    if (clinicId === null || this.isMutating()) return;

    const request =
      note !== null && note.length > 0
        ? { expectedVersion: member.version, reasonCode, note }
        : { expectedVersion: member.version, reasonCode };

    this.beginMutation('suspend', member.membershipId);
    this.api.suspendStaffMember(clinicId, member.membershipId, request).subscribe({
      next: () => {
        this.completeLifecycle('The staff membership was suspended.');
        onSuccess?.();
      },
      error: (error: unknown) => this.failMutation(error),
    });
  }

  reactivate(member: ClinicStaffMember): void {
    const clinicId = this.context.selectedClinicId();
    if (clinicId === null || this.isMutating()) return;

    this.beginMutation('reactivate', member.membershipId);
    this.api
      .reactivateStaffMember(clinicId, member.membershipId, { expectedVersion: member.version })
      .subscribe({
        next: () => this.completeLifecycle('The staff membership was reactivated.'),
        error: (error: unknown) => this.failMutation(error),
      });
  }

  end(member: ClinicStaffMember, onSuccess?: () => void): void {
    const clinicId = this.context.selectedClinicId();
    if (clinicId === null || this.isMutating()) return;

    this.beginMutation('end', member.membershipId);
    this.api
      .endStaffMember(clinicId, member.membershipId, { expectedVersion: member.version })
      .subscribe({
        next: () => {
          this.completeLifecycle('The staff membership was ended.');
          onSuccess?.();
        },
        error: (error: unknown) => this.failMutation(error),
      });
  }

  private reload(page: number): void {
    const clinicId = this.context.selectedClinicId();
    if (clinicId === null || !this.canRead()) return;

    const filters = this.filtersState();
    const query: ClinicStaffQuery = {
      page,
      pageSize: this.pageSizeState(),
      ...(filters.status !== null ? { status: filters.status } : {}),
      ...(filters.professionalRole !== null ? { professionalRole: filters.professionalRole } : {}),
      ...(filters.search.length > 0 ? { search: filters.search } : {}),
    };

    const sequence = ++this.listSequence;
    this.loadingState.set(true);
    this.loadFailedState.set(false);
    this.api.listStaff(clinicId, query).subscribe({
      next: (response) => this.applyPage(response, sequence),
      error: (error: unknown) => this.failList(error, sequence),
    });
  }

  private applyPage(response: ClinicStaffPage, sequence: number): void {
    if (sequence !== this.listSequence) return;
    this.itemsState.set(response.items ?? []);
    this.pageState.set(response.page);
    this.pageSizeState.set(response.pageSize);
    this.hasNextState.set(response.hasNext === true);
    this.loadingState.set(false);
  }

  private failList(error: unknown, sequence: number): void {
    if (sequence !== this.listSequence) return;
    this.loadingState.set(false);
    this.loadFailedState.set(true);
    this.itemsState.set([]);
    this.hasNextState.set(false);
    this.showFailure(readClinicStaffFailureReason(error));
  }

  private beginMutation(mutation: ClinicStaffMutation, membershipId: string | null): void {
    this.pendingMutationState.set(mutation);
    this.pendingMembershipIdState.set(membershipId);
    this.noticeState.set(null);
  }

  private endMutation(): void {
    this.pendingMutationState.set(null);
    this.pendingMembershipIdState.set(null);
  }

  private completeLifecycle(message: string): void {
    this.endMutation();
    this.noticeState.set({ tone: 'success', message });
    // Always re-read authoritative rows: the response version is not trusted as list state.
    this.reload(this.pageState());
  }

  /** Never auto-retries a mutation; a conflict only reloads authoritative data. */
  private failMutation(error: unknown): void {
    this.endMutation();
    const reason = readClinicStaffFailureReason(error);
    this.showFailure(reason);
    if (isClinicStaffVersionConflict(reason)) this.reload(this.pageState());
  }

  private showFailure(reason: ClinicStaffFailureReason): void {
    this.noticeState.set({ tone: 'error', message: clinicStaffFailureMessage(reason) });
  }
}
