import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNzIcons } from 'ng-zorro-antd/icon';

import { OMNICARE_ICONS } from '../../../app.icons';
import { AuthService } from '../../../core/auth/auth.service';
import { RUNTIME_CONFIG } from '../../../core/config/runtime-config';
import {
  UrgentCareReadinessResponse,
  UrgentReadinessBlockingReason,
} from './urgent-care-configuration-api.models';
import { UrgentCareReadinessSettings } from './urgent-care-readiness-settings';

describe('UrgentCareReadinessSettings', () => {
  let fixture: ComponentFixture<UrgentCareReadinessSettings>;
  let http: HttpTestingController;
  const logout = vi.fn();
  const readinessUrl = '/api/v1/me/care-capabilities/urgent-configuration/readiness';

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UrgentCareReadinessSettings],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideNzIcons(OMNICARE_ICONS),
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: '/api/v1' } },
        { provide: AuthService, useValue: { logout } },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(UrgentCareReadinessSettings);
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
    logout.mockReset();
  });

  it('renders fully configured HOME and CABINET without claiming full live eligibility', () => {
    flush(readiness());
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Configuration complète');
    expect(text).toContain('Intention opérationnelle active');
    expect(text).toContain('Vérification complète non effectuée');
    expect(text).toContain('ne signifie pas que vous êtes disponible');
    expect(text).not.toContain('Disponible pour les urgences');
  });

  it.each([
    ['HOME_FEE_NOT_CONFIGURED', 'Tarif HOME non configuré'],
    ['HOME_TRAVEL_DISTANCE_NOT_CONFIGURED', 'Distance HOME non configurée'],
    ['CABINET_FEE_NOT_CONFIGURED', 'Tarif CABINET non configuré'],
    ['NO_ACTIVE_CABINET', 'Aucun cabinet actif'],
    ['CAPABILITY_DISABLED', 'Capacité permanente désactivée'],
    ['PROFESSIONAL_NOT_ELIGIBLE', 'Profil professionnel non éligible'],
    ['RUNTIME_HOME_INTENT_DISABLED', 'Disponibilité HOME inactive'],
    ['CLINICAL_BUSY', 'Activité clinique en cours'],
    ['ACTIVE_URGENT_CAPACITY_CLAIM', 'Capacité urgente déjà engagée'],
  ] satisfies ReadonlyArray<readonly [UrgentReadinessBlockingReason, string]>)(
    'renders backend blocker %s with reviewed French copy',
    (reason, expected) => {
      flush(readiness({ homeReasons: [reason] }));
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain(expected);
    },
  );

  it('presents an intentionally disabled mode concisely without rewriting backend reasons', () => {
    flush(
      readiness({
        homeCapability: false,
        homeConfiguration: false,
        homeRuntime: false,
        homeReasons: ['CAPABILITY_DISABLED', 'HOME_FEE_NOT_CONFIGURED'],
      }),
    );
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Mode inactif');
    expect(text).toContain('Ce mode est désactivé dans vos capacités permanentes');
    expect(text).not.toContain('Tarif HOME non configuré');
    expect(fixture.componentInstance.readiness()?.home.blockingReasons).toEqual([
      'CAPABILITY_DISABLED',
      'HOME_FEE_NOT_CONFIGURED',
    ]);
  });

  it('uses a safe fallback for an unknown backend reason', () => {
    flush(readiness({ homeReasons: ['FUTURE_INTERNAL_REASON'] }));
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Condition supplémentaire à vérifier');
    expect(text).not.toContain('FUTURE_INTERNAL_REASON');
  });

  it('shows backend unavailability without synthetic fallback', () => {
    http.expectOne(readinessUrl).flush({}, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Préparation impossible à vérifier');
    expect(text).toContain('Aucune valeur de remplacement');
    expect(text).not.toContain('Cabinet Démo');
  });

  it('keeps the last response visibly stale when a later refresh fails', () => {
    flush(readiness({ revision: 4 }));
    fixture.componentInstance.refresh();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Actualisation en cours');

    http.expectOne(readinessUrl).flush({}, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('État non vérifié');
    expect(fixture.nativeElement.textContent).toContain('Révision 4');
  });

  it('prevents an older overlapping HTTP result from overwriting the newer readiness', () => {
    fixture.componentInstance.refresh();
    const requests = http.match(readinessUrl);
    expect(requests).toHaveLength(2);

    requests[1].flush(readiness({ revision: 9 }));
    requests[0].flush(readiness({ revision: 3 }));
    fixture.detectChanges();

    expect(fixture.componentInstance.readiness()?.revision).toBe(9);
    expect(fixture.nativeElement.textContent).toContain('Révision 9');
  });

  it.each([
    [401, 'Session expirée'],
    [403, 'Accès refusé'],
  ])('handles private endpoint status %s explicitly', (status, expected) => {
    http.expectOne(readinessUrl).flush({}, { status, statusText: expected });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(expected);
    expect(fixture.componentInstance.readiness()).toBeNull();
  });

  it('calls only the Doctor-self readiness GET and exposes no runtime mutation', () => {
    const request = http.expectOne(readinessUrl);
    expect(request.request.method).toBe('GET');
    expect(request.request.body).toBeNull();
    request.flush(readiness());

    expect(fixture.nativeElement.querySelector('input[type="checkbox"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    expect(http.match((candidate) => candidate.url.includes('/urgent-requests/'))).toHaveLength(0);
  });
});

interface ReadinessOptions {
  revision?: number;
  homeReasons?: readonly UrgentReadinessBlockingReason[];
  homeCapability?: boolean;
  homeConfiguration?: boolean;
  homeRuntime?: boolean;
  cabinetConfiguration?: boolean;
}

function readiness(options: ReadinessOptions = {}): UrgentCareReadinessResponse {
  return {
    revision: options.revision ?? 2,
    professionalEligible: !options.homeReasons?.includes('PROFESSIONAL_NOT_ELIGIBLE'),
    home: {
      capabilityEnabled: options.homeCapability ?? true,
      configurationReady: options.homeConfiguration ?? true,
      runtimeAvailabilityIntent: options.homeRuntime ?? true,
      effectiveCurrentEligibility: false,
      blockingReasons: options.homeReasons ?? ['REQUEST_SPECIFIC_ELIGIBILITY_NOT_EVALUATED'],
    },
    cabinet: {
      capabilityEnabled: true,
      configurationReady: options.cabinetConfiguration ?? true,
      runtimeAvailabilityIntent: true,
      effectiveCurrentEligibility: false,
      blockingReasons: ['REQUEST_SPECIFIC_ELIGIBILITY_NOT_EVALUATED'],
    },
    completeLiveMatchingEligibilityEvaluated: false,
    evaluatedAt: '2026-10-15T10:00:00Z',
  };
}

function flush(response: UrgentCareReadinessResponse): void {
  TestBed.inject(HttpTestingController)
    .expectOne('/api/v1/me/care-capabilities/urgent-configuration/readiness')
    .flush(response);
}
