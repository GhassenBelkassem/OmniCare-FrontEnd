import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import { AppointmentApiService } from '../appointment-api.service';
import { ActiveConsultationStore } from '../active-consultation.store';
import { ScheduledCareFacade } from '../scheduled-care/scheduled-care.facade';
import type {
  DoctorHomeSummary,
  DoctorScheduledCareItem,
} from '../scheduled-care/scheduled-care.models';
import { CommandCenterPage } from './command-center-page';
import { UrgentCabinetClinicalStore } from '../urgent-cabinet-clinical.store';

function item(
  resourceType: 'BOOKING_REQUEST' | 'APPOINTMENT',
  id: string,
): DoctorScheduledCareItem {
  return {
    resourceType,
    requestId: resourceType === 'BOOKING_REQUEST' ? id : null,
    appointmentId: resourceType === 'APPOINTMENT' ? id : null,
    sourceBookingRequestId: resourceType === 'APPOINTMENT' ? 'request-source' : null,
    version: 1,
    status: resourceType === 'BOOKING_REQUEST' ? 'PENDING_DOCTOR' : 'CONFIRMED',
    doctor: { displayName: 'Dr Test', specialty: null },
    subject: { subjectType: 'SELF', displayName: 'Patient Test', relationship: 'Patient' },
    cabinet: {
      name: 'Cabinet Tunis',
      address: '',
      city: 'Tunis',
      governorate: 'Tunis',
      timezone: 'Africa/Tunis',
    },
    start: '2026-10-12T08:00:00Z',
    end: '2026-10-12T08:30:00Z',
    timezone: 'Africa/Tunis',
    responseDeadline: resourceType === 'BOOKING_REQUEST' ? '2026-10-09T08:00:00Z' : null,
    cancellation: null,
    intakeStatus: null,
    availableActions:
      resourceType === 'BOOKING_REQUEST' ? ['ACCEPT_REQUEST'] : ['CANCEL_APPOINTMENT'],
    sortAt: '2026-10-12T08:00:00Z',
    updatedAt: '2026-10-08T08:00:00Z',
  };
}

describe('CommandCenterPage scheduled-care authority', () => {
  it('binds count, next request, and next appointment from the backend summary facade', () => {
    const summary: DoctorHomeSummary = {
      generatedAt: '2026-10-08T08:00:00Z',
      pendingRequestCount: 7,
      nextPendingRequest: item('BOOKING_REQUEST', 'request-1'),
      nextConfirmedAppointment: item('APPOINTMENT', 'appointment-9'),
    };
    const care = {
      home: signal<DoctorHomeSummary | null>(summary),
      homeLoading: signal(false),
      homeError: signal<string | null>(null),
      loadHome: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        CommandCenterPage,
        { provide: Router, useValue: { navigate: vi.fn() } },
        {
          provide: AppointmentApiService,
          useValue: {
            todayStats: vi.fn(() => of({ consultations: 0, upcoming: 0, finished: 0 })),
            listAppointments: vi.fn(() => of([])),
            listRules: vi.fn(() => of([])),
          },
        },
        { provide: ScheduledCareFacade, useValue: care },
        { provide: ActiveConsultationStore, useValue: { refresh: vi.fn() } },
        {
          provide: UrgentCabinetClinicalStore,
          useValue: {
            refresh: vi.fn(),
            actionable: signal(null),
            waiting: signal(null),
          },
        },
      ],
    });

    const page = TestBed.inject(CommandCenterPage);
    expect(care.loadHome).toHaveBeenCalledOnce();
    expect(page.stats().find((stat) => stat.label === 'Demandes planifiées')?.value).toBe(7);
    expect(page.pendingScheduledRequest()?.requestId).toBe('request-1');
    expect(page.nextScheduledAppointment()?.appointmentId).toBe('appointment-9');
    expect(page.pendingScheduledRequest()?.requestId).not.toBe(
      page.nextScheduledAppointment()?.appointmentId,
    );
  });

  it('starts the dashboard Appointment through the shared command and routes canonically', async () => {
    const navigate = vi.fn();
    const consultation = {
      consultationId: '11111111-1111-4111-8111-111111111111',
      sourceType: 'SCHEDULED_APPOINTMENT',
      sourceId: 'appointment-9',
      status: 'IN_PROGRESS',
      medicalAccessStatus: 'NONE',
      version: 1,
      startedAt: '2026-10-22T09:00:00Z',
    } as const;
    const refresh = vi.fn().mockResolvedValue(null);
    const startScheduledAppointment = vi.fn().mockResolvedValue({
      kind: 'STARTED',
      consultation,
    });
    TestBed.configureTestingModule({
      providers: [
        CommandCenterPage,
        { provide: Router, useValue: { navigate } },
        {
          provide: AppointmentApiService,
          useValue: {
            todayStats: vi.fn(() => of({ consultations: 0, upcoming: 0, finished: 0 })),
            listAppointments: vi.fn(() => of([])),
            listRules: vi.fn(() => of([])),
          },
        },
        {
          provide: ScheduledCareFacade,
          useValue: {
            home: signal<DoctorHomeSummary | null>(null),
            homeLoading: signal(false),
            homeError: signal<string | null>(null),
            loadHome: vi.fn(),
          },
        },
        {
          provide: ActiveConsultationStore,
          useValue: { refresh, startScheduledAppointment },
        },
        {
          provide: UrgentCabinetClinicalStore,
          useValue: {
            refresh: vi.fn(),
            actionable: signal(null),
            waiting: signal(null),
          },
        },
      ],
    });
    const page = TestBed.inject(CommandCenterPage);

    await page.startScheduledConsultation(item('APPOINTMENT', 'appointment-9'));
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledOnce());

    expect(startScheduledAppointment).toHaveBeenCalledWith('appointment-9', 1);

    expect(navigate).toHaveBeenCalledWith([
      '/doctor',
      'consultation',
      '11111111-1111-4111-8111-111111111111',
    ]);
    expect(navigate).not.toHaveBeenCalledWith(['/doctor', 'consultation', 'appointment-9']);
    expect(navigate).not.toHaveBeenCalledWith(['/doctor', 'consultation', 'new']);
  });
});
