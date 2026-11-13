import { registerLocaleData } from '@angular/common';
import enGb from '@angular/common/locales/en-GB';
import { signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import {
  DatesSetInfo,
  EventClickInfo,
  EventDisplayInfo,
  FullCalendarComponent,
} from '@fullcalendar/angular';
import { Calendar } from 'fullcalendar';
import { en_GB, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { Observable, Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RealtimeHealth, RealtimeService } from '../../../core/realtime/realtime.service';
import { OMNICARE_ICONS } from '../../../app.icons';
import { OcTimeField } from '../../../shared/ui/time-field/oc-time-field';
import type {
  AvailabilityExceptionDto,
  AvailabilityExceptionRequestDto,
  AvailabilityRuleDto,
} from '../appointment-api.models';
import { AppointmentApiService } from '../appointment-api.service';
import { ActiveConsultationStore } from '../active-consultation.store';
import { ScheduledCareApiService } from '../scheduled-care/scheduled-care-api.service';
import { ScheduledCareFacade } from '../scheduled-care/scheduled-care.facade';
import type {
  Appointment,
  DoctorScheduledCareAgenda,
  DoctorScheduledCareItem,
} from '../scheduled-care/scheduled-care.models';
import { CalendarDetailPanel } from './calendar-detail-panel';
import { CalendarPreferencesStore } from './calendar-preferences.store';
import { SensitiveStateRegistry } from '../../../core/auth/sensitive-state.registry';
import { CalendarPage, SLOT_HINT_MS } from './calendar-page';
import { CalendarToolbar } from './calendar-toolbar';
import { CalendarView, shouldReleaseFocus } from './calendar-view';
import type { CalendarViewAction } from './calendar-view.models';
import {
  addDaysToKey,
  tunisDayKey,
  tunisHourMinute,
  tunisToday,
  tunisWeekRange,
  weekdayOfDayKey,
} from './calendar-time';
import { at } from './calendar-time.testing';

registerLocaleData(enGb);

const RANGE_A = {
  start: '2031-04-01T00:00:00.000Z',
  end: '2031-05-01T00:00:00.000Z',
};
const RANGE_B = {
  start: '2031-05-01T00:00:00.000Z',
  end: '2031-06-01T00:00:00.000Z',
};

interface AppointmentApiStub {
  readonly listRules: ReturnType<typeof vi.fn<() => Observable<readonly AvailabilityRuleDto[]>>>;
  readonly listExceptions: ReturnType<
    typeof vi.fn<(from: string, to: string) => Observable<readonly AvailabilityExceptionDto[]>>
  >;
  readonly addException: ReturnType<
    typeof vi.fn<(input: AvailabilityExceptionRequestDto) => Observable<AvailabilityExceptionDto>>
  >;
  readonly deleteException: ReturnType<typeof vi.fn<(id: string) => Observable<void>>>;
}

function appointment(
  id: string,
  status: DoctorScheduledCareItem['status'] = 'CONFIRMED',
  overrides: Partial<DoctorScheduledCareItem> = {},
): DoctorScheduledCareItem {
  return {
    resourceType: 'APPOINTMENT',
    requestId: null,
    appointmentId: id,
    sourceBookingRequestId: `request-${id}`,
    version: 1,
    status,
    doctor: { displayName: 'Dr Test', specialty: 'Médecine générale' },
    subject: { subjectType: 'SELF', displayName: 'Ahmed Ben Ali', relationship: 'Patient' },
    cabinet: {
      name: 'Cabinet Tunis',
      address: '1 rue Test',
      city: 'Tunis',
      governorate: 'Tunis',
      timezone: 'Africa/Tunis',
    },
    start: '2031-04-08T08:17:00.000Z',
    end: '2031-04-08T09:02:00.000Z',
    timezone: 'Africa/Tunis',
    responseDeadline: null,
    cancellation: null,
    intakeStatus: null,
    availableActions: ['CANCEL_APPOINTMENT'],
    sortAt: '2031-04-08T08:17:00.000Z',
    updatedAt: '2031-04-01T08:00:00.000Z',
    ...overrides,
  };
}

function agenda(items: readonly DoctorScheduledCareItem[]): DoctorScheduledCareAgenda {
  return {
    generatedAt: '2031-04-01T08:00:00.000Z',
    from: RANGE_A.start,
    to: RANGE_A.end,
    items,
  };
}

function appointmentDetail(
  id: string,
  status: Appointment['status'] = 'CONFIRMED',
  version = 1,
): Appointment {
  return {
    appointmentId: id,
    sourceBookingRequestId: `request-${id}`,
    version,
    status,
    doctor: {
      doctorId: 'doctor-1',
      displayName: 'Dr Test',
      specialty: 'Médecine générale',
    },
    subject: {
      subjectType: 'SELF',
      familyMemberId: null,
      displayName: 'Ahmed Ben Ali',
      relationship: 'Patient',
    },
    cabinet: {
      practiceLocationId: 'cabinet-1',
      name: 'Cabinet Tunis',
      address: '1 rue Test',
      city: 'Tunis',
      governorate: 'Tunis',
      timezone: 'Africa/Tunis',
    },
    slot: {
      start: '2031-04-08T08:17:00.000Z',
      end: '2031-04-08T09:02:00.000Z',
      durationMinutes: 45,
      timezone: 'Africa/Tunis',
    },
    quotedPrice: null,
    confirmedAt: '2031-04-01T08:00:00.000Z',
    createdAt: '2031-04-01T08:00:00.000Z',
    updatedAt: '2031-04-01T08:00:00.000Z',
    cancellation: null,
    intakeStatus: null,
    availableActions: ['CANCEL_APPOINTMENT'],
    practicePatient: null,
    consultationReason: null,
  };
}

function exception(id: string, type: 'BLOCK' | 'EXTRA' = 'BLOCK'): AvailabilityExceptionDto {
  return {
    id,
    exceptionDate: '2031-04-08',
    type,
    startTime: '14:00',
    endTime: '16:00',
    reason: 'Formation',
  };
}

describe('CalendarPage', () => {
  let fixture: ComponentFixture<CalendarPage>;
  let component: CalendarPage;
  let api: AppointmentApiStub;
  let realtimeHealth: WritableSignal<RealtimeHealth>;
  let calendarApi: Pick<Calendar, 'changeView' | 'gotoDate' | 'next' | 'prev' | 'today'>;
  let detailPanel: CalendarDetailPanel;
  let scheduledApi: {
    readonly getDoctorScheduledCare: ReturnType<
      typeof vi.fn<(from: string, to: string) => Observable<DoctorScheduledCareAgenda>>
    >;
  };
  let projectionInvalidationEpoch: WritableSignal<number>;
  let activeAppointment: WritableSignal<Appointment | null>;
  let activeConsultation: WritableSignal<{
    consultationId: string;
    sourceType: 'SCHEDULED_APPOINTMENT';
    sourceId: string;
    status: 'IN_PROGRESS';
    medicalAccessStatus: 'NONE';
    version: number;
    startedAt: string;
  } | null>;
  let startScheduledAppointment: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    realtimeHealth = signal<RealtimeHealth>('live');
    projectionInvalidationEpoch = signal(0);
    activeAppointment = signal<Appointment | null>(null);
    activeConsultation = signal(null);
    startScheduledAppointment = vi.fn();
    navigate = vi.fn();
    scheduledApi = { getDoctorScheduledCare: vi.fn(() => of(agenda([]))) };
    api = {
      listRules: vi.fn(() => of([])),
      listExceptions: vi.fn(() => of([])),
      addException: vi.fn((input) => of({ id: 'created-exception', ...input })),
      deleteException: vi.fn(() => of(undefined)),
    };

    await TestBed.configureTestingModule({
      imports: [CalendarPage],
      providers: [
        provideNzI18n(en_GB),
        provideNzIcons(OMNICARE_ICONS),
        { provide: Router, useValue: { navigate } },
        { provide: AppointmentApiService, useValue: api },
        { provide: ScheduledCareApiService, useValue: scheduledApi },
        {
          provide: ScheduledCareFacade,
          useValue: {
            projectionInvalidationEpoch,
            commandLoading: signal(false),
            appointmentLoading: signal(false),
            appointmentError: signal(null),
            activeAppointment,
            commandError: signal(null),
            openAppointment: vi.fn(),
            closeAppointment: vi.fn(),
            cancelAppointment: vi.fn(),
            openRequest: vi.fn(),
            closeRequest: vi.fn(),
            acceptRequest: vi.fn(),
            declineRequest: vi.fn(),
            proposeTime: vi.fn(),
            loadProposalAvailability: vi.fn(),
            activeRequest: signal(null),
            requestLoading: signal(false),
            requestError: signal(null),
            availability: signal([]),
            availabilityTimezone: signal('Africa/Tunis'),
            availabilityLoading: signal(false),
            availabilityError: signal(null),
          },
        },
        {
          provide: ActiveConsultationStore,
          useValue: {
            active: activeConsultation,
            loading: signal(false),
            error: signal(null),
            starting: signal(false),
            startError: signal(null),
            clearStartError: vi.fn(),
            startScheduledAppointment,
          },
        },
        {
          provide: RealtimeService,
          useValue: {
            health: vi.fn(() => realtimeHealth),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CalendarPage);
    component = fixture.componentInstance;
    fixture.detectChanges();

    calendarApi = {
      changeView: vi.fn(),
      gotoDate: vi.fn(),
      next: vi.fn(),
      prev: vi.fn(),
      today: vi.fn(),
    };

    const fullCalendar = fixture.debugElement.query(By.directive(FullCalendarComponent))
      .componentInstance as FullCalendarComponent;
    vi.spyOn(fullCalendar, 'getApi').mockReturnValue(calendarApi as unknown as Calendar);
    detailPanel = fixture.debugElement.query(By.directive(CalendarDetailPanel))
      .componentInstance as CalendarDetailPanel;

    scheduledApi.getDoctorScheduledCare.mockClear();
    api.listExceptions.mockClear();
  });

  afterEach(() => {
    fixture.destroy();
    TestBed.resetTestingModule();
  });

  function showRange(
    range: typeof RANGE_A | typeof RANGE_B,
    viewType = 'dayGridMonth',
    title = 'avril 2031',
  ): void {
    component.onDatesSet({
      start: new Date(range.start),
      end: new Date(range.end),
      startStr: range.start,
      endStr: range.end,
      timeZone: 'local',
      view: { type: viewType, title },
    } as DatesSetInfo);
  }

  it('renders the production Calendar with the official FullCalendar component', () => {
    const host = fixture.nativeElement as HTMLElement;

    expect(component).toBeTruthy();
    expect(fixture.debugElement.query(By.directive(FullCalendarComponent))).toBeTruthy();
    expect(host.querySelector('.doctor-calendar-demo')).toBeTruthy();
    expect(host.querySelector('.doctor-calendar-demo__calendar-host > full-calendar')).toBeTruthy();
  });

  it('renders day headers through the template (today pill) with one stable class hook', () => {
    const options = component.calendarOptions();
    const dayHeaderClass = options.dayHeaderClass;

    // The date pill comes from the #dayHeaderContent template, not from an option.
    expect(options.dayHeaderContent).toBeUndefined();
    expect(options.dayHeaderFormat).toEqual({ weekday: 'short', day: 'numeric' });
    expect(typeof dayHeaderClass).toBe('function');
    expect(
      typeof dayHeaderClass === 'function'
        ? dayHeaderClass({ isToday: true } as never)
        : dayHeaderClass,
    ).toBe('demo-calendar-day-header demo-calendar-day-header--today');
  });

  it('removes the unused all-day lane and derives the initial scroll from schedule bounds', () => {
    const options = component.calendarOptions();

    expect(options.allDaySlot).toBe(false);
    expect(options.allDayHeaderContent).toBeUndefined();
    expect(options.scrollTime).toBe('08:00:00');
    expect(options.scrollTimeReset).toBe(false);
  });

  it('renders the approved production toolbar hierarchy and labels', () => {
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Jour');
    expect(text).toContain('Semaine');
    expect(text).toContain('Mois');
    expect(text).toContain('Modifier les horaires');
    expect(text).toContain('Exception');
    expect(text).toContain("Aujourd'hui");
    expect(text).not.toContain('Modifier emploi du temps');
  });

  it('shows the realtime warning only while the live connection is down', () => {
    const warning = 'Mise à jour en temps réel indisponible — actualisation automatique';
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain(warning);
    expect(fixture.nativeElement.textContent).not.toContain('Synchronisation différée');

    // A quiet but connected socket is not degraded.
    realtimeHealth.set('stale');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain(warning);

    realtimeHealth.set('down');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(warning);
  });

  it('starts in week view (Monday first) with editing disabled', () => {
    expect(component.viewMode()).toBe('week');
    expect(component.calendarOptions().initialView).toBe('timeGridWeek');
    expect(component.calendarOptions().firstDay).toBe(1);
    expect(component.calendarOptions().editable).toBe(false);
    expect(component.calendarOptions().selectable).toBe(false);
    expect(component.calendarOptions().eventStartEditable).toBe(false);
    expect(component.calendarOptions().eventDurationEditable).toBe(false);
  });

  it('adds the native day-cell unavailable class only for a fully blocked working date', () => {
    component.rules.set([
      {
        dayOfWeek: 'FRIDAY',
        active: true,
        startTime: '09:00',
        endTime: '15:00',
        pauseStart: null,
        pauseEnd: null,
        slotDurationMinutes: 20,
      },
    ]);
    component.exceptions.set([
      {
        id: 'full-friday',
        exceptionDate: '2026-10-09',
        type: 'BLOCK',
        startTime: '09:00',
        endTime: '15:00',
        reason: null,
      },
      {
        id: 'partial-friday',
        exceptionDate: '2026-10-16',
        type: 'BLOCK',
        startTime: '12:00',
        endTime: '13:00',
        reason: null,
      },
    ]);

    const classHook = component.calendarOptions().dayCellClass as (info: {
      date: Date;
      isToday: boolean;
      isOther: boolean;
    }) => string;
    expect(classHook({ date: at('2026-10-09'), isToday: false, isOther: false })).toContain(
      'demo-calendar-day-cell--exception',
    );
    expect(
      classHook({ date: at('2026-10-16'), isToday: false, isOther: false }),
    ).not.toContain('demo-calendar-day-cell--exception');
  });

  it.each([
    ['day', 'timeGridDay'],
    ['week', 'timeGridWeek'],
    ['month', 'dayGridMonth'],
  ] as const)('delegates the %s view to FullCalendar', (viewMode, calendarView) => {
    component.setViewMode(viewMode);
    expect(calendarApi.changeView).toHaveBeenCalledWith(calendarView);
  });

  it('delegates previous, today, and next navigation', () => {
    component.previous();
    component.goToday();
    component.next();
    expect(calendarApi.prev).toHaveBeenCalledOnce();
    expect(calendarApi.today).toHaveBeenCalledOnce();
    expect(calendarApi.next).toHaveBeenCalledOnce();
  });

  it('loads real appointments for the exact exclusive visible range', () => {
    const loaded = appointment('range-result');
    scheduledApi.getDoctorScheduledCare.mockReturnValueOnce(of(agenda([loaded])));

    showRange(RANGE_A);

    expect(scheduledApi.getDoctorScheduledCare).toHaveBeenCalledWith(RANGE_A.start, RANGE_A.end);
    expect(component.appointments()).toEqual([loaded]);
    expect(component.calendarEvents()[0]?.id).toBe('appointment:range-result');
  });

  it('draws pending booking requests on the grid next to the appointments', () => {
    const request: DoctorScheduledCareItem = {
      ...appointment('appointment-must-not-be-used'),
      resourceType: 'BOOKING_REQUEST',
      requestId: 'request-1',
      appointmentId: null,
      sourceBookingRequestId: null,
      status: 'PENDING_DOCTOR',
      availableActions: ['ACCEPT_REQUEST'],
    };
    scheduledApi.getDoctorScheduledCare.mockReturnValueOnce(of(agenda([request])));

    showRange(RANGE_A);

    // Requests are kept apart from the appointments, and drawn as their own events.
    expect(component.appointments()).toEqual([]);
    expect(component.requests()).toEqual([request]);
    expect(component.calendarEvents()).toEqual([
      expect.objectContaining({
        id: 'request:request-1',
        extendedProps: expect.objectContaining({ kind: 'request', stateLabel: 'Demande' }),
      }),
    ]);
  });

  it('updates the French title and view from datesSet', () => {
    component.onDatesSet({
      start: at('2031-04-07'),
      end: at('2031-04-14'),
      startStr: '',
      endStr: '',
      timeZone: 'local',
      view: { type: 'timeGridWeek', title: 'ignored' },
    } as never);
    expect(component.visibleTitle()).toBe('7 – 13 avr. 2031');
    expect(component.viewMode()).toBe('week');
  });

  it('pads the time grid by one hour and uses the consultation slot length', () => {
    component.rules.set([
      {
        dayOfWeek: 'MONDAY', active: true, startTime: '09:00', endTime: '17:00',
        pauseStart: null, pauseEnd: null, slotDurationMinutes: 20,
      },
    ]);
    const options = component.calendarOptions();
    expect(options.slotMinTime).toBe('08:00:00');
    expect(options.slotMaxTime).toBe('18:00:00');
    expect(options.slotDuration).toBe('00:20:00');
    expect(options.nowIndicator).toBe(true);
    expect(options.editable).toBe(false);
  });

  it('opens the booking drawer on an empty working slot and ignores past or closed slots', () => {
    // One week from today, 10:00 in Tunis (the machine's own zone is irrelevant).
    const futureKey = addDaysToKey(tunisToday(), 7);
    const future = at(futureKey, '10:00');
    const weekday = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][
      weekdayOfDayKey(futureKey) ?? 0
    ] as AvailabilityRuleDto['dayOfWeek'];
    component.rules.set([
      {
        dayOfWeek: weekday, active: true, startTime: '09:00', endTime: '17:00',
        pauseStart: null, pauseEnd: null, slotDurationMinutes: 20,
      },
    ]);
    const click = (date: Date) =>
      component.onDateClick({ date, allDay: false, view: { type: 'timeGridWeek' } } as never);

    click(new Date(Date.now() - 3_600_000));
    expect(component.quickBookingOpen()).toBe(false);
    expect(component.slotHint()).toBe('Ce créneau est déjà passé.');

    click(at(futureKey, '20:00'));
    expect(component.quickBookingOpen()).toBe(false);
    expect(component.slotHint()).toContain('en dehors de vos horaires');

    click(future);
    expect(component.quickBookingOpen()).toBe(true);
    expect(component.quickBookingStart()).toBe(future.toISOString());
  });

  it('keeps the calendar grid rendered for an empty result', () => {
    scheduledApi.getDoctorScheduledCare.mockReturnValueOnce(of(agenda([])));
    showRange(RANGE_A);
    fixture.detectChanges();

    expect(component.calendarEvents()).toEqual([]);
    expect(fixture.debugElement.query(By.directive(FullCalendarComponent))).toBeTruthy();
  });

  it('settles loading after the current range resolves', () => {
    const response = new Subject<DoctorScheduledCareAgenda>();
    scheduledApi.getDoctorScheduledCare.mockReturnValueOnce(response);

    showRange(RANGE_A);
    expect(component.loading()).toBe(true);
    response.next(agenda([]));
    response.complete();
    expect(component.loading()).toBe(false);
    expect(component.loadError()).toBeNull();
  });

  it('shows a retryable error and reloads the current range', () => {
    scheduledApi.getDoctorScheduledCare
      .mockReturnValueOnce(throwError(() => new Error('offline')))
      .mockReturnValueOnce(of(agenda([appointment('retry')])));

    showRange(RANGE_A);
    expect(component.loadError()).toBe('Impossible de charger les rendez-vous.');

    component.retryLoad();
    expect(scheduledApi.getDoctorScheduledCare).toHaveBeenCalledTimes(2);
    expect(component.appointments().map((candidate) => candidate.appointmentId)).toEqual(['retry']);
    expect(component.loadError()).toBeNull();
  });

  it('prevents a stale range response from overwriting rapid navigation', () => {
    const responseA = new Subject<DoctorScheduledCareAgenda>();
    const responseB = new Subject<DoctorScheduledCareAgenda>();
    scheduledApi.getDoctorScheduledCare
      .mockReturnValueOnce(responseA)
      .mockReturnValueOnce(responseB);

    showRange(RANGE_A);
    showRange(RANGE_B);
    responseB.next(
      agenda([
        appointment('range-b', 'CONFIRMED', {
          start: '2031-05-08T08:00:00.000Z',
          end: '2031-05-08T08:30:00.000Z',
        }),
      ]),
    );
    responseA.next(agenda([appointment('range-a')]));

    expect(component.appointments().map((candidate) => candidate.appointmentId)).toEqual([
      'range-b',
    ]);
  });

  it('deduplicates repeated datesSet callbacks for the same range', () => {
    showRange(RANGE_A);
    showRange(RANGE_A);
    expect(scheduledApi.getDoctorScheduledCare).toHaveBeenCalledOnce();
  });

  it('opens the scheduled appointment detail with the appointment identity', () => {
    const openWith = vi.spyOn(detailPanel, 'openWith');

    component.onEventClick({
      event: { extendedProps: { kind: 'appointment', appointmentId: 'open-me' } },
    } as unknown as EventClickInfo);

    expect(openWith).toHaveBeenCalledWith('open-me');
  });

  it('starts from Calendar detail through the shared canonical command and UUID route', async () => {
    activeAppointment.set(appointmentDetail('appointment-9', 'CONFIRMED', 7));
    startScheduledAppointment.mockResolvedValue({
      kind: 'STARTED',
      consultation: {
        consultationId: '11111111-1111-4111-8111-111111111111',
        sourceType: 'SCHEDULED_APPOINTMENT',
        sourceId: 'appointment-9',
        status: 'IN_PROGRESS',
        medicalAccessStatus: 'NONE',
        version: 0,
        startedAt: '2031-04-08T08:17:00.000Z',
      },
    });

    await detailPanel.startConsultation();

    expect(startScheduledAppointment).toHaveBeenCalledWith('appointment-9', 7);
    expect(navigate).toHaveBeenCalledWith([
      '/doctor',
      'consultation',
      '11111111-1111-4111-8111-111111111111',
    ]);
    expect(navigate).not.toHaveBeenCalledWith(['/doctor', 'consultation', 'new']);
  });

  it('does not present another active Consultation as belonging to the selected appointment', () => {
    activeAppointment.set(appointmentDetail('appointment-9'));
    activeConsultation.set({
      consultationId: '11111111-1111-4111-8111-111111111111',
      sourceType: 'SCHEDULED_APPOINTMENT',
      sourceId: 'appointment-other',
      status: 'IN_PROGRESS',
      medicalAccessStatus: 'NONE',
      version: 0,
      startedAt: '2031-04-08T08:17:00.000Z',
    });

    detailPanel.openWith('appointment-9');
    fixture.detectChanges();

    const text = document.body.textContent ?? '';
    expect(text).toContain('Une autre consultation est déjà en cours');
    expect(text).toContain('Ce rendez-vous n’a pas été démarré');
    expect(text).not.toContain('Ouvrir l’autre consultation');
    expect(text).not.toContain('Continuer ce rendez-vous');
  });

  it('offers to continue only when the active Consultation belongs to the selected appointment', () => {
    activeAppointment.set(appointmentDetail('appointment-9', 'IN_PROGRESS'));
    activeConsultation.set({
      consultationId: '11111111-1111-4111-8111-111111111111',
      sourceType: 'SCHEDULED_APPOINTMENT',
      sourceId: 'appointment-9',
      status: 'IN_PROGRESS',
      medicalAccessStatus: 'NONE',
      version: 0,
      startedAt: '2031-04-08T08:17:00.000Z',
    });

    detailPanel.openWith('appointment-9');
    fixture.detectChanges();

    const text = document.body.textContent ?? '';
    expect(text).toContain('Continuer ce rendez-vous');
    expect(text).not.toContain('Ouvrir l’autre consultation');
  });

  it('fails safely for non-appointment and missing event IDs', () => {
    const openWith = vi.spyOn(detailPanel, 'openWith');

    component.onEventClick({
      event: { extendedProps: { kind: 'pending-request', appointmentId: 'unknown' } },
    } as unknown as EventClickInfo);
    expect(openWith).not.toHaveBeenCalled();
  });

  it('updates completed appointment presentation declaratively from the agenda', () => {
    component.appointments.set([appointment('completed', 'COMPLETED')]);

    expect(component.calendarEvents()[0]).toMatchObject({
      className: expect.stringContaining('omnicare-appointment-event--completed'),
      extendedProps: { statusLabel: 'Terminé' },
    });
  });

  it('does not expose FullCalendar drag, resize, or reschedule mutations', () => {
    expect(component.calendarOptions().editable).toBe(false);
    expect(component.calendarOptions().eventStartEditable).toBe(false);
    expect(component.calendarOptions().eventDurationEditable).toBe(false);
  });

  it('provides compact and accessible event content helpers', () => {
    const info = {
      event: {
        start: new Date('2031-04-08T08:17:00.000Z'),
        end: new Date('2031-04-08T09:02:00.000Z'),
        extendedProps: {
          kind: 'appointment',
          appointmentId: 'content',
          status: 'CONFIRMED',
          patientLabel: 'Ahmed Ben Ali',
          statusLabel: 'Confirmé',
        },
      },
    } as unknown as EventDisplayInfo;

    expect(component.compactPatientLabel(info)).toBe('Ahmed A.');
    expect(component.eventTimeRange(info)).toContain('–');
    expect(component.eventAccessibleLabel(info)).toContain('Ahmed Ben Ali');
    expect(component.eventAccessibleLabel(info)).toContain('Confirmé');
  });

  it('provides stable visual hook classes for each production event kind', () => {
    const classesFor = (extendedProps: Record<string, unknown>) =>
      component.calendarEventClasses({
        event: { extendedProps },
      } as unknown as EventDisplayInfo);

    expect(classesFor({ kind: 'appointment', status: 'CONFIRMED' })).toContain(
      'demo-calendar-appointment',
    );
    expect(classesFor({ kind: 'exception-annotation', exceptionType: 'BLOCK' })).toContain(
      'demo-calendar-state--unavailable',
    );
    expect(classesFor({ kind: 'exception-annotation', exceptionType: 'EXTRA' })).toContain(
      'demo-calendar-state--exception',
    );
  });

  it('refetches the current bounded range after scheduled-care invalidation', () => {
    showRange(RANGE_A);
    scheduledApi.getDoctorScheduledCare.mockClear();
    scheduledApi.getDoctorScheduledCare.mockReturnValueOnce(of(agenda([appointment('live')])));

    projectionInvalidationEpoch.update((value) => value + 1);
    TestBed.flushEffects();

    expect(scheduledApi.getDoctorScheduledCare).toHaveBeenCalledWith(RANGE_A.start, RANGE_A.end);
    expect(component.appointments()[0]?.appointmentId).toBe('live');
  });

  it('refreshes only the current range while realtime is degraded', () => {
    showRange(RANGE_A);
    scheduledApi.getDoctorScheduledCare.mockClear();
    realtimeHealth.set('down');

    component.refreshIfRealtimeDegraded();

    expect(scheduledApi.getDoctorScheduledCare).toHaveBeenCalledOnce();
    expect(scheduledApi.getDoctorScheduledCare).toHaveBeenCalledWith(RANGE_A.start, RANGE_A.end);
  });

  it('does not poll while realtime is healthy', () => {
    showRange(RANGE_A);
    scheduledApi.getDoctorScheduledCare.mockClear();

    component.refreshIfRealtimeDegraded();

    expect(scheduledApi.getDoctorScheduledCare).not.toHaveBeenCalled();
  });

  it('loads exceptions with the visible date range', () => {
    showRange(RANGE_A, 'timeGridWeek');

    expect(api.listExceptions).toHaveBeenCalledOnce();
    // The week view loads the whole Tunis week that contains 1 April 2031: Monday 31 March → Sunday 6 April.
    expect(api.listExceptions).toHaveBeenCalledWith('2031-03-31', '2031-04-06');
  });

  it('ignores a stale exception response after navigation', () => {
    const responseA = new Subject<readonly AvailabilityExceptionDto[]>();
    const responseB = new Subject<readonly AvailabilityExceptionDto[]>();
    api.listExceptions.mockReturnValueOnce(responseA).mockReturnValueOnce(responseB);

    showRange(RANGE_A);
    showRange(RANGE_B);
    responseB.next([exception('range-b')]);
    responseA.next([exception('range-a')]);

    expect(component.exceptions().map((candidate) => candidate.id)).toEqual(['range-b']);
  });

  it('loads weekly rules only once across visible range changes', () => {
    const callsAfterInitialRender = api.listRules.mock.calls.length;
    showRange(RANGE_A);
    showRange(RANGE_B);
    expect(api.listRules).toHaveBeenCalledTimes(callsAfterInitialRender);
  });

  it('keeps the calendar visible and offers schedule setup for empty rules', () => {
    component.rules.set([]);
    component.rulesLoaded.set(true);
    fixture.detectChanges();

    expect(component.noSchedule()).toBe(true);
    expect(fixture.debugElement.query(By.directive(FullCalendarComponent))).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Aucun horaire habituel configuré.');
  });

  it('does not misrepresent a rules transport failure as an empty schedule', () => {
    api.listRules.mockReturnValueOnce(throwError(() => new Error('offline')));
    component.retryRules();

    expect(component.rulesError()).toBe('Impossible de charger les horaires habituels.');
    expect(component.noSchedule()).toBe(false);
  });

  it('keeps appointments projected when exception loading fails', () => {
    scheduledApi.getDoctorScheduledCare.mockReturnValueOnce(
      of(agenda([appointment('still-visible')])),
    );
    api.listExceptions.mockReturnValueOnce(throwError(() => new Error('offline')));

    showRange(RANGE_A);

    expect(component.appointmentEvents()[0]?.id).toBe('appointment:still-visible');
    expect(component.exceptionsError()).toBe('Impossible de charger les exceptions.');
  });

  it('opens exception detail when an annotation is clicked', () => {
    component.exceptions.set([exception('open-exception')]);

    component.onEventClick({
      event: {
        extendedProps: { kind: 'exception-annotation', exceptionId: 'open-exception' },
      },
    } as unknown as EventClickInfo);

    expect(component.selectedException()?.id).toBe('open-exception');
  });

  it('deletes an exception from authoritative Angular state and projection', () => {
    component.viewMode.set('week');
    component.exceptions.set([exception('delete-exception')]);
    component.selectedException.set(exception('delete-exception'));

    component.confirmDeleteException();

    expect(api.deleteException).toHaveBeenCalledWith('delete-exception');
    expect(component.exceptions()).toEqual([]);
    expect(component.exceptionEvents()).toEqual([]);
  });

  it('creates an exception and recomputes its projection', () => {
    component.viewMode.set('week');
    component.openExceptionForm();
    component.exceptionForm.patchValue({
      date: '2031-04-08',
      scope: 'TIME_WINDOW',
      startTime: '14:00',
      endTime: '16:00',
      reason: 'Formation',
    });

    component.saveException();

    expect(api.addException).toHaveBeenCalledWith({
      exceptionDate: '2031-04-08',
      type: 'BLOCK',
      startTime: '14:00',
      endTime: '16:00',
      reason: 'Formation',
    });
    expect(component.exceptionEvents()).toHaveLength(2);
  });

  it('creates a full-working-day block from the selected weekday rule', () => {
    component.rules.set([
      {
        dayOfWeek: 'FRIDAY',
        active: true,
        startTime: '09:00:00',
        endTime: '15:00:00',
        pauseStart: '13:00:00',
        pauseEnd: '13:30:00',
        slotDurationMinutes: 30,
      },
    ]);
    component.openExceptionForm();
    component.exceptionForm.patchValue({ date: '2026-10-09', reason: 'Absent' });

    component.saveException();

    expect(api.addException).toHaveBeenCalledWith({
      exceptionDate: '2026-10-09',
      type: 'BLOCK',
      startTime: '09:00',
      endTime: '15:00',
      reason: 'Absent',
    });
  });

  it('uses shared 24-hour fields only for partial Calendar exceptions', () => {
    component.openExceptionForm();
    fixture.detectChanges();

    expect(fixture.debugElement.queryAll(By.directive(OcTimeField))).toHaveLength(0);
    component.exceptionForm.controls.scope.setValue('TIME_WINDOW');
    fixture.detectChanges();

    expect(fixture.debugElement.queryAll(By.directive(OcTimeField))).toHaveLength(2);
    expect(component.exceptionForm.controls.startTime.value).toMatch(/^\d{2}:\d{2}$/);
    expect(component.exceptionForm.controls.endTime.value).toMatch(/^\d{2}:\d{2}$/);
  });

  it('does not issue a second Calendar exception POST while the first is pending', () => {
    const pending = new Subject<AvailabilityExceptionDto>();
    api.addException.mockReturnValue(pending);
    component.rules.set([
      {
        dayOfWeek: 'FRIDAY',
        active: true,
        startTime: '09:00',
        endTime: '15:00',
        pauseStart: null,
        pauseEnd: null,
        slotDurationMinutes: 30,
      },
    ]);
    component.openExceptionForm();
    component.exceptionForm.patchValue({ date: '2026-10-09' });

    component.saveException();
    component.saveException();

    expect(api.addException).toHaveBeenCalledOnce();
    expect(component.exceptionSaving()).toBe(true);
  });

  it('keeps month free from exception interval and free-slot events', () => {
    component.viewMode.set('month');
    component.exceptions.set([exception('block'), exception('extra', 'EXTRA')]);

    expect(component.exceptionEvents()).toEqual([]);
    expect(component.calendarEvents()).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ extendedProps: { kind: 'free-slot' } })]),
    );
  });
  describe('CAL-2 week view', () => {
    const weekRule = (
      dayOfWeek: AvailabilityRuleDto['dayOfWeek'],
      overrides: Partial<AvailabilityRuleDto> = {},
    ): AvailabilityRuleDto => ({
      dayOfWeek,
      active: true,
      startTime: '08:00',
      endTime: '17:00',
      pauseStart: '12:30',
      pauseEnd: '14:00',
      slotDurationMinutes: 30,
      ...overrides,
    });
    const workingDays: AvailabilityRuleDto[] = (
      ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as const
    ).map((day) => weekRule(day));

    // Monday 7 – Sunday 13 April 2031, local.
    function showWeek(
      overrides: { start?: Date; end?: Date; currentStart?: Date; currentEnd?: Date } = {},
    ): void {
      component.onDatesSet({
        start: overrides.start ?? at('2031-04-07'),
        end: overrides.end ?? at('2031-04-14'),
        startStr: '',
        endStr: '',
        timeZone: 'local',
        view: {
          type: 'timeGridWeek',
          title: 'ignored',
          currentStart: overrides.currentStart,
          currentEnd: overrides.currentEnd,
        },
      } as never);
    }

    it('produces a break block from each weekly pause for the visible days', () => {
      showWeek();
      component.rules.set([weekRule('MONDAY'), weekRule('TUESDAY', { pauseStart: null, pauseEnd: null })]);

      const breaks = component.breakEvents();

      expect(breaks.map((event) => event.id)).toEqual(['break:2031-04-07']);
      expect(component.calendarEvents()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'break:2031-04-07',
            interactive: false,
            extendedProps: expect.objectContaining({ kind: 'break', timeLabel: '12:30 – 14:00' }),
          }),
        ]),
      );
    });

    it('gives break blocks their own visual hook and no month presence', () => {
      expect(
        component.calendarEventClasses({
          event: { extendedProps: { kind: 'break', title: 'Pause déjeuner', timeLabel: '12:30 – 14:00' } },
        } as unknown as EventDisplayInfo),
      ).toBe('demo-calendar-break');
      expect(component.eventAccessibleLabel({
        event: { extendedProps: { kind: 'break', title: 'Pause déjeuner', timeLabel: '12:30 – 14:00' } },
      } as unknown as EventDisplayInfo)).toBe('Pause déjeuner, 12:30 – 14:00');

      showWeek();
      component.rules.set([weekRule('MONDAY')]);
      component.viewMode.set('month');
      expect(component.breakEvents()).toEqual([]);
    });

    it('hides weekdays without an active rule or a loaded appointment', () => {
      showWeek();
      component.rules.set(workingDays);
      component.rulesLoaded.set(true);

      expect(component.hiddenDays()).toEqual([0, 6]);
      expect(component.calendarOptions().hiddenDays).toEqual([0, 6]);
      expect(component.calendarOptions().firstDay).toBe(1);
    });

    it('shows a closed day that has an appointment in the visible week', () => {
      showWeek();
      component.rules.set(workingDays);
      component.rulesLoaded.set(true);
      component.appointments.set([
        appointment('on-sunday', 'CONFIRMED', {
          start: at('2031-04-13', '10:00').toISOString(),
          end: at('2031-04-13', '10:30').toISOString(),
        }),
      ]);

      expect(component.hiddenDays()).toEqual([6]);
    });

    it('hides nothing before the rules have loaded, after a rules failure, or outside the week view', () => {
      showWeek();
      component.rules.set(workingDays);

      component.rulesLoaded.set(false);
      expect(component.hiddenDays()).toEqual([]);

      component.rulesLoaded.set(true);
      expect(component.hiddenDays()).toEqual([0, 6]);

      component.rulesError.set('Impossible de charger les horaires habituels.');
      expect(component.hiddenDays()).toEqual([]);

      component.rulesError.set(null);
      component.viewMode.set('day');
      expect(component.hiddenDays()).toEqual([]);
      component.viewMode.set('month');
      expect(component.hiddenDays()).toEqual([]);
    });

    it('does not rebuild the options when a recomputation yields the same hidden days', () => {
      showWeek();
      component.rules.set(workingDays);
      component.rulesLoaded.set(true);
      const options = component.calendarOptions();

      // A new appointment on an open day and a repeated datesSet (new range object, same key)
      // recompute hiddenDays to the same weekdays: the options must stay the same object, otherwise
      // FullCalendar re-emits datesSet and the page loops (NG0103).
      component.appointments.set([
        appointment('monday-only', 'CONFIRMED', {
          start: at('2031-04-07', '10:00').toISOString(),
          end: at('2031-04-07', '10:30').toISOString(),
        }),
      ]);
      showWeek();

      expect(component.hiddenDays()).toEqual([0, 6]);
      expect(component.calendarOptions()).toBe(options);
    });

    it('loads the whole week even when FullCalendar trims a hidden edge day from the active range', () => {
      scheduledApi.getDoctorScheduledCare.mockClear();

      showWeek({
        end: at('2031-04-13'), // active range without the hidden Sunday
        currentStart: at('2031-04-07'),
        currentEnd: at('2031-04-14'),
      });

      expect(scheduledApi.getDoctorScheduledCare).toHaveBeenCalledWith(
        at('2031-04-07').toISOString(),
        at('2031-04-14').toISOString(),
      );
      expect(component.visibleTitle()).toBe('7 – 13 avr. 2031');
    });

    it('computes the whole Tunis week itself when the view does not report its current period', () => {
      scheduledApi.getDoctorScheduledCare.mockClear();

      showWeek({ end: at('2031-04-13') });

      expect(scheduledApi.getDoctorScheduledCare).toHaveBeenCalledWith(
        at('2031-04-07').toISOString(),
        at('2031-04-14').toISOString(),
      );
    });
  });

  describe('CAL-2 Rouvrir (closed slot)', () => {
    it('reopens a closed slot through the existing delete-exception flow', () => {
      component.exceptions.set([exception('closed-slot'), exception('other-slot')]);

      component.handleViewAction({ kind: 'REOPEN_EXCEPTION', exceptionId: 'closed-slot' });

      expect(api.deleteException).toHaveBeenCalledExactlyOnceWith('closed-slot');
      expect(component.exceptions().map((item) => item.id)).toEqual(['other-slot']);
      expect(component.deletingException()).toBe(false);
      expect(component.mutationError()).toBeNull();
    });

    it('keeps the closed slot and shows the page error when reopening fails', () => {
      api.deleteException.mockReturnValueOnce(throwError(() => new Error('failed')));
      component.exceptions.set([exception('closed-slot')]);

      component.reopenException('closed-slot');

      expect(component.exceptions().map((item) => item.id)).toEqual(['closed-slot']);
      expect(component.mutationError()).toBe("Erreur lors de la suppression de l'exception.");
      expect(component.deletingException()).toBe(false);
    });

    it('ignores an unknown slot and a second request while one is pending', () => {
      const pending = new Subject<void>();
      api.deleteException.mockReturnValueOnce(pending);
      component.exceptions.set([exception('first'), exception('second')]);

      component.reopenException('missing');
      expect(api.deleteException).not.toHaveBeenCalled();

      component.reopenException('first');
      component.reopenException('second');
      expect(api.deleteException).toHaveBeenCalledExactlyOnceWith('first');

      pending.next();
      pending.complete();
      expect(component.exceptions().map((item) => item.id)).toEqual(['second']);
    });

    it('does not open the detail modal or change the existing modal delete flow', () => {
      component.exceptions.set([exception('closed-slot')]);
      component.reopenException('closed-slot');
      expect(component.selectedException()).toBeNull();

      component.exceptions.set([exception('modal-slot')]);
      component.selectedException.set(exception('modal-slot'));
      component.confirmDeleteException();
      expect(api.deleteException).toHaveBeenLastCalledWith('modal-slot');
      expect(component.selectedException()).toBeNull();
    });

    it('offers « Rouvrir » on closed slots only, and emits the action when confirmed', () => {
      const view = fixture.debugElement.query(By.directive(CalendarView))
        .componentInstance as CalendarView;
      const actions: unknown[] = [];
      view.action.subscribe((action) => actions.push(action));
      const info = (extendedProps: Record<string, unknown>) =>
        ({ event: { extendedProps } }) as unknown as EventDisplayInfo;

      expect(view.canReopen(info({ kind: 'exception-annotation', exceptionType: 'BLOCK' }))).toBe(true);
      expect(view.canReopen(info({ kind: 'exception-annotation', exceptionType: 'EXTRA' }))).toBe(false);
      expect(view.canReopen(info({ kind: 'appointment' }))).toBe(false);
      expect(view.canReopen(info({ kind: 'break' }))).toBe(false);

      view.reopen(info({ kind: 'exception-annotation', exceptionType: 'BLOCK', exceptionId: 'slot-9' }));
      view.reopen(info({ kind: 'exception-annotation', exceptionType: 'BLOCK' }));

      expect(actions).toEqual([{ kind: 'REOPEN_EXCEPTION', exceptionId: 'slot-9' }]);
    });

    it('builds the French card labels from the CAL-1 helpers', () => {
      const view = fixture.debugElement.query(By.directive(CalendarView))
        .componentInstance as CalendarView;
      const info = (
        extendedProps: Record<string, unknown>,
        start = at('2031-04-08', '09:30'),
      ) => ({ event: { start, extendedProps }, view: { type: 'timeGridWeek' } }) as unknown as EventDisplayInfo;
      const meta = {
        kind: 'appointment',
        appointmentId: 'a1',
        patientLabel: 'Test Patient',
        statusLabel: 'Confirmé',
        stateLabel: 'À venir',
      };

      expect(view.appointmentAccessibleLabel(info(meta))).toBe(
        'Rendez-vous à 09:30 avec Test Patient. Statut : À venir.',
      );
      expect(view.appointmentAccessibleLabel(info({ ...meta, unclosed: true }))).toBe(
        'Rendez-vous à 09:30 avec Test Patient. Statut : Consultation non clôturée.',
      );
      expect(
        view.appointmentAccessibleLabel(info({ ...meta, stateLabel: undefined })),
      ).toBe('Rendez-vous à 09:30 avec Test Patient. Statut : Confirmé.');
      expect(
        view.breakLabel(
          info({ kind: 'break', title: 'Pause déjeuner', timeLabel: '12:30 – 14:00' }),
        ),
      ).toBe('Pause déjeuner · 12:30 – 14:00');
      expect(view.breakLabel(info(meta))).toBe('');
    });
  });
  describe('CAL-3 requests and Mode discret on the grid', () => {
    const request = (id: string, overrides: Partial<DoctorScheduledCareItem> = {}): DoctorScheduledCareItem => ({
      ...appointment('unused'),
      resourceType: 'BOOKING_REQUEST',
      requestId: id,
      appointmentId: null,
      sourceBookingRequestId: null,
      status: 'PENDING_DOCTOR',
      availableActions: ['ACCEPT_REQUEST'],
      ...overrides,
    });

    it('opens the request panel when a request card is clicked', () => {
      const request1 = request('request-1');
      component.requests.set([request1]);
      const openRequest = vi.spyOn(detailPanel, 'openRequest');
      const openWith = vi.spyOn(detailPanel, 'openWith');

      component.onEventClick({
        event: { extendedProps: { kind: 'request', requestId: 'request-1' } },
      } as unknown as EventClickInfo);

      expect(openRequest).toHaveBeenCalledWith(request1);
      expect(openWith).not.toHaveBeenCalled();
      expect(component.selectedAppointmentId()).toBe('request-1');
    });

    it('opens an unknown request by its identity only', () => {
      const openRequest = vi.spyOn(detailPanel, 'openRequest');

      component.onEventClick({
        event: { extendedProps: { kind: 'request', requestId: 'from-link' } },
      } as unknown as EventClickInfo);

      expect(openRequest).toHaveBeenCalledWith('from-link');
    });

    it('gives requests the same visual hook as the other cards', () => {
      expect(
        component.calendarEventClasses({
          event: { extendedProps: { kind: 'request', requestId: 'r' } },
        } as unknown as EventDisplayInfo),
      ).toBe('demo-calendar-appointment');
    });

    it('counts the pending requests that cannot be placed and draws only the others', () => {
      component.requests.set([
        request('placed'),
        request('no-end', { end: '' }),
        request('bad-times', { start: 'soon', end: 'later' }),
      ]);

      expect(component.unplacedRequestCount()).toBe(2);
      expect(component.requestEvents().map((event) => event.id)).toEqual(['request:placed']);
    });

    it('keeps a closed weekday visible when it only has a request', () => {
      showWeekFor(component);
      component.rules.set([
        {
          dayOfWeek: 'MONDAY',
          active: true,
          startTime: '08:00',
          endTime: '17:00',
          pauseStart: null,
          pauseEnd: null,
          slotDurationMinutes: 30,
        },
      ]);
      component.rulesLoaded.set(true);
      component.requests.set([
        request('sunday', {
          start: at('2031-04-13', '10:00').toISOString(),
          end: at('2031-04-13', '10:30').toISOString(),
        }),
      ]);

      expect(component.hiddenDays()).not.toContain(0);
    });

    it('draws follow-up appointments with the violet states when the agenda says so', () => {
      component.appointments.set([
        { ...appointment('follow-up', 'CONFIRMED'), followUp: true } as DoctorScheduledCareItem,
        appointment('normal', 'CONFIRMED'),
      ]);

      const [followUp, normal] = component.appointmentEvents();
      expect(followUp?.extendedProps.stateLabel).toBe('Suivi à venir');
      expect(normal?.extendedProps.stateLabel).toBe('À venir');
    });

    it('passes « Mode discret » to the grid: initials on the cards, no name in the labels', () => {
      const store = TestBed.inject(CalendarPreferencesStore);
      const view = fixture.debugElement.query(By.directive(CalendarView))
        .componentInstance as CalendarView;
      const card = { patientLabel: 'Ahmed Ben Ali' };
      try {
        expect(component.viewModel().discreet).toBe(false);
        expect(view.displayName(card)).toBe('Ahmed Ben Ali');

        store.toggle();
        fixture.detectChanges();

        expect(component.viewModel().discreet).toBe(true);
        const info = {
          event: {
            start: at('2031-04-08', '09:30'),
            extendedProps: {
              kind: 'request',
              requestId: 'r1',
              patientLabel: 'Ahmed Ben Ali',
              statusLabel: 'En attente',
              stateLabel: 'Demande',
            },
          },
        } as unknown as EventDisplayInfo;
        expect(view.displayName(card)).toBe('A. B.');
        expect(view.appointmentAccessibleLabel(info)).toBe('Rendez-vous à 09:30. Statut : Demande.');
      } finally {
        if (store.discreet()) store.toggle();
      }
    });

    it('labels a request card for screen readers with its state, not the technical status', () => {
      const view = fixture.debugElement.query(By.directive(CalendarView))
        .componentInstance as CalendarView;
      const info = {
        event: {
          start: at('2031-04-08', '09:30'),
          extendedProps: {
            kind: 'request',
            requestId: 'r1',
            patientLabel: 'Test Patient',
            statusLabel: 'En attente',
            stateLabel: 'Demande',
          },
        },
      } as unknown as EventDisplayInfo;

      expect(view.isAppointment(info)).toBe(true);
      expect(view.appointmentAccessibleLabel(info)).toBe(
        'Rendez-vous à 09:30 avec Test Patient. Statut : Demande.',
      );
    });

    function showWeekFor(page: CalendarPage): void {
      page.onDatesSet({
        start: at('2031-04-07'),
        end: at('2031-04-14'),
        startStr: '',
        endStr: '',
        timeZone: 'local',
        view: { type: 'timeGridWeek', title: 'ignored' },
      } as never);
    }
  });
  describe('CAL-T Africa/Tunis time', () => {
    const rule = (
      dayOfWeek: AvailabilityRuleDto['dayOfWeek'],
      overrides: Partial<AvailabilityRuleDto> = {},
    ): AvailabilityRuleDto => ({
      dayOfWeek,
      active: true,
      startTime: '09:00',
      endTime: '17:00',
      pauseStart: null,
      pauseEnd: null,
      slotDurationMinutes: 30,
      ...overrides,
    });
    const weekdayName = (key: string) =>
      ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][
        weekdayOfDayKey(key) ?? 0
      ] as AvailabilityRuleDto['dayOfWeek'];

    // The week of Monday 16 → Sunday 22 November 2026, as FullCalendar reports it for Africa/Tunis.
    const WEEK = {
      start: new Date('2026-11-15T23:00:00.000Z'), // Monday 00:00 Tunis
      end: new Date('2026-11-22T23:00:00.000Z'), // next Monday 00:00 Tunis
    };
    function showTunisWeek(): void {
      component.onDatesSet({
        start: WEEK.start,
        end: WEEK.end,
        startStr: '',
        endStr: '',
        timeZone: 'Africa/Tunis',
        view: { type: 'timeGridWeek', title: 'ignored', currentStart: WEEK.start, currentEnd: WEEK.end },
      } as never);
    }

    it('runs FullCalendar in the Africa/Tunis zone (the IANA name, never an offset)', () => {
      expect(component.calendarOptions().timeZone).toBe('Africa/Tunis');
    });

    it('sends the week as Monday 00:00 → Sunday 24:00 Tunis, and exceptions as Tunis dates', () => {
      scheduledApi.getDoctorScheduledCare.mockClear();
      api.listExceptions.mockClear();

      showTunisWeek();

      expect(scheduledApi.getDoctorScheduledCare).toHaveBeenCalledExactlyOnceWith(
        '2026-11-15T23:00:00.000Z',
        '2026-11-22T23:00:00.000Z',
      );
      expect(api.listExceptions).toHaveBeenCalledExactlyOnceWith('2026-11-16', '2026-11-22');
      expect(component.visibleTitle()).toBe('16 – 22 nov. 2026');
    });

    it('sends the same week whatever instant of it the view reports first', () => {
      scheduledApi.getDoctorScheduledCare.mockClear();

      component.onDatesSet({
        start: new Date('2026-11-17T23:00:00.000Z'), // Wednesday 00:00 Tunis: Monday and Tuesday hidden
        end: new Date('2026-11-22T23:00:00.000Z'),
        startStr: '',
        endStr: '',
        timeZone: 'Africa/Tunis',
        view: { type: 'timeGridWeek', title: 'ignored' },
      } as never);

      expect(scheduledApi.getDoctorScheduledCare).toHaveBeenCalledExactlyOnceWith(
        '2026-11-15T23:00:00.000Z',
        '2026-11-22T23:00:00.000Z',
      );
    });

    it('puts an appointment at 23:30 UTC on the next Tunis day', () => {
      showTunisWeek();
      component.rules.set([rule('TUESDAY'), rule('WEDNESDAY')]);
      component.rulesLoaded.set(true);
      component.appointments.set([
        appointment('late-sunday-utc', 'CONFIRMED', {
          start: '2026-11-15T23:30:00.000Z', // Sunday in UTC, Monday 00:30 in Tunis
          end: '2026-11-16T00:00:00.000Z',
        }),
      ]);

      const [event] = component.appointmentEvents();
      // The instant reaches FullCalendar unchanged; it is read as Monday in Tunis.
      expect(event?.start).toBe('2026-11-15T23:30:00.000Z');
      expect(tunisDayKey(event?.start ?? '')).toBe('2026-11-16');
      expect(event?.extendedProps.timeRangeLabel).toBe('00:30–01:00');
      // Monday (1) is shown because of it; Sunday (0) stays hidden although the UTC day was Sunday.
      expect(component.hiddenDays()).toEqual([0, 4, 5, 6]);
    });

    it('marks the day cell of a fully blocked Tunis day, and not the day before', () => {
      component.rules.set([rule('MONDAY'), rule('SUNDAY')]);
      component.exceptions.set([
        { id: 'b', exceptionDate: '2026-11-16', type: 'BLOCK', startTime: '09:00', endTime: '17:00', reason: null },
      ]);
      const classHook = component.calendarOptions().dayCellClass as (info: {
        date: Date;
        isToday: boolean;
        isOther: boolean;
      }) => string;

      expect(classHook({ date: WEEK.start, isToday: false, isOther: false })).toContain(
        'demo-calendar-day-cell--exception',
      );
      expect(
        classHook({ date: new Date('2026-11-14T23:00:00.000Z'), isToday: false, isOther: false }),
      ).not.toContain('demo-calendar-day-cell--exception');
    });

    describe('quick create from the grid', () => {
      const futureKey = addDaysToKey(tunisToday(), 14);
      const click = (date: Date) =>
        component.onDateClick({ date, allDay: false, view: { type: 'timeGridWeek' } } as never);
      beforeEach(() => component.rules.set([rule(weekdayName(futureKey))]));

      it('sends the Tunis wall clock the doctor clicked: 09:00 Tunis is 08:00 UTC', () => {
        click(at(futureKey, '09:00'));

        expect(component.quickBookingOpen()).toBe(true);
        expect(component.quickBookingStart()).toBe(`${futureKey}T08:00:00.000Z`);
        expect(tunisHourMinute(component.quickBookingStart() ?? '').minutes).toBe(9 * 60);
      });

      it('judges working hours on the Tunis clock: 16:30 UTC is 17:30 Tunis, after closing', () => {
        click(new Date(`${futureKey}T16:30:00.000Z`));

        expect(component.quickBookingOpen()).toBe(false);
        expect(component.slotHint()).toContain('en dehors de vos horaires');
      });

      it('accepts 08:30 UTC (09:30 Tunis) and refuses 07:30 UTC (08:30 Tunis, before opening)', () => {
        click(new Date(`${futureKey}T07:30:00.000Z`));
        expect(component.quickBookingOpen()).toBe(false);

        click(new Date(`${futureKey}T08:30:00.000Z`));
        expect(component.quickBookingOpen()).toBe(true);
      });
    });

    it('proposes the exception form with today in Tunis, not in the browser zone', () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      try {
        vi.setSystemTime(new Date('2026-11-15T23:30:00.000Z')); // Monday 16 Nov, 00:30 in Tunis

        component.openExceptionForm();

        expect(component.exceptionForm.getRawValue()).toMatchObject({
          date: '2026-11-16',
          startTime: '00:30',
          endTime: '01:30',
        });
      } finally {
        vi.useRealTimers();
      }
    });

    it('draws lunch breaks on the Tunis days of the visible week', () => {
      showTunisWeek();
      component.rules.set([rule('MONDAY', { pauseStart: '12:30', pauseEnd: '14:00' })]);

      expect(component.breakEvents().map((event) => event.id)).toEqual(['break:2026-11-16']);
    });
  });
  describe('CAL-4 toolbar', () => {
    const prefs = () => TestBed.inject(CalendarPreferencesStore);
    const toolbar = () =>
      fixture.debugElement.query(By.directive(CalendarToolbar)).componentInstance as CalendarToolbar;
    const view = () =>
      fixture.debugElement.query(By.directive(CalendarView)).componentInstance as CalendarView;
    const q = <T extends HTMLElement = HTMLElement>(selector: string): T | null =>
      fixture.nativeElement.querySelector(selector) as T | null;
    const qa = (selector: string): HTMLElement[] => [...fixture.nativeElement.querySelectorAll(selector)];
    const press = (
      key: string,
      init: KeyboardEventInit = {},
      target: EventTarget = document,
    ): KeyboardEvent => {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
      target.dispatchEvent(event);
      return event;
    };
    const person = (id: string, name: string, status: DoctorScheduledCareItem['status'] = 'CONFIRMED', extra: object = {}) =>
      ({
        ...appointment(id, status),
        subject: { subjectType: 'SELF', displayName: name, relationship: null },
        ...extra,
      }) as DoctorScheduledCareItem;
    const pending = (id: string, name: string, status: DoctorScheduledCareItem['status'] = 'PENDING_DOCTOR') =>
      ({
        ...appointment('unused'),
        resourceType: 'BOOKING_REQUEST',
        requestId: id,
        appointmentId: null,
        sourceBookingRequestId: null,
        status,
        subject: { subjectType: 'SELF', displayName: name, relationship: null },
        availableActions: ['ACCEPT_REQUEST'],
      }) as DoctorScheduledCareItem;

    afterEach(() => {
      if (!prefs().shortcutsEnabled()) prefs().toggleShortcuts();
      if (prefs().discreet()) prefs().toggle();
      document.body.querySelectorAll('[data-test-card]').forEach((node) => node.remove());
    });

    describe('layout', () => {
      it('shows the toolbar of the canvas, in French', () => {
        fixture.detectChanges();
        const text = (fixture.nativeElement.textContent as string).replace(/\s+/g, ' ');

        for (const label of ['Jour', 'Semaine', 'Mois', "Aujourd'hui", 'Filtres', 'Mode discret', 'Nouveau rendez-vous', 'Raccourcis clavier']) {
          expect(text).toContain(label);
        }
        expect(q<HTMLInputElement>('#cal-search-input')?.placeholder).toBe("Rechercher dans l'agenda…");
        expect(qa('.cal-kbd').map((kbd) => kbd.textContent?.trim())).toEqual(expect.arrayContaining(['/', 'N']));
        expect(q('.cal-period')?.getAttribute('aria-label')).toBe('Choisir une date');
        expect(q('[role="switch"]')?.getAttribute('aria-checked')).toBe('false');
      });

      it('shows the period as the date-picker button', () => {
        component.visibleTitle.set('16 – 22 nov. 2026');
        fixture.detectChanges();

        expect(q('.cal-period__label')?.textContent?.trim()).toBe('16 – 22 nov. 2026');
      });
    });

    describe('Mode discret switch', () => {
      it('is a switch bound to the preferences store', () => {
        fixture.detectChanges();
        const toggle = q<HTMLButtonElement>('.cal-toolbar > button[role="switch"]') as HTMLButtonElement;
        expect(toggle.getAttribute('aria-checked')).toBe('false');
        expect(toggle.textContent).toContain('Mode discret');

        toggle.click();
        fixture.detectChanges();

        expect(prefs().discreet()).toBe(true);
        expect(toggle.getAttribute('aria-checked')).toBe('true');
        expect(component.viewModel().discreet).toBe(true);

        toggle.click();
        fixture.detectChanges();
        expect(prefs().discreet()).toBe(false);
        expect(toggle.getAttribute('aria-checked')).toBe('false');
      });
    });

    describe('date picker', () => {
      it('goes to the week of Monday 16 November in Tunis when 16 November is picked, whatever the zone', () => {
        const emitted: CalendarViewAction[] = [];
        toolbar().action.subscribe((action) => emitted.push(action));

        // The picker hands back a browser-local Date: only its year-month-day counts.
        toolbar().pickDate(new Date(2026, 10, 16, 12));
        expect(emitted).toEqual([{ kind: 'GO_TO_DATE', date: '2026-11-16' }]);

        // The toolbar is wired to the page: choosing the date is enough to move FullCalendar.
        expect(calendarApi.gotoDate).toHaveBeenCalledExactlyOnceWith('2026-11-16');

        // FullCalendar then shows the week that contains that Tunis day: Monday 16 → Sunday 22.
        const week = tunisWeekRange('2026-11-16');
        expect(week?.startKey).toBe('2026-11-16');
        expect(week?.endKey).toBe('2026-11-23');
        scheduledApi.getDoctorScheduledCare.mockClear();
        component.onDatesSet({
          start: week?.start,
          end: week?.end,
          startStr: '',
          endStr: '',
          timeZone: 'Africa/Tunis',
          view: { type: 'timeGridWeek', title: 'ignored' },
        } as never);
        expect(scheduledApi.getDoctorScheduledCare).toHaveBeenCalledWith(
          '2026-11-15T23:00:00.000Z',
          '2026-11-22T23:00:00.000Z',
        );
      });

      it('reads the picked square as a calendar date, at any hour of the browser day', () => {
        const emitted: CalendarViewAction[] = [];
        toolbar().action.subscribe((action) => emitted.push(action));

        toolbar().pickDate(new Date(2026, 10, 16, 0, 30));
        toolbar().pickDate(new Date(2026, 10, 16, 23, 30));
        toolbar().pickDate(new Date(2026, 11, 1, 12));

        expect(emitted).toEqual([
          { kind: 'GO_TO_DATE', date: '2026-11-16' },
          { kind: 'GO_TO_DATE', date: '2026-11-16' },
          { kind: 'GO_TO_DATE', date: '2026-12-01' },
        ]);
      });

      it('ignores a cleared or invalid pick', () => {
        const emitted: CalendarViewAction[] = [];
        toolbar().action.subscribe((action) => emitted.push(action));

        toolbar().pickDate(null);
        toolbar().pickDate(new Date('nope'));

        expect(emitted).toEqual([]);
      });

      it('opens on the first Tunis day of the visible period', () => {
        component.onDatesSet({
          start: new Date('2026-11-15T23:00:00.000Z'),
          end: new Date('2026-11-22T23:00:00.000Z'),
          startStr: '',
          endStr: '',
          timeZone: 'Africa/Tunis',
          view: { type: 'timeGridWeek', title: 'ignored' },
        } as never);
        fixture.detectChanges();

        const value = toolbar().pickerValue();
        expect([value?.getFullYear(), value?.getMonth(), value?.getDate()]).toEqual([2026, 10, 16]);
        expect(component.viewModel().currentDate).toBe('2026-11-16');
      });

      it('opens from the button and closes on a second click or on Échap', () => {
        fixture.detectChanges();
        q<HTMLButtonElement>('.cal-period')?.click();
        fixture.detectChanges();
        expect(toolbar().pickerOpen()).toBe(true);
        expect(q('.cal-popover--picker')).toBeTruthy();
        expect(q('.cal-period')?.getAttribute('aria-expanded')).toBe('true');

        press('Escape');
        fixture.detectChanges();
        expect(toolbar().pickerOpen()).toBe(false);
        expect(q('.cal-popover--picker')).toBeNull();
      });
    });

    describe('search', () => {
      beforeEach(() => {
        component.appointments.set([
          person('a1', 'Hélène Ben Ali'),
          person('a2', 'Karim Mansour'),
          person('a3', 'Nour Hélène', 'CANCELLED'),
        ]);
        component.requests.set([pending('r1', 'Hélène Trabelsi')]);
      });

      const type = (value: string): void => {
        const input = q<HTMLInputElement>('#cal-search-input') as HTMLInputElement;
        input.value = value;
        input.dispatchEvent(new Event('input'));
        fixture.detectChanges();
      };

      it('lists matching appointments and requests as the doctor types (accent and case insensitive)', () => {
        fixture.detectChanges();
        type('HELENE');

        const rows = qa('.cal-result');
        expect(rows).toHaveLength(3);
        const text = rows.map((row) => row.textContent?.replace(/\s+/g, ' ').trim());
        expect(text.some((row) => row?.includes('Hélène Ben Ali') && row.includes('À venir'))).toBe(true);
        expect(text.some((row) => row?.includes('Hélène Trabelsi') && row.includes('Demande'))).toBe(true);
        expect(text.some((row) => row?.includes('Nour Hélène') && row.includes('Annulé'))).toBe(true);
        expect(text.every((row) => /\d{2}:\d{2}/.test(row ?? ''))).toBe(true);
      });

      it('waits for two characters', () => {
        fixture.detectChanges();
        type('h');

        expect(qa('.cal-result')).toHaveLength(0);
        expect(q('.cal-popover--results')).toBeNull();
        expect(component.searchOutcome().active).toBe(false);
      });

      it('says « Aucun résultat dans cette période » when nothing matches', () => {
        fixture.detectChanges();
        type('zzzz');

        expect(q('.cal-popover__empty')?.textContent?.trim()).toBe('Aucun résultat dans cette période');
        expect(qa('.cal-result')).toHaveLength(0);
      });

      it('only looks at the data loaded for the visible period', () => {
        component.appointments.set([person('only-here', 'Sami Trabelsi')]);
        component.requests.set([]);
        fixture.detectChanges();

        type('mansour');
        expect(q('.cal-popover__empty')).toBeTruthy();
        expect(scheduledApi.getDoctorScheduledCare).not.toHaveBeenCalled();
      });

      it('keeps matching cards normal and dims the others', () => {
        component.handleViewAction({ kind: 'SET_SEARCH', query: 'karim' });
        fixture.detectChanges();

        expect(view().isDimmed({ kind: 'appointment', appointmentId: 'a2' } as never)).toBe(false);
        expect(view().isDimmed({ kind: 'appointment', appointmentId: 'a1' } as never)).toBe(true);
        expect(view().isDimmed({ kind: 'request', requestId: 'r1' } as never)).toBe(true);

        component.handleViewAction({ kind: 'SET_SEARCH', query: '' });
        fixture.detectChanges();
        expect(view().isDimmed({ kind: 'appointment', appointmentId: 'a1' } as never)).toBe(false);
      });

      it('opens the calendar side panel on the chosen result and selects its card', () => {
        const openWith = vi.spyOn(detailPanel, 'openWith');
        const openRequest = vi.spyOn(detailPanel, 'openRequest');
        const scroll = vi.spyOn(view(), 'scrollToCard');
        fixture.detectChanges();
        type('karim');

        (qa('.cal-result')[0] as HTMLButtonElement).click();
        fixture.detectChanges();

        expect(openWith).toHaveBeenCalledWith(expect.objectContaining({ appointmentId: 'a2' }));
        expect(scroll).toHaveBeenCalledWith('a2');
        expect(component.selectedAppointmentId()).toBe('a2');
        expect(toolbar().resultsOpen()).toBe(false);

        type('trabelsi');
        (qa('.cal-result')[0] as HTMLButtonElement).click();
        expect(openRequest).toHaveBeenCalledWith(expect.objectContaining({ requestId: 'r1' }));
        expect(component.selectedAppointmentId()).toBe('r1');
      });

      it('opens the first result on Entrée in the field', () => {
        const openWith = vi.spyOn(detailPanel, 'openWith');
        fixture.detectChanges();
        type('karim');

        q<HTMLInputElement>('#cal-search-input')?.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
        );

        expect(openWith).toHaveBeenCalledWith(expect.objectContaining({ appointmentId: 'a2' }));
      });

      it('is cleared by Échap', () => {
        fixture.detectChanges();
        type('karim');
        expect(component.searchQuery()).toBe('karim');

        const event = press('Escape');
        fixture.detectChanges();

        expect(component.searchQuery()).toBe('');
        expect(q<HTMLInputElement>('#cal-search-input')?.value).toBe('');
        expect(event.defaultPrevented).toBe(true);
      });

      it('shows initials only in Mode discret, but still finds by name', () => {
        prefs().toggle();
        fixture.detectChanges();
        type('karim');

        const text = (q('.cal-results')?.textContent ?? '').replace(/\s+/g, ' ');
        expect(text).toContain('K. M.');
        expect(text).not.toContain('Karim');
        expect(text).not.toContain('Mansour');
      });

      it('does not list what a filter hides', () => {
        component.handleViewAction({ kind: 'TOGGLE_FILTER', state: 'cancelled' });
        component.handleViewAction({ kind: 'SET_SEARCH', query: 'helene' });

        expect(component.searchOutcome().results.map((result) => result.id)).toEqual(
          expect.not.arrayContaining(['a3']),
        );
        expect(component.searchOutcome().results).toHaveLength(2);
      });
    });

    describe('filters', () => {
      const everyState = () => {
        component.appointments.set([
          person('upcoming', 'A A', 'CONFIRMED'),
          person('followUpUpcoming', 'B B', 'CONFIRMED', { followUp: true }),
          person('inProgress', 'C C', 'IN_PROGRESS'),
          person('done', 'D D', 'COMPLETED'),
          person('followUpDone', 'E E', 'COMPLETED', { followUp: true }),
          person('absent', 'F F', 'NO_SHOW'),
          person('cancelled', 'G G', 'CANCELLED'),
        ]);
        component.requests.set([
          pending('request', 'H H'),
          pending('waitingPatient', 'I I', 'PENDING_PATIENT_TIME_CONFIRMATION'),
        ]);
      };
      const drawnStates = () =>
        [...component.appointmentEvents(), ...component.requestEvents()].map(
          (event) => event.extendedProps.calendarState,
        );

      it('shows every state by default', () => {
        everyState();

        expect(drawnStates().sort()).toEqual(
          ['absent', 'cancelled', 'done', 'followUpDone', 'followUpUpcoming', 'inProgress', 'request', 'upcoming', 'waitingPatient'].sort(),
        );
        expect(component.viewModel().hiddenFilterCount).toBe(0);
      });

      it.each([
        'upcoming', 'followUpUpcoming', 'inProgress', 'done', 'followUpDone', 'request', 'waitingPatient', 'absent', 'cancelled',
      ] as const)('hides and shows « %s » on the grid only', (state) => {
        everyState();

        component.handleViewAction({ kind: 'TOGGLE_FILTER', state });
        expect(drawnStates()).toHaveLength(8);
        expect(drawnStates()).not.toContain(state);
        expect(component.viewModel().hiddenFilterCount).toBe(1);
        // Hidden is not deleted: the data is still there.
        expect(component.appointments().length + component.requests().length).toBe(9);

        component.handleViewAction({ kind: 'TOGGLE_FILTER', state });
        expect(drawnStates()).toHaveLength(9);
        expect(drawnStates()).toContain(state);
        expect(component.viewModel().hiddenFilterCount).toBe(0);
      });

      it('shows a count badge on « Filtres » when something is off, and resets', () => {
        everyState();
        fixture.detectChanges();
        expect(q('.cal-badge')).toBeNull();

        component.handleViewAction({ kind: 'TOGGLE_FILTER', state: 'cancelled' });
        component.handleViewAction({ kind: 'TOGGLE_FILTER', state: 'done' });
        fixture.detectChanges();
        expect(q('.cal-badge')?.textContent?.trim()).toBe('2');
        expect(drawnStates()).toHaveLength(7);

        component.handleViewAction({ kind: 'RESET_FILTERS' });
        fixture.detectChanges();
        expect(q('.cal-badge')).toBeNull();
        expect(drawnStates()).toHaveLength(9);
      });

      it('lists the nine states as checkboxes, all on, and toggles from the popover', () => {
        everyState();
        fixture.detectChanges();
        qa('.cal-toolbar .cal-button')[0]?.click();
        fixture.detectChanges();

        const boxes = qa('.cal-check input') as HTMLInputElement[];
        expect(boxes).toHaveLength(9);
        expect(boxes.every((box) => box.checked)).toBe(true);

        boxes[8]?.click(); // Annulé
        fixture.detectChanges();
        expect(component.hiddenStates().has('cancelled')).toBe(true);
        expect((qa('.cal-check input')[8] as HTMLInputElement).checked).toBe(false);

        const reset = qa('.cal-popover--filters oc-button')[0]?.querySelector('button') as HTMLButtonElement;
        expect(reset.disabled).toBe(false);
        reset.click();
        fixture.detectChanges();
        expect(component.hiddenStates().size).toBe(0);
        expect((qa('.cal-popover--filters oc-button')[0]?.querySelector('button') as HTMLButtonElement).disabled).toBe(true);
      });

      it('is not persisted: a new page starts with everything shown', () => {
        const keysBefore = Object.keys(localStorage).sort();

        component.handleViewAction({ kind: 'TOGGLE_FILTER', state: 'cancelled' });
        component.handleViewAction({ kind: 'TOGGLE_FILTER', state: 'done' });

        // Nothing is written anywhere: a reload starts from the default signal, « tout afficher ».
        expect(component.hiddenStates().size).toBe(2);
        expect(Object.keys(localStorage).sort()).toEqual(keysBefore);
        expect(Object.keys(sessionStorage).filter((key) => /filter|filtre/i.test(key))).toEqual([]);
      });
    });

    describe('keyboard shortcuts', () => {
      beforeEach(() => fixture.detectChanges());

      it('T goes to today, J / S / M change the view, arrows move the period', () => {
        press('t');
        expect(calendarApi.today).toHaveBeenCalledOnce();

        press('J');
        expect(calendarApi.changeView).toHaveBeenLastCalledWith('timeGridDay');
        expect(component.viewMode()).toBe('day');
        press('s');
        expect(calendarApi.changeView).toHaveBeenLastCalledWith('timeGridWeek');
        press('M');
        expect(calendarApi.changeView).toHaveBeenLastCalledWith('dayGridMonth');

        const right = press('ArrowRight');
        expect(calendarApi.next).toHaveBeenCalledOnce();
        expect(right.defaultPrevented).toBe(true);
        press('ArrowLeft');
        expect(calendarApi.prev).toHaveBeenCalledOnce();
      });

      it('N opens the new appointment drawer', () => {
        press('n');

        expect(component.quickBookingOpen()).toBe(true);
        expect(component.quickBookingStart()).toBeNull();
      });

      it('/ puts the cursor in the search field without typing a slash', () => {
        const event = press('/');
        fixture.detectChanges();

        expect(document.activeElement).toBe(q('#cal-search-input'));
        expect(event.defaultPrevented).toBe(true);
      });

      it('G opens the date picker', () => {
        press('g');
        fixture.detectChanges();

        expect(toolbar().pickerOpen()).toBe(true);
      });

      it('D switches Mode discret', () => {
        press('d');
        expect(prefs().discreet()).toBe(true);
        press('D');
        expect(prefs().discreet()).toBe(false);
      });

      it('? opens the shortcuts window', () => {
        press('?', { shiftKey: true });
        fixture.detectChanges();

        expect(q('[role="dialog"][aria-modal="true"]')).toBeTruthy();
      });

      it('Entrée opens the focused card', () => {
        const openWith = vi.spyOn(detailPanel, 'openWith');
        component.appointments.set([person('focused', 'Test Patient')]);
        const host = q('.doctor-calendar-demo__calendar-host') as HTMLElement;
        const wrapper = document.createElement('div');
        wrapper.setAttribute('data-test-card', '');
        wrapper.tabIndex = 0;
        wrapper.innerHTML = '<div data-cal-id="focused" data-cal-kind="appointment"></div>';
        host.appendChild(wrapper);
        wrapper.focus();

        const event = press('Enter', {}, wrapper);

        expect(openWith).toHaveBeenCalledWith(expect.objectContaining({ appointmentId: 'focused' }));
        expect(event.defaultPrevented).toBe(true);
      });

      it('Entrée does nothing when no card has the focus, and keeps its meaning on a button', () => {
        const openWith = vi.spyOn(detailPanel, 'openWith');
        press('Enter');
        const button = q<HTMLButtonElement>('.cal-period') as HTMLButtonElement;
        const event = press('Enter', {}, button);

        expect(openWith).not.toHaveBeenCalled();
        expect(event.defaultPrevented).toBe(false);
      });

      it('is ignored while typing in a field', () => {
        const input = q<HTMLInputElement>('#cal-search-input') as HTMLInputElement;
        input.focus();

        for (const key of ['t', 'j', 's', 'm', 'n', 'g', 'd', '/', '?', 'ArrowLeft', 'ArrowRight']) {
          press(key, {}, input);
        }

        expect(calendarApi.today).not.toHaveBeenCalled();
        expect(calendarApi.changeView).not.toHaveBeenCalled();
        expect(calendarApi.next).not.toHaveBeenCalled();
        expect(component.quickBookingOpen()).toBe(false);
        expect(prefs().discreet()).toBe(false);
        expect(toolbar().pickerOpen()).toBe(false);
      });

      it('is ignored in a textarea, a select and an editable element too', () => {
        for (const html of ['<textarea></textarea>', '<select></select>', '<div contenteditable="true"></div>']) {
          const holder = document.createElement('div');
          holder.setAttribute('data-test-card', '');
          holder.innerHTML = html;
          document.body.appendChild(holder);
          press('t', {}, holder.firstElementChild as HTMLElement);
        }

        expect(calendarApi.today).not.toHaveBeenCalled();
      });

      it('is ignored with Ctrl, Meta or Alt held', () => {
        for (const modifier of ['ctrlKey', 'metaKey', 'altKey'] as const) {
          for (const key of ['t', 'j', 's', 'm', 'n', 'g', 'd', '/', '?', 'ArrowLeft', 'ArrowRight']) {
            press(key, { [modifier]: true });
          }
        }

        expect(calendarApi.today).not.toHaveBeenCalled();
        expect(calendarApi.changeView).not.toHaveBeenCalled();
        expect(calendarApi.prev).not.toHaveBeenCalled();
        expect(component.quickBookingOpen()).toBe(false);
        expect(prefs().discreet()).toBe(false);
      });

      it('is ignored while a drawer, a dialog or a popover is open', () => {
        const blockers: ReadonlyArray<readonly [string, () => void, () => void]> = [
          ['the side panel', () => detailPanel.open.set(true), () => detailPanel.open.set(false)],
          ['the booking drawer', () => component.quickBookingOpen.set(true), () => component.quickBookingOpen.set(false)],
          ['the exception form', () => component.exceptionFormOpen.set(true), () => component.exceptionFormOpen.set(false)],
          ['the exception detail', () => component.selectedException.set(exception('x')), () => component.selectedException.set(null)],
          ['the shortcuts window', () => toolbar().openShortcuts(), () => toolbar().closeShortcuts()],
          ['the date picker', () => toolbar().openPicker(), () => toolbar().pickerOpen.set(false)],
          ['the filters', () => toolbar().toggleFilters(), () => toolbar().filtersOpen.set(false)],
        ];
        for (const [name, open, close] of blockers) {
          open();
          for (const key of ['t', 'j', 's', 'm', 'n', 'g', 'd', '/', '?', 'ArrowLeft', 'ArrowRight']) {
            press(key);
          }
          expect(calendarApi.today, name).not.toHaveBeenCalled();
          expect(calendarApi.changeView, name).not.toHaveBeenCalled();
          expect(calendarApi.next, name).not.toHaveBeenCalled();
          expect(prefs().discreet(), name).toBe(false);
          close();
        }
        expect(component.quickBookingOpen()).toBe(false);
      });

      it('is disabled by the « Raccourcis clavier activés » switch, « ? » included', () => {
        prefs().toggleShortcuts();
        fixture.detectChanges();

        for (const key of ['t', 'j', 's', 'm', 'n', 'g', 'd', '/', '?', 'ArrowLeft', 'ArrowRight', 'Enter']) {
          press(key);
        }

        expect(calendarApi.today).not.toHaveBeenCalled();
        expect(calendarApi.changeView).not.toHaveBeenCalled();
        expect(calendarApi.next).not.toHaveBeenCalled();
        expect(component.quickBookingOpen()).toBe(false);
        expect(prefs().discreet()).toBe(false);
        expect(q('[role="dialog"][aria-modal="true"]')).toBeNull();
      });

      it('triggers no patient-impacting action from any key', () => {
        const care = TestBed.inject(ScheduledCareFacade) as unknown as Record<string, ReturnType<typeof vi.fn>>;
        component.requests.set([pending('r1', 'Test Patient')]);
        component.appointments.set([person('a1', 'Test Patient')]);
        detailPanel.openRequest('r1');
        detailPanel.openWith('a1');
        detailPanel.open.set(false);
        const keys = [
          ...'abcdefghijklmnopqrstuvwxyz0123456789'.split(''),
          'Enter', ' ', 'Delete', 'Backspace', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Escape', '?', '/',
        ];

        for (const key of keys) press(key);
        for (const key of keys) press(key.toUpperCase());

        for (const name of ['acceptRequest', 'declineRequest', 'proposeTime', 'cancelAppointment']) {
          expect(care[name], name).not.toHaveBeenCalled();
        }
        expect(TestBed.inject(ActiveConsultationStore).startScheduledAppointment).not.toHaveBeenCalled();
      });

      it('lets Échap close the window and popovers even when shortcuts are off', () => {
        prefs().toggleShortcuts();
        toolbar().openShortcuts();
        fixture.detectChanges();
        expect(toolbar().shortcutsOpen()).toBe(true);

        press('Escape');

        expect(toolbar().shortcutsOpen()).toBe(false);
      });

      it('removes its keydown listener when the page is destroyed, and nothing reacts afterwards', () => {
        const removed = vi.spyOn(document, 'removeEventListener');

        fixture.destroy();

        expect(removed).toHaveBeenCalledWith('keydown', expect.any(Function));
        for (const key of ['t', 'n', 'j', 'd', '/', '?', 'ArrowRight']) press(key);
        expect(calendarApi.today).not.toHaveBeenCalled();
        expect(calendarApi.changeView).not.toHaveBeenCalled();
        expect(calendarApi.next).not.toHaveBeenCalled();
        expect(prefs().discreet()).toBe(false);
      });
    });

    describe('shortcuts window', () => {
      const openWindow = (): HTMLButtonElement => {
        fixture.detectChanges();
        const button = qa('.cal-toolbar oc-button').find((host) => host.textContent?.includes('Raccourcis clavier'))
          ?.querySelector('button') as HTMLButtonElement;
        button.focus();
        button.click();
        fixture.detectChanges();
        return button;
      };

      it('opens from its button as an accessible modal dialog with the canvas content', () => {
        openWindow();

        const dialog = q('[role="dialog"][aria-modal="true"]') as HTMLElement;
        expect(dialog).toBeTruthy();
        const title = document.getElementById(dialog.getAttribute('aria-labelledby') ?? '');
        expect(title?.textContent?.trim()).toBe('Raccourcis clavier');
        expect(qa('.cal-shortcuts__row')).toHaveLength(12);
        const text = (dialog.textContent ?? '').replace(/\s+/g, ' ');
        for (const label of ['Aujourd’hui', 'Vue Jour', 'Vue Semaine', 'Vue Mois', 'Période précédente / suivante', 'Nouveau rendez-vous', 'Rechercher', 'Aller à une date', 'Mode discret', 'Fermer l’aperçu ou le panneau', 'Afficher les raccourcis', 'Ouvrir le rendez-vous sélectionné']) {
          expect(text).toContain(label);
        }
        expect(text).toContain(
          'Annuler, déplacer ou marquer absent n’ont pas de raccourci : ces actions passent toujours par une confirmation.',
        );
        expect(text).not.toContain('Espace');
      });

      it('moves the focus into the window and traps Tab inside it', async () => {
        openWindow();
        await Promise.resolve();
        await fixture.whenStable();
        const dialog = q('.cal-dialog') as HTMLElement;
        expect(dialog.contains(document.activeElement)).toBe(true);

        const focusable = [...dialog.querySelectorAll<HTMLElement>('button, [href], input, select, textarea')];
        focusable[focusable.length - 1]?.focus();
        dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
        expect(document.activeElement).toBe(focusable[0]);

        dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
        expect(document.activeElement).toBe(focusable[focusable.length - 1]);
      });

      it('returns the focus to the button that opened it, on Échap and on « Fermer »', async () => {
        const opener = openWindow();
        await Promise.resolve();
        await fixture.whenStable();

        press('Escape');
        fixture.detectChanges();
        expect(q('.cal-dialog')).toBeNull();
        expect(document.activeElement).toBe(opener);

        opener.click();
        fixture.detectChanges();
        const close = [...qa('.cal-dialog__actions oc-button')][0]?.querySelector('button') as HTMLButtonElement;
        close.click();
        fixture.detectChanges();
        expect(q('.cal-dialog')).toBeNull();
        expect(document.activeElement).toBe(opener);
      });

      it('returns the focus to the search field when opened from there with « ? » after the button was used', async () => {
        fixture.detectChanges();
        const field = q<HTMLInputElement>('#cal-search-input') as HTMLInputElement;
        field.focus();
        toolbar().openShortcuts(field);
        fixture.detectChanges();
        await Promise.resolve();

        toolbar().closeShortcuts();

        expect(document.activeElement).toBe(field);
      });

      it('has a « Raccourcis clavier activés » switch, on by default and persisted in the store', () => {
        openWindow();
        const toggle = q<HTMLButtonElement>('.cal-dialog__switch') as HTMLButtonElement;
        expect(toggle.textContent).toContain('Raccourcis clavier activés');
        expect(toggle.getAttribute('role')).toBe('switch');
        expect(toggle.getAttribute('aria-checked')).toBe('true');

        toggle.click();
        fixture.detectChanges();
        expect(prefs().shortcutsEnabled()).toBe(false);
        expect(toggle.getAttribute('aria-checked')).toBe('false');

        toggle.click();
        fixture.detectChanges();
        expect(prefs().shortcutsEnabled()).toBe(true);
      });

      it('still opens from the button when the shortcuts are off', () => {
        prefs().toggleShortcuts();
        openWindow();

        expect(q('.cal-dialog')).toBeTruthy();
        expect(q('.cal-dialog__switch')?.getAttribute('aria-checked')).toBe('false');
      });
    });

    describe('day summary count', () => {
      const showDay = (): void => {
        component.onDatesSet({
          start: new Date('2026-11-15T23:00:00.000Z'), // Monday 16 Nov 00:00 Tunis
          end: new Date('2026-11-16T23:00:00.000Z'),
          startStr: '',
          endStr: '',
          timeZone: 'Africa/Tunis',
          view: { type: 'timeGridDay', title: 'ignored' },
        } as never);
      };
      const label = () => component.viewModel().daySummary?.appointmentCountLabel;

      it('counts only the displayed day, and not cancelled appointments', () => {
        showDay();
        component.appointments.set([
          person('mon-1', 'A A', 'CONFIRMED', { start: '2026-11-16T08:00:00.000Z', end: '2026-11-16T08:30:00.000Z' }),
          person('mon-2', 'B B', 'COMPLETED', { start: '2026-11-16T09:00:00.000Z', end: '2026-11-16T09:30:00.000Z' }),
          person('mon-cancelled', 'C C', 'CANCELLED', { start: '2026-11-16T10:00:00.000Z', end: '2026-11-16T10:30:00.000Z' }),
          person('tue', 'D D', 'CONFIRMED', { start: '2026-11-17T08:00:00.000Z', end: '2026-11-17T08:30:00.000Z' }),
          person('sun', 'E E', 'CONFIRMED', { start: '2026-11-15T08:00:00.000Z', end: '2026-11-15T08:30:00.000Z' }),
        ]);

        expect(label()).toBe('2 rendez-vous');
      });

      it('does not show the total of the previous week while the day is still loading', () => {
        // The doctor switches from the week to Tuesday 17 November; the new range has not arrived yet.
        component.onDatesSet({
          start: new Date('2026-11-16T23:00:00.000Z'),
          end: new Date('2026-11-17T23:00:00.000Z'),
          startStr: '',
          endStr: '',
          timeZone: 'Africa/Tunis',
          view: { type: 'timeGridDay', title: 'ignored' },
        } as never);
        component.appointments.set(
          ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20'].map((day, index) =>
            person(`wk-${index}`, 'W W', 'CONFIRMED', {
              start: `${day}T08:00:00.000Z`,
              end: `${day}T08:30:00.000Z`,
            }),
          ),
        );

        expect(label()).toBe('1 rendez-vous');
      });

      it('puts an appointment at 23:30 UTC on the next Tunis day', () => {
        showDay();
        component.appointments.set([
          // Sunday 23:30 UTC is Monday 00:30 in Tunis: counted.
          person('late', 'L L', 'CONFIRMED', { start: '2026-11-15T23:30:00.000Z', end: '2026-11-16T00:00:00.000Z' }),
          // Monday 22:30 UTC is Monday 23:30 in Tunis: counted.
          person('early', 'M M', 'CONFIRMED', { start: '2026-11-16T22:30:00.000Z', end: '2026-11-16T23:00:00.000Z' }),
          // Monday 23:30 UTC is already Tuesday 00:30 in Tunis: not counted.
          person('next', 'N N', 'CONFIRMED', { start: '2026-11-16T23:30:00.000Z', end: '2026-11-17T00:00:00.000Z' }),
        ]);

        expect(label()).toBe('2 rendez-vous');
      });

      it('says 0 when the day is empty', () => {
        showDay();
        component.appointments.set([]);

        expect(label()).toBe('0 rendez-vous');
      });
    });
  });

  describe('CAL-FIX final fix pass', () => {
    const prefs = () => TestBed.inject(CalendarPreferencesStore);
    const host = (): HTMLElement => fixture.nativeElement as HTMLElement;

    afterEach(() => {
      vi.useRealTimers();
      if (prefs().discreet()) prefs().toggle();
    });

    /** Two confirmed appointments of the CURRENT Tunis week, drawn by the real FullCalendar. */
    async function drawThisWeek(): Promise<void> {
      const week = tunisWeekRange(new Date())!;
      const start = (day: number, time: string) => at(addDaysToKey(week.startKey, day), time).toISOString();
      const end = (day: number, time: string) => at(addDaysToKey(week.startKey, day), time).toISOString();
      scheduledApi.getDoctorScheduledCare.mockReturnValue(of(agenda([
        appointment('short', 'CONFIRMED', { start: start(0, '09:00'), end: end(0, '09:30') }),
        appointment('tall', 'CONFIRMED', { start: start(1, '10:00'), end: end(1, '11:00') }),
      ])));
      component.handleViewAction({ kind: 'RETRY_APPOINTMENTS' });
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    }

    it('fix 1: each week column header shows the weekday once, with the date', () => {
      const headers = [...host().querySelectorAll('.demo-calendar-day-header')];
      expect(headers.length).toBeGreaterThan(0);
      for (const header of headers) {
        const text = (header.textContent ?? '').toLowerCase();
        expect(text.match(/(lun|mar|mer|jeu|ven|sam|dim)\./g) ?? []).toHaveLength(1);
        expect(text).toMatch(/\d/);
      }
      expect(host().querySelector('.oc-day-header')).toBeNull();
    });

    it('fix 2: the grid business hours keep the lunch break inside the working segment', () => {
      component.rules.set([
        { dayOfWeek: 'MONDAY', active: true, startTime: '08:00', endTime: '18:00', pauseStart: '12:30', pauseEnd: '14:00', slotDurationMinutes: 30 },
      ]);
      expect(component.calendarOptions().businessHours).toEqual([{ daysOfWeek: [1], startTime: '08:00', endTime: '18:00' }]);
    });

    it('fix 3: no grey footer note under the calendar', () => {
      fixture.detectChanges();
      expect(host().querySelector('.doctor-calendar-demo__notice')).toBeNull();
      expect(host().textContent).not.toContain('Les horaires affichent');
    });

    it('fix 4: a card stretches to the full column, whatever its height (CSS rule present)', () => {
      const css = [...document.querySelectorAll('style')].map((style) => style.textContent ?? '').join(' ').replace(/\s+/g, ' ');
      expect(css).toMatch(/\.doctor-calendar-demo__calendar \.oc-event:not\(\.oc-event--month\) ?\{[^}]*flex: ?1 1 auto[^}]*align-self: ?stretch[^}]*width: ?100%/);
    });

    it('fix 6: the slot hint is a toast in a live region outside the layout, gone after 4 s', () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      component.onDateClick({ date: new Date(Date.now() - 3_600_000), allDay: false, view: { type: 'timeGridWeek' } } as never);
      fixture.detectChanges();

      const region = host().querySelector('.doctor-calendar-demo__toast-region') as HTMLElement;
      expect(region.getAttribute('role')).toBe('status');
      expect(region.getAttribute('aria-live')).toBe('polite');
      expect(region.textContent?.trim()).toBe('Ce créneau est déjà passé.');
      expect(host().querySelector('.doctor-calendar-demo__state--hint')).toBeNull();

      vi.advanceTimersByTime(SLOT_HINT_MS - 1);
      fixture.detectChanges();
      expect(region.textContent?.trim()).toBe('Ce créneau est déjà passé.');
      vi.advanceTimersByTime(1);
      fixture.detectChanges();
      expect(region.textContent?.trim()).toBe('');
      expect(host().querySelector('.doctor-calendar-demo__toast-region')).toBe(region); // always there
    });

    it('fix 8: the Mode discret switch gives the focus back after a mouse click, keeps it on the keyboard', () => {
      fixture.detectChanges();
      const toggle = host().querySelector('.cal-toolbar .cal-switch:not(.cal-dialog__switch)') as HTMLButtonElement;

      toggle.focus();
      toggle.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
      fixture.detectChanges();
      expect(document.activeElement).not.toBe(toggle);
      expect(prefs().discreet()).toBe(true);

      toggle.focus();
      toggle.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 })); // Espace / Entrée
      fixture.detectChanges();
      expect(document.activeElement).toBe(toggle);
      expect(prefs().discreet()).toBe(false);
    });

    it('fix 9: Mode discret survives logout (sensitive-state cleanup)', () => {
      prefs().toggle();
      TestBed.inject(SensitiveStateRegistry).clearAll();
      expect(prefs().discreet()).toBe(true);
      expect(localStorage.getItem('oc.calendar.discreet')).toBe('true');
    });

    it('fix 10: in Mode discret no full patient name reaches the grid DOM, not even the FullCalendar title', async () => {
      await drawThisWeek();
      const grid = (): string => (host().querySelector('.doctor-calendar-demo__calendar-host') as HTMLElement).innerHTML;
      expect(grid()).toContain('Ahmed Ben Ali'); // sanity: the name is drawn when not discreet

      prefs().toggle();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(component.appointmentEvents().map((event) => event.title)).not.toContain('Ahmed Ben Ali');
      expect(component.appointmentEvents().every((event) => !/Ahmed|Ben Ali/.test(event.title))).toBe(true);
      expect(grid()).not.toContain('Ahmed');
      expect(grid()).not.toContain('Ben Ali');
    });
  });

  describe('CAL-FIX-2', () => {
    afterEach(() => vi.useRealTimers());

    it('fix 3: after a mouse click on Jour / Semaine / Mois the control gives its focus back; the keyboard keeps it', () => {
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      const radio = host.querySelector('.cal-toolbar__views input') as HTMLInputElement;
      expect(radio).toBeTruthy();

      radio.focus();
      radio.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
      expect(document.activeElement).not.toBe(radio);

      radio.focus();
      radio.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
      expect(document.activeElement).toBe(radio);
    });

    it('fix 3: text fields, dialogs, menus and confirmations keep their focus', () => {
      const make = (html: string): HTMLElement => {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = html;
        return wrapper.firstElementChild as HTMLElement;
      };
      expect(shouldReleaseFocus(make('<button type="button">Jour</button>'))).toBe(true);
      expect(shouldReleaseFocus(make('<input type="radio">'))).toBe(true);
      expect(shouldReleaseFocus(make('<div role="gridcell" tabindex="0"></div>'))).toBe(true);
      expect(shouldReleaseFocus(make('<input type="text">'))).toBe(false);
      expect(shouldReleaseFocus(make('<button aria-expanded="true">⋯</button>'))).toBe(false);
      expect(shouldReleaseFocus(make('<button nz-popconfirm>Rouvrir</button>'))).toBe(false);
      const dialog = make('<div role="dialog"><button>Fermer</button></div>');
      expect(shouldReleaseFocus(dialog.querySelector('button') as HTMLElement)).toBe(false);
    });

    it('fix 5: the week opens at the earliest working start − 1 h (API « HH:mm:ss »), widened by an earlier appointment', () => {
      component.rules.set([
        { dayOfWeek: 'MONDAY', active: true, startTime: '07:00:00', endTime: '17:00:00', pauseStart: null, pauseEnd: null, slotDurationMinutes: 30 },
      ] as unknown as AvailabilityRuleDto[]);
      expect(component.calendarOptions().slotMinTime).toBe('06:00:00');
      expect(component.calendarOptions().scrollTime).toBe('06:00:00');

      component.rules.set([
        { dayOfWeek: 'MONDAY', active: true, startTime: '09:00', endTime: '17:00', pauseStart: null, pauseEnd: null, slotDurationMinutes: 30 },
      ]);
      component.appointments.set([
        appointment('early', 'CONFIRMED', { start: at('2031-04-07', '07:30').toISOString(), end: at('2031-04-07', '08:00').toISOString() }),
      ]);
      expect(component.calendarOptions().slotMinTime).toBe('06:00:00');
    });

    it('fix 6: no booking on past time from the page entry points', () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(at('2031-04-09', '15:00'));
      component.handleViewAction({ kind: 'NEW_APPOINTMENT_ON', date: '2031-04-08' });
      expect(component.quickBookingOpen()).toBe(false);
      component.handleViewAction({ kind: 'DAY_ADD_SLOT', date: '2031-04-09', start: '09:00' });
      expect(component.quickBookingOpen()).toBe(false);

      component.handleViewAction({ kind: 'DAY_ADD_SLOT', date: '2031-04-09', start: '16:00' });
      expect(component.quickBookingOpen()).toBe(true);
      expect(component.quickBookingStart()).toBe(at('2031-04-09', '16:00').toISOString());
    });
  });
});

