import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { AuthTokenStore } from '../../core/auth/auth-token.store';
import { authInterceptor } from '../../core/auth/auth.interceptor';
import { RUNTIME_CONFIG } from '../../core/config/runtime-config';
import {
  ClinicBootstrapResponse,
  ClinicMembershipSummary,
  ClinicProblemDetail,
  UnavailableClinicMembership,
} from './clinic-api.models';
import { ClinicContextStore, SELECTED_CLINIC_STORAGE_KEY } from './clinic-context.store';

const RESOLVED_AT = '2026-08-07T09:00:00Z';

function membership(
  clinicId: string,
  clinicName: string,
  professionalRole = 'CLINIC_ASSISTANT',
): ClinicMembershipSummary {
  return {
    clinicId,
    clinicName,
    membershipId: `membership-${clinicId}`,
    professionalRole,
    membershipStatus: 'ACTIVE',
    clinicStatus: 'ACTIVE',
    version: 1,
  };
}

function bootstrapBody(clinicId: string, clinicName: string): ClinicBootstrapResponse {
  return {
    contractVersion: '1.0',
    clinic: { clinicId, clinicName, clinicStatus: 'ACTIVE' },
    membership: {
      membershipId: `membership-${clinicId}`,
      membershipStatus: 'ACTIVE',
      professionalRole: 'CLINIC_ASSISTANT',
      version: 1,
    },
    capabilities: ['CLINIC_OVERVIEW_READ', 'CLINIC_PROFILE_READ', 'CLINIC_MEMBERSHIP_SELF_READ'],
    featureFlags: {
      CLINIC_REQUESTS_ENABLED: false,
      CLINIC_HOSPITALIZATION_ENABLED: false,
      CLINIC_SURGERY_ENABLED: false,
      CLINIC_URGENT_ENABLED: false,
      CLINIC_MOBILE_TASKS_ENABLED: false,
      CLINIC_PARTNERSHIP_ENABLED: false,
    },
    resolvedAt: RESOLVED_AT,
  };
}

describe('ClinicContextStore', () => {
  let store: ClinicContextStore;
  let http: HttpTestingController;
  let tokens: AuthTokenStore;
  let navigations: string[];

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: '/api/v1' } },
      ],
    });
    tokens = TestBed.inject(AuthTokenStore);
    tokens.setSession({
      accessToken: 'clinic-access-token',
      tokenType: 'Bearer',
      expiresAt: '2026-08-07T12:00:00Z',
      refreshToken: 'clinic-refresh-token',
      refreshExpiresAt: '2026-08-08T00:00:00Z',
      user: { id: 'clinic-user-1', role: 'CLINIC_ADMIN', mustChangePassword: false },
    });
    navigations = [];
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockImplementation((url) => {
      navigations.push(typeof url === 'string' ? url : url.toString());
      return Promise.resolve(true);
    });
    store = TestBed.inject(ClinicContextStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  function flushAccess(accessFamily: string): void {
    http
      .expectOne('/api/v1/me/access')
      .flush({ contractVersion: '1.0', accessFamily, resolvedAt: RESOLVED_AT });
  }

  function flushClinics(
    activeMemberships: readonly ClinicMembershipSummary[],
    unavailableMemberships: readonly UnavailableClinicMembership[] = [],
  ): void {
    http.expectOne('/api/v1/me/clinics').flush({
      contractVersion: '1.0',
      activeMemberships,
      unavailableMemberships,
      resolvedAt: RESOLVED_AT,
    });
  }

  function initializeWith(
    activeMemberships: readonly ClinicMembershipSummary[],
    unavailableMemberships: readonly UnavailableClinicMembership[] = [],
  ): void {
    store.initialize();
    flushAccess('CLINIC');
    flushClinics(activeMemberships, unavailableMemberships);
  }

  it('sends an ADMIN access family to the platform administration workspace', () => {
    store.initialize();
    flushAccess('ADMIN');

    expect(store.accessFamily()).toBe('ADMIN');
    expect(navigations).toEqual(['/admin']);
    http.expectNone('/api/v1/me/clinics');
  });

  it('sends a DOCTOR access family to the doctor workspace', () => {
    store.initialize();
    flushAccess('DOCTOR');

    expect(store.accessFamily()).toBe('DOCTOR');
    expect(navigations).toEqual(['/doctor']);
    http.expectNone('/api/v1/me/clinics');
  });

  it('continues clinic initialization for the CLINIC access family', () => {
    store.initialize();
    flushAccess('CLINIC');

    expect(store.accessFamily()).toBe('CLINIC');
    flushClinics([membership('clinic-a', 'Clinique A')]);
    http.expectOne('/api/v1/clinics/clinic-a/bootstrap').flush(bootstrapBody('clinic-a', 'Clinique A'));
  });

  it('fails safely for an unsupported dashboard access family', () => {
    store.initialize();
    flushAccess('PATIENT');

    expect(store.accessFamily()).toBeNull();
    expect(store.bootstrap()).toBeNull();
    expect(navigations).toEqual(['/forbidden']);
    http.expectNone('/api/v1/me/clinics');
  });

  it('routes to access-unavailable when there is no active membership', () => {
    initializeWith([], [
      {
        ...membership('clinic-z', 'Clinique Z', 'CLINIC_KINE'),
        membershipStatus: 'SUSPENDED',
        unavailabilityCode: 'CLINIC_MEMBERSHIP_SUSPENDED',
      },
    ]);

    expect(store.accessError()?.reason).toBe('CLINIC_NO_ACTIVE_MEMBERSHIP');
    expect(store.unavailableMemberships().length).toBe(1);
    expect(navigations).toEqual(['/clinic/access-unavailable']);
  });

  it('selects the only active membership automatically and routes to the overview', () => {
    initializeWith([membership('clinic-a', 'Clinique A')]);
    http.expectOne('/api/v1/clinics/clinic-a/bootstrap').flush(bootstrapBody('clinic-a', 'Clinique A'));

    expect(store.selectedClinicId()).toBe('clinic-a');
    expect(store.bootstrap()?.clinic.clinicId).toBe('clinic-a');
    expect(sessionStorage.getItem(SELECTED_CLINIC_STORAGE_KEY)).toBe('clinic-a');
    expect(navigations).toEqual(['/clinic/overview']);
  });

  it('routes to the selector when several memberships exist without a valid hint', () => {
    initializeWith([membership('clinic-a', 'Clinique A'), membership('clinic-b', 'Clinique B')]);

    expect(store.selectedClinicId()).toBeNull();
    expect(navigations).toEqual(['/clinic/select']);
    http.expectNone('/api/v1/clinics/clinic-a/bootstrap');
    http.expectNone('/api/v1/clinics/clinic-b/bootstrap');
  });

  it('restores a session hint only when it matches an active membership', () => {
    sessionStorage.setItem(SELECTED_CLINIC_STORAGE_KEY, 'clinic-b');
    initializeWith([membership('clinic-a', 'Clinique A'), membership('clinic-b', 'Clinique B')]);
    http.expectOne('/api/v1/clinics/clinic-b/bootstrap').flush(bootstrapBody('clinic-b', 'Clinique B'));

    expect(store.selectedClinicId()).toBe('clinic-b');
    expect(navigations).toEqual(['/clinic/overview']);
  });

  it('removes a stale session hint that is not an active membership', () => {
    sessionStorage.setItem(SELECTED_CLINIC_STORAGE_KEY, 'clinic-removed');
    initializeWith([membership('clinic-a', 'Clinique A'), membership('clinic-b', 'Clinique B')]);

    expect(sessionStorage.getItem(SELECTED_CLINIC_STORAGE_KEY)).toBeNull();
    expect(navigations).toEqual(['/clinic/select']);
  });

  it('loads bootstrap for the clinic chosen in the selector', () => {
    initializeWith([membership('clinic-a', 'Clinique A'), membership('clinic-b', 'Clinique B')]);
    navigations.length = 0;

    store.selectClinic('clinic-b');
    http.expectOne('/api/v1/clinics/clinic-b/bootstrap').flush(bootstrapBody('clinic-b', 'Clinique B'));

    expect(store.bootstrap()?.clinic.clinicId).toBe('clinic-b');
    expect(navigations).toEqual(['/clinic/overview']);
  });

  it('never lets a stale bootstrap response from a previous clinic win', () => {
    initializeWith([membership('clinic-a', 'Clinique A'), membership('clinic-b', 'Clinique B')]);

    store.selectClinic('clinic-a');
    const first = http.expectOne('/api/v1/clinics/clinic-a/bootstrap');
    store.switchClinic('clinic-b');
    const second = http.expectOne('/api/v1/clinics/clinic-b/bootstrap');

    second.flush(bootstrapBody('clinic-b', 'Clinique B'));
    first.flush(bootstrapBody('clinic-a', 'Clinique A'));

    expect(store.bootstrap()?.clinic.clinicId).toBe('clinic-b');
    expect(store.selectedClinicId()).toBe('clinic-b');
    expect(sessionStorage.getItem(SELECTED_CLINIC_STORAGE_KEY)).toBe('clinic-b');
  });

  it('routes a clinic ProblemDetail to access-unavailable with a safe message', () => {
    initializeWith([membership('clinic-a', 'Clinique A')]);
    const problem: ClinicProblemDetail = {
      type: 'https://omnicare.tn/problems/clinic-membership-suspended',
      title: 'Clinic membership suspended',
      status: 403,
      detail: 'Membership 8f21 is suspended for clinic 41ab.',
      instance: '/api/v1/clinics/clinic-a/bootstrap',
      errorCode: 'CLINIC_MEMBERSHIP_SUSPENDED',
      requestId: 'req-8127',
      timestamp: RESOLVED_AT,
    };
    http
      .expectOne('/api/v1/clinics/clinic-a/bootstrap')
      .flush(problem, { status: 403, statusText: 'Forbidden' });

    expect(store.bootstrap()).toBeNull();
    expect(store.accessError()?.reason).toBe('CLINIC_MEMBERSHIP_SUSPENDED');
    expect(store.accessError()?.message).toBe(
      'Your membership for this clinic is currently suspended.',
    );
    expect(store.accessError()?.message).not.toContain('req-8127');
    expect(navigations).toContain('/clinic/access-unavailable');
  });

  it('treats a malformed clinic id validation error as a safe clinic access failure', () => {
    initializeWith([membership('clinic-a', 'Clinique A')]);
    http
      .expectOne('/api/v1/clinics/clinic-a/bootstrap')
      .flush({ status: 400, errorCode: 'VALIDATION_FAILED' }, { status: 400, statusText: 'Bad Request' });

    expect(store.accessError()?.reason).toBe('CLINIC_CONTEXT_UNAVAILABLE');
    expect(navigations).toContain('/clinic/access-unavailable');
  });

  it('clears authentication and clinic state on the legacy 401 response', () => {
    sessionStorage.setItem(SELECTED_CLINIC_STORAGE_KEY, 'clinic-a');
    store.initialize();
    http
      .expectOne('/api/v1/me/access')
      .flush({ code: 'UNAUTHENTICATED', message: 'Session expired.' }, { status: 401, statusText: 'Unauthorized' });

    expect(tokens.authenticated()).toBe(false);
    expect(store.initialized()).toBe(false);
    expect(store.accessError()).toBeNull();
    expect(sessionStorage.getItem(SELECTED_CLINIC_STORAGE_KEY)).toBeNull();
    expect(navigations).toEqual(['/login']);
  });

  it('rebuilds memberships and bootstrap on a direct overview initialization', () => {
    sessionStorage.setItem(SELECTED_CLINIC_STORAGE_KEY, 'clinic-b');

    // Simulates a browser refresh straight onto /clinic/overview with no in-memory state.
    store.initialize({ route: true });
    flushAccess('CLINIC');
    flushClinics([membership('clinic-a', 'Clinique A'), membership('clinic-b', 'Clinique B')]);
    http.expectOne('/api/v1/clinics/clinic-b/bootstrap').flush(bootstrapBody('clinic-b', 'Clinique B'));

    expect(store.activeMemberships().length).toBe(2);
    expect(store.bootstrap()?.clinic.clinicId).toBe('clinic-b');
    expect(store.initialized()).toBe(true);
  });

  it('does not start a duplicate initialization while one is in flight', () => {
    store.initialize();
    store.initialize();
    flushAccess('CLINIC');
    flushClinics([membership('clinic-a', 'Clinique A')]);
    http.expectOne('/api/v1/clinics/clinic-a/bootstrap').flush(bootstrapBody('clinic-a', 'Clinique A'));

    expect(store.bootstrap()?.clinic.clinicId).toBe('clinic-a');
  });

  it('clears every piece of clinic state and the session hint', () => {
    initializeWith([membership('clinic-a', 'Clinique A')]);
    http.expectOne('/api/v1/clinics/clinic-a/bootstrap').flush(bootstrapBody('clinic-a', 'Clinique A'));

    store.clear();

    expect(store.accessFamily()).toBeNull();
    expect(store.activeMemberships()).toEqual([]);
    expect(store.unavailableMemberships()).toEqual([]);
    expect(store.selectedClinicId()).toBeNull();
    expect(store.bootstrap()).toBeNull();
    expect(store.initialized()).toBe(false);
    expect(store.accessError()).toBeNull();
    expect(sessionStorage.getItem(SELECTED_CLINIC_STORAGE_KEY)).toBeNull();
  });
});
