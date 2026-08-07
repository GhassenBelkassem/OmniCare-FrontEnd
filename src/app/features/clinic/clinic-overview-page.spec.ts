import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideNzIcons } from 'ng-zorro-antd/icon';

import { OMNICARE_ICONS } from '../../app.icons';
import { AuthTokenStore } from '../../core/auth/auth-token.store';
import { RUNTIME_CONFIG } from '../../core/config/runtime-config';
import { ClinicContextStore, SELECTED_CLINIC_STORAGE_KEY } from './clinic-context.store';
import { ClinicOverviewPage } from './clinic-overview-page';

const RESOLVED_AT = '2026-08-07T09:00:00Z';

describe('ClinicOverviewPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideNzIcons(OMNICARE_ICONS),
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: '/api/v1' } },
      ],
    });
    TestBed.inject(AuthTokenStore).setSession({
      accessToken: 'clinic-access-token',
      tokenType: 'Bearer',
      expiresAt: '2026-08-07T12:00:00Z',
      refreshToken: 'clinic-refresh-token',
      refreshExpiresAt: '2026-08-08T00:00:00Z',
      user: { id: 'clinic-user-1', role: 'CLINIC_ADMIN', mustChangePassword: false },
    });
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    http = TestBed.inject(HttpTestingController);

    const store = TestBed.inject(ClinicContextStore);
    store.initialize({ route: false });
    http
      .expectOne('/api/v1/me/access')
      .flush({ contractVersion: '1.0', accessFamily: 'CLINIC', resolvedAt: RESOLVED_AT });
    http.expectOne('/api/v1/me/clinics').flush({
      contractVersion: '1.0',
      activeMemberships: [
        {
          clinicId: 'clinic-a',
          clinicName: 'Clinique Jasmin',
          membershipId: 'membership-a',
          professionalRole: 'CLINIC_ASSISTANT',
          membershipStatus: 'ACTIVE',
          clinicStatus: 'ACTIVE',
          version: 1,
        },
      ],
      unavailableMemberships: [],
      resolvedAt: RESOLVED_AT,
    });
    http.expectOne('/api/v1/clinics/clinic-a/bootstrap').flush({
      contractVersion: '1.0',
      clinic: { clinicId: 'clinic-a', clinicName: 'Clinique Jasmin', clinicStatus: 'ACTIVE' },
      membership: {
        membershipId: 'membership-a',
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
    });
  });

  afterEach(() => {
    http.verify();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders the resolved clinic context without inventing clinical data', () => {
    const fixture = TestBed.createComponent(ClinicOverviewPage);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('Clinique Jasmin');
    expect(text).toContain('Clinic assistant');
    expect(text).toContain('v1');
    expect(text).toContain('Read the clinic overview');
    expect(text).toContain('Read the clinic profile');
    expect(text).toContain('Read your own clinic membership');
    expect(text).not.toContain('membership-a');
  });

  it('keeps every module unavailable and offers no enabled module action', () => {
    const fixture = TestBed.createComponent(ClinicOverviewPage);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    expect(fixture.componentInstance.enabledModuleCount()).toBe(0);
    expect(fixture.componentInstance.enabledModuleSummary()).toBe('0 of 6');
    expect(host.querySelectorAll('.module-list li').length).toBe(6);
    expect(host.querySelectorAll('.module-list button, .module-list a').length).toBe(0);
    expect(host.querySelectorAll('.module-flag').length).toBe(6);
    expect(host.textContent).toContain('Not available yet');
    expect(host.textContent).not.toContain('Available yet ');
  });

  it('restores the session hint for the resolved clinic', () => {
    expect(sessionStorage.getItem(SELECTED_CLINIC_STORAGE_KEY)).toBe('clinic-a');
  });
});
