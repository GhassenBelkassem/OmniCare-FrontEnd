import { HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { authInterceptor } from '../../../core/auth/auth.interceptor';
import { AuthTokenStore } from '../../../core/auth/auth-token.store';
import { RUNTIME_CONFIG } from '../../../core/config/runtime-config';
import { ProfessionalProfileApiService } from './professional-profile-api.service';

describe('ProfessionalProfileApiService', () => {
  let service: ProfessionalProfileApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: '/api/v1' } },
      ],
    });
    const tokens = TestBed.inject(AuthTokenStore);
    tokens.setSession({
      accessToken: 'doctor-access-token',
      tokenType: 'Bearer',
      expiresAt: '2026-09-24T12:10:00Z',
      refreshToken: 'doctor-refresh-token',
      refreshExpiresAt: '2026-09-25T00:00:00Z',
      user: { id: 'doctor-1', role: 'DOCTOR', mustChangePassword: false },
    });
    service = TestBed.inject(ProfessionalProfileApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads the self professional profile with the access token', () => {
    service.getProfile().subscribe();
    const request = http.expectOne(
      (candidate) => candidate.url === '/api/v1/me/professional-profile',
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer doctor-access-token');
    request.flush({ userId: 'doctor-1', specialty: 'Cardiologie' });
  });

  it('patches only the provided fields with the access token', () => {
    service.updateProfile({ specialty: 'Cardiologie', languages: ['Francais'] }).subscribe();
    const request = http.expectOne(
      (candidate) => candidate.url === '/api/v1/me/professional-profile',
    );
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ specialty: 'Cardiologie', languages: ['Francais'] });
    expect(request.request.headers.get('Authorization')).toBe('Bearer doctor-access-token');
    request.flush({ userId: 'doctor-1', specialty: 'Cardiologie' });
  });

  it('forwards a 400 error to the subscriber', () => {
    let receivedError: unknown;
    service.updateProfile({}).subscribe({ error: (error: unknown) => (receivedError = error) });
    http
      .expectOne((candidate) => candidate.url === '/api/v1/me/professional-profile')
      .flush({ message: 'At least one field must be provided.' }, {
        status: 400,
        statusText: 'Bad Request',
      });
    expect(receivedError instanceof HttpErrorResponse).toBe(true);
    expect((receivedError as HttpErrorResponse).status).toBe(400);
  });
});