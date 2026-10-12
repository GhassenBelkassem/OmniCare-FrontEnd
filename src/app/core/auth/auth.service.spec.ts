import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';
import { AuthTokenStore } from './auth-token.store';
import { RUNTIME_CONFIG } from '../config/runtime-config';

describe('AuthService', () => {
  let service: AuthService;
  let tokens: AuthTokenStore;
  let http: HttpTestingController;
  const router = { navigateByUrl: vi.fn(() => Promise.resolve(true)) };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: '/api/v1' } },
        { provide: Router, useValue: router },
      ],
    });
    router.navigateByUrl.mockClear();
    service = TestBed.inject(AuthService);
    tokens = TestBed.inject(AuthTokenStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('stores the session and reports the role for an authenticated login', () => {
    let result: unknown;
    service.login('patient@omnicare.local', 'Password123!').subscribe((step) => (result = step));

    const request = http.expectOne('/api/v1/auth/login');
    expect(request.request.body).toEqual({
      identifier: 'patient@omnicare.local',
      password: 'Password123!',
      deviceFingerprint: expect.any(String),
      platform: 'WEB',
      deviceLabel: 'OmniCare dashboard',
      sharedDevice: false,
      rememberDevice: true,
    });
    request.flush({
      status: 'AUTHENTICATED',
      session: {
        accessToken: 'patient-access',
        tokenType: 'Bearer',
        expiresAt: '2026-08-05T12:10:00Z',
        refreshToken: 'patient-refresh',
        refreshExpiresAt: '2026-08-06T00:00:00Z',
        user: { id: 'patient-1', role: 'PATIENT', mustChangePassword: false },
      },
      phone: null,
    });

    expect(result).toBe('PATIENT');
    expect(tokens.authenticated()).toBe(true);
    expect(tokens.user()?.role).toBe('PATIENT');
  });

  it('rejects an unexpected phone OTP challenge while verification is disabled', () => {
    let error: unknown;
    service.login('patient@omnicare.local', 'Password123!').subscribe({
      error: (err: unknown) => (error = err),
    });

    http.expectOne('/api/v1/auth/login').flush({
      status: 'REQUIRES_PHONE_OTP',
      session: null,
      phone: '+21620123456',
    });

    expect(error).toEqual(new Error('The server returned an invalid login response.'));
    expect(tokens.authenticated()).toBe(false);
  });

  it('clears the complete local session after logout-all succeeds', () => {
    tokens.setSession({
      accessToken: 'doctor-access',
      tokenType: 'Bearer',
      expiresAt: '2027-08-05T12:10:00Z',
      refreshToken: 'doctor-refresh',
      refreshExpiresAt: '2027-08-06T00:00:00Z',
      user: { id: 'doctor-1', role: 'DOCTOR', mustChangePassword: false },
    });

    service.logoutAll().subscribe();

    const request = http.expectOne('/api/v1/auth/logout-all');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({});
    request.flush(null);

    expect(tokens.authenticated()).toBe(false);
    expect(tokens.accessToken()).toBeNull();
    expect(tokens.refreshToken()).toBeNull();
    expect(tokens.user()).toBeNull();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
  });
});
