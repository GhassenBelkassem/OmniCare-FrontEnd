import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';

import { authInterceptor } from '../../core/auth/auth.interceptor';
import { AuthTokenStore } from '../../core/auth/auth-token.store';
import { RUNTIME_CONFIG } from '../../core/config/runtime-config';
import { UrgentRequestTrackingPage } from './urgent-request-tracking-page';

class FakeParamMap {
  constructor(private readonly values: Readonly<Record<string, string>> = {}) {}
  get(key: string): string | null {
    return this.values[key] ?? null;
  }
}

const MATCHED_REQUEST = {
  id: 'urgent-1',
  patientId: 'p-1',
  patientLatitude: 36.8065,
  patientLongitude: 10.1815,
  visitPreference: 'HOME_VISIT',
  notes: 'Douleur',
  status: 'MATCHED',
  selectedOfferId: 'of-1',
  createdAt: '2026-08-13T09:00:00Z',
  offers: [],
};

const ACCEPTED = [
  {
    offerId: 'of-1',
    doctorId: 'd-1',
    doctorName: 'Dr Amira Trabelsi',
    distanceKm: 3.2,
    acceptedAt: '2026-08-13T09:01:00Z',
  },
];

describe('UrgentRequestTrackingPage', () => {
  function create(preference: 'HOME_VISIT' | 'CABINET_VISIT'): {
    page: UrgentRequestTrackingPage;
    http: HttpTestingController;
  } {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: '/api/v1' } },
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: new FakeParamMap({ id: 'urgent-1' }) },
          },
        },
      ],
    });
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const tokens = TestBed.inject(AuthTokenStore);
    tokens.setSession({
      accessToken: 'patient-access-token',
      tokenType: 'Bearer',
      expiresAt: '2026-08-05T12:10:00Z',
      refreshToken: 'patient-refresh-token',
      refreshExpiresAt: '2026-08-06T00:00:00Z',
      user: { id: 'patient-1', role: 'PATIENT', mustChangePassword: false },
    });
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(UrgentRequestTrackingPage);
    fixture.detectChanges();
    const requestBody = { ...MATCHED_REQUEST, visitPreference: preference };
    http.expectOne('/api/v1/urgent-requests/urgent-1').flush(requestBody);
    http.expectOne('/api/v1/urgent-requests/urgent-1/offers').flush(
      preference === 'CABINET_VISIT' ? [] : ACCEPTED,
    );
    return { page: fixture.componentInstance, http };
  }

  afterEach(() => {
    try {
      TestBed.inject(HttpTestingController).verify();
    } finally {
      TestBed.resetTestingModule();
    }
  });

  it('shows the chosen doctor and the live distance for a home visit', () => {
    const { page, http } = create('HOME_VISIT');

    expect(page.loading()).toBe(false);
    expect(page.error()).toBeNull();
    expect(page.doctorName()).toBe('Dr Amira Trabelsi');
    expect(page.distanceKm()).toBe(3.2);
    expect(page.cabinetVisit()).toBe(false);
    expect(page.distanceLabel()).toContain('km');
    expect(page.acceptedLabel()).toContain('13/08/2026');
  });

  it('refreshes the distance every 7 seconds until the doctor arrives', () => {
    vi.useFakeTimers();
    try {
      const { page, http } = create('HOME_VISIT');

      vi.advanceTimersByTime(7_000);
      http.expectOne('/api/v1/urgent-requests/urgent-1').flush({
        ...MATCHED_REQUEST,
        status: 'MATCHED',
      });
      http
        .expectOne('/api/v1/urgent-requests/urgent-1/offers')
        .flush([{ ...ACCEPTED[0], distanceKm: 1.1 }]);
      expect(page.distanceKm()).toBe(1.1);

      vi.advanceTimersByTime(7_000);
      http.expectOne('/api/v1/urgent-requests/urgent-1').flush({
        ...MATCHED_REQUEST,
        status: 'ARRIVED',
      });
      http.expectOne('/api/v1/urgent-requests/urgent-1/offers').flush(ACCEPTED);
      expect(page.arrived()).toBe(true);

      vi.advanceTimersByTime(7_000);
      http.expectNone('/api/v1/urgent-requests/urgent-1');
      http.expectNone('/api/v1/urgent-requests/urgent-1/offers');
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows the no-address note for a cabinet visit without polling', () => {
    vi.useFakeTimers();
    try {
      const { page, http } = create('CABINET_VISIT');

      expect(page.cabinetVisit()).toBe(true);
      expect(page.doctorName()).toBeNull();

      vi.advanceTimersByTime(60_000);
      http.expectNone('/api/v1/urgent-requests/urgent-1');
      http.expectNone('/api/v1/urgent-requests/urgent-1/offers');
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns to the urgent workspace from the back button', () => {
    const { page, http } = create('HOME_VISIT');

    page.backToUrgent();

    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/patient'], {
      queryParams: { tab: 'urgent' },
    });
  });
});
