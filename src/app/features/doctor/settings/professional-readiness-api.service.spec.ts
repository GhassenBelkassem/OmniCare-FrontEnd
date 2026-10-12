import { HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { authInterceptor } from '../../../core/auth/auth.interceptor';
import { AuthTokenStore } from '../../../core/auth/auth-token.store';
import { RUNTIME_CONFIG } from '../../../core/config/runtime-config';
import {
  ProfessionalReadinessApiService,
  mapProfessionalReadinessFailure,
} from './professional-readiness-api.service';
import { ProfessionalReadinessResponse } from './professional-readiness-api.models';

describe('ProfessionalReadinessApiService', () => {
  it('gets the authoritative readiness endpoint with a typed response', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: '/api/v1' } },
      ],
    });
    TestBed.inject(AuthTokenStore).setSession({
      accessToken: 'doctor-access-token',
      tokenType: 'Bearer',
      expiresAt: '2026-10-05T12:10:00Z',
      refreshToken: 'doctor-refresh-token',
      refreshExpiresAt: '2026-10-06T00:00:00Z',
      user: { id: 'doctor-1', role: 'DOCTOR', mustChangePassword: false },
    });

    let response: ProfessionalReadinessResponse | undefined;
    TestBed.inject(ProfessionalReadinessApiService)
      .get()
      .subscribe((value) => (response = value));

    const http = TestBed.inject(HttpTestingController);
    const request = http.expectOne('/api/v1/me/professional-readiness');
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer doctor-access-token');
    request.flush(readiness());
    expect(response?.cabinet.activeCabinetCount).toBe(1);
    expect(response?.professionalVerification.verifiedAt).toBe('2026-10-05T08:30:00Z');
    http.verify();
  });

  it('maps authentication, network, and unknown failures to safe product copy', () => {
    const authentication = mapProfessionalReadinessFailure(
      new HttpErrorResponse({ status: 401, error: { message: 'raw backend detail' } }),
    );
    const network = mapProfessionalReadinessFailure(new HttpErrorResponse({ status: 0 }));
    const unknown = mapProfessionalReadinessFailure(new Error('internal detail'));

    expect(authentication.title).toBe('Impossible de vérifier votre visibilité');
    expect(authentication.description).not.toContain('raw backend detail');
    expect(network.description).toContain('connexion');
    expect(unknown.description).toContain('momentanément indisponibles');
  });
});

function readiness(): ProfessionalReadinessResponse {
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
  };
}
