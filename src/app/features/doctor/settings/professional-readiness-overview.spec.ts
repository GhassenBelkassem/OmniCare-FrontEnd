import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProfessionalReadinessResponse } from './professional-readiness-api.models';
import { ProfessionalReadinessApiService } from './professional-readiness-api.service';
import { ProfessionalReadinessOverview } from './professional-readiness-overview';

class ReadinessApiStub {
  readonly requests: Subject<ProfessionalReadinessResponse>[] = [];

  get(): Subject<ProfessionalReadinessResponse> {
    const request = new Subject<ProfessionalReadinessResponse>();
    this.requests.push(request);
    return request;
  }
}

describe('ProfessionalReadinessOverview', () => {
  let fixture: ComponentFixture<ProfessionalReadinessOverview>;
  let api: ReadinessApiStub;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ProfessionalReadinessOverview],
      providers: [{ provide: ProfessionalReadinessApiService, useClass: ReadinessApiStub }],
    });
    api = TestBed.inject(ProfessionalReadinessApiService) as unknown as ReadinessApiStub;
    fixture = TestBed.createComponent(ProfessionalReadinessOverview);
    fixture.detectChanges();
  });

  it('uses layout-shaped skeletons while the endpoint is loading', () => {
    expect(text()).toContain('Vérification de votre visibilité en cours.');
    expect(root().querySelectorAll('oc-skeleton')).toHaveLength(8);
  });

  it('renders the healthy patient, Cabinet, verification, intake, and cabinet-count states', () => {
    flush(readiness());

    expect(text()).toContain('Votre profil est visible');
    expect(text()).toContain('Disponible pour les consultations au cabinet');
    expect(text()).toContain('Service activé');
    expect(text()).toContain('1 cabinet actif');
    expect(text()).toContain('Profil vérifié');
    expect(text()).toContain('Vérifié le 5 octobre 2026');
    expect(text()).toContain('Vous acceptez de nouveaux patients');
    expect(root().querySelector('.readiness__actions')).toBeNull();
  });

  it('renders general blockers returned by the backend', () => {
    flush(
      readiness({
        publicDirectory: {
          discoverable: false,
          blockingReasons: ['PROFESSIONAL_NOT_VERIFIED'],
        },
        professionalVerification: { verified: false, verifiedAt: null },
      }),
    );

    expect(text()).toContain('Votre profil n’est pas encore visible');
    expect(text()).toContain('Profil professionnel non vérifié');
    expect(text()).toContain('Vérification en attente');
  });

  it('keeps the general profile visible when only Cabinet discovery is blocked', () => {
    flush(
      readiness({
        cabinet: {
          discoverable: false,
          capabilityEnabled: true,
          activeCabinetCount: 0,
          blockingReasons: ['NO_ACTIVE_CABINET'],
        },
      }),
    );

    expect(text()).toContain('Votre profil est visible');
    expect(text()).toContain('Configuration incomplète');
    expect(text()).toContain('Aucun cabinet actif');
    expect(text()).not.toContain('Votre profil n’est pas encore visible');
  });

  it('keeps the general profile visible when new-patient intake blocks only Cabinet acquisition', () => {
    flush(
      readiness({
        acceptingNewPatients: false,
        cabinet: {
          discoverable: false,
          capabilityEnabled: true,
          activeCabinetCount: 2,
          blockingReasons: ['NOT_ACCEPTING_NEW_PATIENTS'],
        },
      }),
    );

    expect(text()).toContain('Votre profil est visible');
    expect(text()).toContain('Vous n’acceptez pas actuellement de nouveaux patients');
    expect(text()).toContain('Nouveaux patients désactivés');
    expect(text()).toContain('2 cabinets actifs');
  });

  it.each([
    ['Modifier mon profil', 'profile'],
    ['Gérer mes cabinets', 'cabinets'],
    ['Configurer mes services', 'services'],
  ] as const)('routes the %s blocker action to the %s tab', (label, tab) => {
    const navigate = vi.fn();
    fixture.componentInstance.navigateTo.subscribe(navigate);
    flush(
      readiness({
        publicDirectory: {
          discoverable: false,
          blockingReasons: [
            tab === 'profile'
              ? 'PROFESSIONAL_PROFILE_MISSING'
              : tab === 'cabinets'
                ? 'NO_ACTIVE_CABINET'
                : 'CABINET_CAPABILITY_DISABLED',
          ],
        },
      }),
    );

    button(label).click();
    expect(navigate).toHaveBeenCalledWith(tab);
  });

  it('shows a safe error and retries the authoritative endpoint', () => {
    api.requests[0]?.error(
      new HttpErrorResponse({ status: 500, error: { message: 'sensitive internal detail' } }),
    );
    fixture.detectChanges();

    expect(text()).toContain('Impossible de vérifier votre visibilité');
    expect(text()).not.toContain('sensitive internal detail');
    button('Réessayer').click();
    expect(api.requests).toHaveLength(2);
  });

  it('renders an unknown future reason without exposing its code or crashing', () => {
    flush(
      readiness({
        publicDirectory: { discoverable: false, blockingReasons: ['FUTURE_BACKEND_REASON'] },
      }),
    );

    expect(text()).toContain('Configuration à vérifier');
    expect(text()).not.toContain('FUTURE_BACKEND_REASON');
  });

  function flush(value: ProfessionalReadinessResponse): void {
    api.requests[0]?.next(value);
    api.requests[0]?.complete();
    fixture.detectChanges();
  }

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function text(): string {
    return root().textContent ?? '';
  }

  function button(label: string): HTMLButtonElement {
    const match = [...root().querySelectorAll('button')].find((candidate) =>
      candidate.textContent?.includes(label),
    );
    if (!(match instanceof HTMLButtonElement)) throw new Error(`Button not found: ${label}`);
    return match;
  }
});

function readiness(
  overrides: Partial<ProfessionalReadinessResponse> = {},
): ProfessionalReadinessResponse {
  return {
    publicDirectory: { discoverable: true, blockingReasons: [] },
    cabinet: {
      discoverable: true,
      capabilityEnabled: true,
      activeCabinetCount: 1,
      blockingReasons: [],
    },
    acceptingNewPatients: true,
    professionalVerification: {
      verified: true,
      verifiedAt: '2026-10-05T08:30:00Z',
    },
    evaluatedAt: '2026-10-05T09:00:00Z',
    ...overrides,
  };
}
