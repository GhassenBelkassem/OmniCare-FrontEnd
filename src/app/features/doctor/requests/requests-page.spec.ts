import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Subject, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RealtimeService } from '../../../core/realtime/realtime.service';
import { DoctorUrgentApiService } from '../doctor-urgent-api.service';
import { UrgentAcceptedStore } from '../urgent-accepted.store';
import { ScheduledCareApiService } from '../scheduled-care/scheduled-care-api.service';
import { ScheduledCareFacade } from '../scheduled-care/scheduled-care.facade';
import { RequestsPage } from './requests-page';

describe('RequestsPage authority', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('loads the bounded real request projection without prototype authority', () => {
    const scheduledCareApi = {
      getDoctorScheduledCare: vi.fn(() => of({
        generatedAt: '2026-10-08T10:00:00Z',
        from: '2026-10-07T10:00:00Z',
        to: '2026-12-07T10:00:00Z',
        items: [],
      })),
    };
    const urgentApi = { incoming: vi.fn(() => of([])) };
    const realtime = {
      urgentEvents$: new Subject<void>(),
    };
    TestBed.configureTestingModule({
      providers: [
        RequestsPage,
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: ScheduledCareApiService, useValue: scheduledCareApi },
        {
          provide: ScheduledCareFacade,
          useValue: { projectionInvalidationEpoch: signal(0) },
        },
        { provide: DoctorUrgentApiService, useValue: urgentApi },
        {
          provide: UrgentAcceptedStore,
          useValue: { add: vi.fn(), remove: vi.fn(), offers: vi.fn(() => []) },
        },
        { provide: RealtimeService, useValue: realtime },
      ],
    });

    const page = TestBed.inject(RequestsPage);
    expect(scheduledCareApi.getDoctorScheduledCare).toHaveBeenCalledOnce();
    expect(page.appointmentRequests()).toEqual([]);
  });
});
