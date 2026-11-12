import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';
import { AuthTokenStore } from './auth-token.store';
import { SensitiveStateRegistry } from './sensitive-state.registry';
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

    expect(result).toEqual({ kind: 'AUTHENTICATED', role: 'PATIENT' });
    expect(tokens.authenticated()).toBe(true);
    expect(tokens.user()?.role).toBe('PATIENT');
  });

  it('continues a legitimate phone OTP challenge and issues the final session', () => {
    let result: unknown;
    service.login('patient@omnicare.local', 'Password123!').subscribe((value) => (result = value));

    http.expectOne('/api/v1/auth/login').flush({
      status: 'REQUIRES_PHONE_OTP',
      session: null,
      phone: '+21620123456',
    });

    expect(result).toEqual({ kind: 'OTP_REQUIRED' });
    expect(tokens.authState()).toBe('OTP_REQUIRED');
    expect(tokens.authenticated()).toBe(false);

    service.verifyPhoneOtp('123456').subscribe((value) => (result = value));
    const verify = http.expectOne('/api/v1/auth/login/phone/verify');
    expect(verify.request.body.phone).toBe('+21620123456');
    expect(verify.request.body.otp).toBe('123456');
    verify.flush({
      accessToken: 'verified-access',
      tokenType: 'Bearer',
      expiresAt: '2999-08-05T12:10:00Z',
      refreshToken: 'verified-refresh',
      refreshExpiresAt: '2999-08-06T00:00:00Z',
      user: { id: 'patient-1', role: 'PATIENT', mustChangePassword: false },
    });
    expect(result).toEqual({ kind: 'AUTHENTICATED', role: 'PATIENT' });
    expect(tokens.authenticated()).toBe(true);
  });

  it('keeps a forced-password session out of the normal authenticated state', () => {
    let result: unknown;
    service
      .login('doctor@omnicare.local', 'TemporaryPassword123!')
      .subscribe((value) => (result = value));
    http.expectOne('/api/v1/auth/login').flush({
      status: 'AUTHENTICATED',
      phone: null,
      session: {
        accessToken: 'forced-access',
        tokenType: 'Bearer',
        expiresAt: '2999-08-05T12:10:00Z',
        refreshToken: 'forced-refresh',
        refreshExpiresAt: '2999-08-06T00:00:00Z',
        user: { id: 'doctor-1', role: 'DOCTOR', mustChangePassword: true },
      },
    });
    expect(result).toEqual({ kind: 'PASSWORD_CHANGE_REQUIRED' });
    expect(tokens.authState()).toBe('PASSWORD_CHANGE_REQUIRED');
    expect(tokens.authenticated()).toBe(false);
  });

  it('rejects an invalid credential-bearing payload without mutating authentication state', () => {
    let received: Error | undefined;
    service.verifyPhoneOtp('123456').subscribe({ error: (error: Error) => { received = error; } });
    expect(received?.message).toContain('challenge has expired');

    service.login('doctor@omnicare.local', 'Password123!').subscribe({ error: (error: Error) => { received = error; } });
    http.expectOne('/api/v1/auth/login').flush({
      status: 'AUTHENTICATED',
      phone: null,
      session: {
        accessToken: 'token',
        tokenType: 'Bearer',
        expiresAt: 'not-a-timestamp',
        refreshToken: 'refresh',
        refreshExpiresAt: '2999-08-08T00:15:00Z',
        user: { id: 'doctor-1', role: 'DOCTOR', mustChangePassword: false },
      },
    });

    expect(received?.message).toContain('invalid session response');
    expect(tokens.authenticated()).toBe(false);
    expect(tokens.accessToken()).toBeNull();
  });

  it('clears the complete local session after logout-all succeeds', () => {
    let selectedPatient: string | null = 'patient-1';
    TestBed.inject(SensitiveStateRegistry).register(() => {
      selectedPatient = null;
    });
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
    expect(selectedPatient).toBeNull();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
  });
});
