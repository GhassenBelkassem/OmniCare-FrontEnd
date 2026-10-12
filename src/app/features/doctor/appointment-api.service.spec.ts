import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { RUNTIME_CONFIG } from '../../core/config/runtime-config';
import type { AvailabilityRuleDto } from './appointment-api.models';
import { AppointmentApiService } from './appointment-api.service';

describe('AppointmentApiService availability wall-clock contract', () => {
  let service: AppointmentApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: '/api/v1' } },
      ],
    });
    service = TestBed.inject(AppointmentApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('writes weekly LocalTime values as plain wall-clock strings with weekends absent', () => {
    const weekdays = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as const;
    const rules: readonly AvailabilityRuleDto[] = weekdays.map((dayOfWeek) => ({
      dayOfWeek,
      active: true,
      startTime: '09:00',
      endTime: '15:00',
      pauseStart: '13:00',
      pauseEnd: '13:30',
      slotDurationMinutes: 30,
    }));

    service.saveRules(rules).subscribe();

    const request = http.expectOne('/api/v1/appointments/availability/rules');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(rules);
    expect(JSON.stringify(request.request.body)).not.toContain('1970-');
    expect(JSON.stringify(request.request.body)).not.toContain('Z');
    expect(request.request.body).toHaveLength(5);
    request.flush(rules);
  });

  it('reads server LocalTime strings without converting them to Date or UTC', () => {
    let result: readonly AvailabilityRuleDto[] = [];
    service.listRules().subscribe((rules) => (result = rules));
    const request = http.expectOne('/api/v1/appointments/availability/rules');
    request.flush([
      {
        dayOfWeek: 'MONDAY',
        active: true,
        startTime: '09:00:00',
        endTime: '15:00:00',
        pauseStart: '13:00:00',
        pauseEnd: '13:30:00',
        slotDurationMinutes: 30,
      },
    ]);

    expect(result[0]).toMatchObject({
      startTime: '09:00:00',
      endTime: '15:00:00',
      pauseStart: '13:00:00',
      pauseEnd: '13:30:00',
    });
  });

  it('posts a full-working-day exception as the derived wall-clock interval', () => {
    service
      .addException({
        exceptionDate: '2026-10-09',
        type: 'BLOCK',
        startTime: '09:00',
        endTime: '15:00',
        reason: 'Absent',
      })
      .subscribe();

    const request = http.expectOne('/api/v1/appointments/availability/exceptions');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      exceptionDate: '2026-10-09',
      type: 'BLOCK',
      startTime: '09:00',
      endTime: '15:00',
      reason: 'Absent',
    });
    request.flush({ id: 'exception-1', ...request.request.body });
  });
});
