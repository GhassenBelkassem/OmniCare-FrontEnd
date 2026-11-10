import { HttpErrorResponse } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { SensitiveStateRegistry } from '../../core/auth/sensitive-state.registry';
import { SessionTerminationService } from '../../core/auth/session-termination.service';
import {
  ClinicAccessError,
  ClinicAccessFamily,
  ClinicAccessReason,
  ClinicBootstrapResponse,
  ClinicMembershipSummary,
  ClinicProblemDetail,
  MeAccessResponse,
  MeClinicsResponse,
  UnavailableClinicMembership,
  toClinicAccessErrorCode,
  toClinicAccessFamily,
} from './clinic-api.models';
import { ClinicApiService } from './clinic-api.service';
import { clinicAccessMessage } from './clinic-page-utils';

/** Browser-only navigation hint. Never treated as an authorization decision. */
export const SELECTED_CLINIC_STORAGE_KEY = 'omnicare.clinic.selectedClinicId';

export interface ClinicInitializeOptions {
  /** Perform happy-path routing (select / overview). Error routing always happens. */
  readonly route?: boolean;
  readonly force?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ClinicContextStore {
  private readonly api = inject(ClinicApiService);
  private readonly router = inject(Router);
  private readonly sensitiveState = inject(SensitiveStateRegistry);
  private readonly termination = inject(SessionTerminationService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly accessFamilyState = signal<ClinicAccessFamily | null>(null);
  private readonly activeMembershipsState = signal<readonly ClinicMembershipSummary[]>([]);
  private readonly unavailableMembershipsState = signal<readonly UnavailableClinicMembership[]>([]);
  private readonly selectedClinicIdState = signal<string | null>(null);
  private readonly bootstrapState = signal<ClinicBootstrapResponse | null>(null);
  private readonly loadingState = signal(false);
  private readonly initializedState = signal(false);
  private readonly accessErrorState = signal<ClinicAccessError | null>(null);

  readonly accessFamily = this.accessFamilyState.asReadonly();
  readonly activeMemberships = this.activeMembershipsState.asReadonly();
  readonly unavailableMemberships = this.unavailableMembershipsState.asReadonly();
  readonly selectedClinicId = this.selectedClinicIdState.asReadonly();
  readonly bootstrap = this.bootstrapState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly initialized = this.initializedState.asReadonly();
  readonly accessError = this.accessErrorState.asReadonly();

  readonly selectedMembership = computed(
    () =>
      this.activeMembershipsState().find(
        (membership) => membership.clinicId === this.selectedClinicIdState(),
      ) ?? null,
  );
  readonly canSwitchClinic = computed(() => this.activeMembershipsState().length > 1);

  /** Monotonic sequence so a late response from an older clinic never wins. */
  private requestSequence = 0;
  private resolving = false;

  constructor() {
    this.sensitiveState.register(() => this.clear());
  }

  initialize(options: ClinicInitializeOptions = {}): void {
    const route = options.route ?? true;
    if (!this.isBrowser) return;
    if (this.resolving) return;
    if (this.initializedState() && options.force !== true) {
      if (route) this.resolveRoute();
      return;
    }

    this.resolving = true;
    this.loadingState.set(true);
    this.accessErrorState.set(null);
    const sequence = this.nextSequence();
    this.api.getAccess().subscribe({
      next: (response) => this.applyAccess(response, sequence, route),
      error: (error: unknown) => this.failRequest(error, sequence),
    });
  }

  selectClinic(clinicId: string): void {
    const membership = this.activeMembershipsState().find(
      (candidate) => candidate.clinicId === clinicId,
    );
    if (membership === undefined) {
      this.removeStoredClinicId();
      this.failAccess('CLINIC_MEMBERSHIP_REQUIRED');
      return;
    }

    this.bootstrapState.set(null);
    this.selectedClinicIdState.set(clinicId);
    this.writeStoredClinicId(clinicId);
    this.loadBootstrap(clinicId, true);
  }

  switchClinic(clinicId: string): void {
    this.bootstrapState.set(null);
    this.selectedClinicIdState.set(null);
    this.accessErrorState.set(null);
    this.selectClinic(clinicId);
  }

  /** Drops the current context and sends the user back to the selector. */
  beginClinicSwitch(): void {
    this.bootstrapState.set(null);
    this.selectedClinicIdState.set(null);
    this.accessErrorState.set(null);
    this.removeStoredClinicId();
    this.navigate('/clinic/select');
  }

  refreshBootstrap(): void {
    const clinicId = this.selectedClinicIdState();
    if (clinicId === null) {
      this.initialize({ route: true, force: true });
      return;
    }
    this.loadBootstrap(clinicId, false);
  }

  clear(): void {
    this.nextSequence();
    this.resolving = false;
    this.accessFamilyState.set(null);
    this.activeMembershipsState.set([]);
    this.unavailableMembershipsState.set([]);
    this.selectedClinicIdState.set(null);
    this.bootstrapState.set(null);
    this.loadingState.set(false);
    this.initializedState.set(false);
    this.accessErrorState.set(null);
    this.removeStoredClinicId();
  }

  private applyAccess(response: MeAccessResponse, sequence: number, route: boolean): void {
    if (sequence !== this.requestSequence) return;
    const family = toClinicAccessFamily(response.accessFamily);
    this.accessFamilyState.set(family);

    if (family === 'ADMIN') {
      this.finishOutsideClinic('/admin');
      return;
    }
    if (family === 'DOCTOR') {
      this.finishOutsideClinic('/doctor');
      return;
    }
    if (family === null) {
      this.finishOutsideClinic('/forbidden');
      return;
    }

    this.api.getClinics().subscribe({
      next: (clinics) => this.applyMemberships(clinics, sequence, route),
      error: (error: unknown) => this.failRequest(error, sequence),
    });
  }

  private applyMemberships(response: MeClinicsResponse, sequence: number, route: boolean): void {
    if (sequence !== this.requestSequence) return;
    this.activeMembershipsState.set(response.activeMemberships ?? []);
    this.unavailableMembershipsState.set(response.unavailableMemberships ?? []);
    const active = this.activeMembershipsState();

    if (active.length === 0) {
      this.resolving = false;
      this.selectedClinicIdState.set(null);
      this.removeStoredClinicId();
      this.failAccess('CLINIC_NO_ACTIVE_MEMBERSHIP');
      return;
    }

    const hint = this.readStoredClinicId();
    const hintIsValid = hint !== null && active.some((membership) => membership.clinicId === hint);
    if (hint !== null && !hintIsValid) this.removeStoredClinicId();

    const soleClinicId = active.length === 1 ? (active[0]?.clinicId ?? null) : null;
    const target = hintIsValid ? hint : soleClinicId;

    if (target === null) {
      this.resolving = false;
      this.selectedClinicIdState.set(null);
      this.bootstrapState.set(null);
      this.loadingState.set(false);
      this.initializedState.set(true);
      if (route) this.navigate('/clinic/select');
      return;
    }

    this.selectedClinicIdState.set(target);
    this.writeStoredClinicId(target);
    this.loadBootstrap(target, route);
  }

  private loadBootstrap(clinicId: string, route: boolean): void {
    const sequence = this.nextSequence();
    this.loadingState.set(true);
    this.accessErrorState.set(null);
    this.api.getBootstrap(clinicId).subscribe({
      next: (response) => {
        if (sequence !== this.requestSequence) return;
        this.resolving = false;
        this.bootstrapState.set(response);
        this.selectedClinicIdState.set(clinicId);
        this.writeStoredClinicId(clinicId);
        this.loadingState.set(false);
        this.initializedState.set(true);
        if (route) this.navigate(this.defaultClinicRoute());
      },
      error: (error: unknown) => this.failRequest(error, sequence),
    });
  }

  private finishOutsideClinic(url: string): void {
    this.resolving = false;
    this.activeMembershipsState.set([]);
    this.unavailableMembershipsState.set([]);
    this.selectedClinicIdState.set(null);
    this.bootstrapState.set(null);
    this.removeStoredClinicId();
    this.loadingState.set(false);
    this.initializedState.set(true);
    this.navigate(url);
  }

  private resolveRoute(): void {
    if (this.accessErrorState() !== null) {
      this.navigate('/clinic/access-unavailable');
      return;
    }
    const family = this.accessFamilyState();
    if (family === 'ADMIN') {
      this.navigate('/admin');
      return;
    }
    if (family === 'DOCTOR') {
      this.navigate('/doctor');
      return;
    }
    if (family === null) {
      this.navigate('/forbidden');
      return;
    }
    if (this.activeMembershipsState().length === 0) {
      this.failAccess('CLINIC_NO_ACTIVE_MEMBERSHIP');
      return;
    }
    this.navigate(this.bootstrapState() !== null ? this.defaultClinicRoute() : '/clinic/select');
  }

  private defaultClinicRoute(): string {
    return this.bootstrapState()?.capabilities.includes('CLINIC_CASE_INTAKE_READ') === true
      ? '/clinic/requests'
      : '/clinic/access-unavailable';
  }

  private failRequest(error: unknown, sequence: number): void {
    if (sequence !== this.requestSequence) return;
    this.resolving = false;
    this.loadingState.set(false);

    if (error instanceof HttpErrorResponse && error.status === 401) {
      void this.termination.terminate('SESSION_INVALID');
      return;
    }

    this.failAccess(readClinicAccessReason(error));
  }

  private failAccess(reason: ClinicAccessReason): void {
    this.resolving = false;
    this.bootstrapState.set(null);
    this.loadingState.set(false);
    this.initializedState.set(true);
    this.accessErrorState.set({ reason, message: clinicAccessMessage(reason) });
    this.navigate('/clinic/access-unavailable');
  }

  private navigate(url: string): void {
    const current = this.router.url.split('?')[0]?.split('#')[0] ?? '';
    if (current === url) return;
    void this.router.navigateByUrl(url);
  }

  private nextSequence(): number {
    this.requestSequence += 1;
    return this.requestSequence;
  }

  private readStoredClinicId(): string | null {
    if (!this.isBrowser) return null;
    try {
      const value = globalThis.sessionStorage.getItem(SELECTED_CLINIC_STORAGE_KEY);
      return value !== null && value.trim().length > 0 ? value : null;
    } catch {
      return null;
    }
  }

  private writeStoredClinicId(clinicId: string): void {
    if (!this.isBrowser) return;
    try {
      globalThis.sessionStorage.setItem(SELECTED_CLINIC_STORAGE_KEY, clinicId);
    } catch {
      // A blocked session storage must never break clinic initialization.
    }
  }

  private removeStoredClinicId(): void {
    if (!this.isBrowser) return;
    try {
      globalThis.sessionStorage.removeItem(SELECTED_CLINIC_STORAGE_KEY);
    } catch {
      // Ignored on purpose: the hint is optional.
    }
  }
}

function readClinicAccessReason(error: unknown): ClinicAccessReason {
  if (!(error instanceof HttpErrorResponse)) return 'CLINIC_REQUEST_FAILED';
  const body = error.error as ClinicProblemDetail | null;
  const code = toClinicAccessErrorCode(body?.errorCode);
  if (code !== null) return code;
  if (error.status === 403) return 'CLINIC_SCOPE_FORBIDDEN';
  if (error.status === 400 || error.status === 404) return 'CLINIC_CONTEXT_UNAVAILABLE';
  return 'CLINIC_REQUEST_FAILED';
}
