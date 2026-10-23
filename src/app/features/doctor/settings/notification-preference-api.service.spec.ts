import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { RUNTIME_CONFIG } from '../../../core/config/runtime-config';
import { NotificationPreferenceApiService } from './notification-preference-api.service';

describe('NotificationPreferenceApiService', () => {
  let http: HttpTestingController;
  let service: NotificationPreferenceApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: '/api/v1' } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(NotificationPreferenceApiService);
  });

  afterEach(() => http.verify());

  it('loads the authenticated user notification preferences', () => {
    service.getAll().subscribe();

    const request = http.expectOne('/api/v1/notifications/preferences');
    expect(request.request.method).toBe('GET');
  });

  it('updates one category with the exact backend request body', () => {
    const body = {
      pushEnabled: true,
      smsEnabled: false,
      dndEnabled: true,
      dndStart: '22:00',
      dndEnd: '07:00',
    };

    service.update('CLINIC_OPS', body).subscribe();

    const request = http.expectOne('/api/v1/notifications/preferences/CLINIC_OPS');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(body);
  });
});
