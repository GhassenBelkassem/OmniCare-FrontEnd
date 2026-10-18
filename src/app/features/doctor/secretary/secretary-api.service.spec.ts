import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AuthTokenStore } from '../../../core/auth/auth-token.store';
import { authInterceptor } from '../../../core/auth/auth.interceptor';
import { RUNTIME_CONFIG } from '../../../core/config/runtime-config';
import { SecretaryApiService } from './secretary-api.service';

describe('SecretaryApiService', () => {
  let service: SecretaryApiService;
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
      expiresAt: '2999-08-06T12:00:00Z',
      refreshToken: 'doctor-refresh-token',
      refreshExpiresAt: '2999-08-06T23:59:59Z',
      user: { id: 'doctor-1', role: 'DOCTOR', mustChangePassword: false },
    });
    service = TestBed.inject(SecretaryApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists the delegations of the signed-in doctor', () => {
    service.list().subscribe();

    const request = http.expectOne('/api/v1/me/secretaries');
    expect(request.request.method).toBe('GET');
    request.flush([]);
  });

  it('invites by email and permissions only, never by name', () => {
    service.invite({ email: 'assistant@cabinet.tn', permissions: ['VIEW_AGENDA'] }).subscribe();

    const request = http.expectOne('/api/v1/me/secretaries/invitations');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      email: 'assistant@cabinet.tn',
      permissions: ['VIEW_AGENDA'],
    });
    expect(Object.keys(request.request.body as object)).not.toContain('firstName');
    expect(Object.keys(request.request.body as object)).not.toContain('lastName');
    request.flush({});
  });

  it('omits permissions entirely when none are chosen', () => {
    service.invite({ email: 'assistant@cabinet.tn' }).subscribe();

    const request = http.expectOne('/api/v1/me/secretaries/invitations');
    expect(Object.keys(request.request.body as object)).toEqual(['email']);
    request.flush({});
  });

  it('replaces the whole permission set on PATCH', () => {
    service.replacePermissions('mem-1', ['VIEW_AGENDA', 'CANCEL_APPOINTMENT']).subscribe();

    const request = http.expectOne('/api/v1/me/secretaries/mem-1/permissions');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({
      permissions: ['VIEW_AGENDA', 'CANCEL_APPOINTMENT'],
    });
    request.flush({});
  });

  it('resends an invitation without a body', () => {
    service.resendInvitation('mem-1').subscribe();

    const request = http.expectOne('/api/v1/me/secretaries/mem-1/invitation/resend');
    expect(request.request.method).toBe('POST');
    request.flush({});
  });

  it('suspends and ends a delegation', () => {
    service.suspend('mem-1').subscribe();
    const suspend = http.expectOne('/api/v1/me/secretaries/mem-1/suspension');
    expect(suspend.request.method).toBe('POST');
    suspend.flush({});

    service.end('mem-1').subscribe();
    const end = http.expectOne('/api/v1/me/secretaries/mem-1/end');
    expect(end.request.method).toBe('POST');
    end.flush({});
  });
});