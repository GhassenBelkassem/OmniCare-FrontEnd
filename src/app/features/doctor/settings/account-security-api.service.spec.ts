import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { RUNTIME_CONFIG } from '../../../core/config/runtime-config';
import { AccountSecurityApiService } from './account-security-api.service';

describe('AccountSecurityApiService', () => {
  let http: HttpTestingController;
  let service: AccountSecurityApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: '/api/v1' } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(AccountSecurityApiService);
  });

  afterEach(() => http.verify());

  it('loads the curated authenticated Doctor account summary', () => {
    service.getSummary().subscribe();

    const request = http.expectOne('/api/v1/me/account-security');
    expect(request.request.method).toBe('GET');
  });

  it('loads safe device summaries', () => {
    service.getDevices().subscribe();

    const request = http.expectOne('/api/v1/auth/devices');
    expect(request.request.method).toBe('GET');
  });

  it('changes the password with only the backend contract fields', () => {
    service
      .changePassword({ currentPassword: 'CurrentPassword123', newPassword: 'NewPassword12345' })
      .subscribe();

    const request = http.expectOne('/api/v1/auth/password/change');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      currentPassword: 'CurrentPassword123',
      newPassword: 'NewPassword12345',
    });
  });

  it('logs out one owned device without putting an identity in the body', () => {
    service.logoutDevice('device-1').subscribe();

    const request = http.expectOne('/api/v1/auth/devices/device-1/logout');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({});
  });
});
