import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';

import { ClinicBootstrapResponse } from './clinic-api.models';
import { clinicRequestsGuard, clinicStaffGuard, clinicTasksGuard } from './clinic-capability.guard';
import { ClinicContextStore } from './clinic-context.store';

describe('clinicRequestsGuard', () => {
  it('allows an initialized membership with the backend read capability', () => {
    configure(bootstrap(['CLINIC_CASE_INTAKE_READ']));

    expect(runGuard()).toBe(true);
  });

  it('keeps Requests inaccessible when bootstrap does not grant the capability', () => {
    configure(bootstrap([]));

    const result = runGuard();
    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/clinic/access-unavailable');
  });

  it('routes through bootstrap before evaluating a direct Clinic feature URL', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ClinicContextStore, useValue: { initialized: () => false, bootstrap: () => null } },
      ],
    });

    const result = runGuard();
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/clinic');
  });

  it('denies direct Staff access without the staff capability', () => {
    configure(bootstrap(['CLINIC_CASE_INTAKE_READ']));

    const result = TestBed.runInInjectionContext(() =>
      clinicStaffGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/clinic/access-unavailable');
  });

  it('allows direct Staff access with the staff read capability', () => {
    configure(bootstrap(['CLINIC_STAFF_READ']));

    expect(TestBed.runInInjectionContext(() =>
      clinicStaffGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    )).toBe(true);
  });

  it('allows task routes only when bootstrap grants CLINIC_TASK_READ', () => {
    configure(bootstrap(['CLINIC_TASK_READ']));
    expect(TestBed.runInInjectionContext(() =>
      clinicTasksGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    )).toBe(true);
  });

  it('denies task routes when another read capability is present without CLINIC_TASK_READ', () => {
    configure(bootstrap(['CLINIC_CASE_INTAKE_READ']));
    const result = TestBed.runInInjectionContext(() =>
      clinicTasksGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/clinic/access-unavailable');
  });
});

function configure(value: ClinicBootstrapResponse): void {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: ClinicContextStore, useValue: { initialized: () => true, bootstrap: () => value } },
    ],
  });
}

function runGuard() {
  return TestBed.runInInjectionContext(() =>
    clinicRequestsGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
  );
}

function bootstrap(capabilities: ClinicBootstrapResponse['capabilities']): ClinicBootstrapResponse {
  return {
    contractVersion: '1.0',
    clinic: { clinicId: 'clinic-a', clinicName: 'Clinique A', clinicStatus: 'ACTIVE' },
    membership: {
      membershipId: 'membership-a',
      membershipStatus: 'ACTIVE',
      professionalRole: 'CLINIC_ASSISTANT',
      version: 1,
    },
    capabilities,
    featureFlags: { CLINIC_REQUESTS_ENABLED: true },
    resolvedAt: '2026-08-11T10:00:00Z',
  };
}
