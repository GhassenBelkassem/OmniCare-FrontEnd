import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { RUNTIME_CONFIG } from '../../core/config/runtime-config';
import { InvitationApiService } from './invitation-api.service';

describe('InvitationApiService', () => {
  let service: InvitationApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: '/api/v1' } },
      ],
    });
    service = TestBed.inject(InvitationApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('validates the invitation response before exposing it to the page', () => {
    let received: unknown;
    service.validate('opaque-token').subscribe((value) => { received = value; });
    const request = http.expectOne('/api/v1/auth/invitations/validate');
    expect(request.request.body).toEqual({ token: 'opaque-token' });
    request.flush({ email: 'doctor@example.test', role: 'DOCTOR', expiresAt: '2999-01-01T00:00:00Z' });
    expect(received).toEqual({ email: 'doctor@example.test', role: 'DOCTOR', expiresAt: '2999-01-01T00:00:00Z' });
  });

  it('rejects a malformed invitation payload without exposing it as valid state', () => {
    let received: Error | undefined;
    service.validate('opaque-token').subscribe({ error: (error: Error) => { received = error; } });
    http.expectOne('/api/v1/auth/invitations/validate').flush({ email: 'doctor@example.test', role: 'ROOT', expiresAt: 'never' });
    expect(received?.message).toContain('invalid invitation response');
  });

  it('uses the authoritative acceptance contract', () => {
    service.accept('opaque-token', 'NewPassword123!').subscribe();
    const request = http.expectOne('/api/v1/auth/invitations/accept');
    expect(request.request.body).toEqual({ token: 'opaque-token', newPassword: 'NewPassword123!' });
    request.flush(null);
  });
});
