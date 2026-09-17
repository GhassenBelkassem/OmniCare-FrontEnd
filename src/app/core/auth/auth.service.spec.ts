import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';
import { AuthTokenStore } from './auth-token.store';
import { RUNTIME_CONFIG } from '../config/runtime-config';

describe('AuthService', () => {
  let service: AuthService;
  let tokens: AuthTokenStore;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: '/api/v1' } },
      ],
    });
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

    expect(result).toEqual({ kind: 'authenticated', role: 'PATIENT' });
    expect(tokens.authenticated()).toBe(true);
    expect(tokens.user()?.role).toBe('PATIENT');
  });

  it('surfaces the phone OTP step instead of failing for patient accounts', () => {
    let result: unknown;
    let error: unknown;
    service.login('patient@omnicare.local', 'Password123!').subscribe({
      next: (step) => (result = step),
      error: (err: unknown) => (error = err),
    });

    http.expectOne('/api/v1/auth/login').flush({
      status: 'REQUIRES_PHONE_OTP',
      session: null,
      phone: '+21620123456',
    });

    expect(error).toBeUndefined();
    expect(result).toEqual({ kind: 'requires-otp', phone: '+21620123456' });
    expect(tokens.authenticated()).toBe(false);
  });

  it('completes login through the phone OTP verification endpoint', () => {
    let result: unknown;
    service.verifyPhoneOtp('+21620123456', '123456').subscribe((role) => (result = role));

    const request = http.expectOne('/api/v1/auth/login/phone/verify');
    expect(request.request.body).toEqual({
      phone: '+21620123456',
      otp: '123456',
      deviceFingerprint: expect.any(String),
      platform: 'WEB',
      deviceLabel: 'OmniCare dashboard',
      sharedDevice: false,
      rememberDevice: true,
    });
    request.flush({
      accessToken: 'patient-access',
      tokenType: 'Bearer',
      expiresAt: '2026-08-05T12:10:00Z',
      refreshToken: 'patient-refresh',
      refreshExpiresAt: '2026-08-06T00:00:00Z',
      user: { id: 'patient-1', role: 'PATIENT', mustChangePassword: false },
    });

    expect(result).toBe('PATIENT');
    expect(tokens.authenticated()).toBe(true);
  });
});
