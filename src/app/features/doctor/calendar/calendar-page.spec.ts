import { registerLocaleData } from '@angular/common';
import enGb from '@angular/common/locales/en-GB';
import { signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import {
  DatesSetInfo,
  DayHeaderInfo,
  EventClickInfo,
  EventDisplayInfo,
  FullCalendarComponent,
} from '@fullcalendar/angular';
import { Calendar } from 'fullcalendar';
import { en_GB, provideNzI18n } from 'ng-zorro-antd/i18n';
import { Observable, Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { UrgentLiveEvent } from '../../../core/realtime/live-event.models';
import { RealtimeHealth, RealtimeService } from '../../../core/realtime/realtime.service';
import { OcTimeField } from '../../../shared/ui/time-field/oc-time-field';
import type {
  AvailabilityExceptionDto,
  AvailabilityExceptionRequestDto,
  AvailabilityRuleDto,
  UrgentOfferDto,
} from '../appointment-api.models';
import { AppointmentApiService } from '../appointment-api.service';
import { ActiveMatchedRequestStore } from '../active-matched-request.store';
import { DoctorUrgentApiService, UrgentRequestSummaryDto } from '../doctor-urgent-api.service';
import { UrgentAcceptedStore } from '../urgent-accepted.store';
import { ScheduledAppointmentDetailPanel } from '../scheduled-care/scheduled-appointment-detail-panel';
import { ScheduledCareApiService } from '../scheduled-care/scheduled-care-api.service';
import { ScheduledCareFacade } from '../scheduled-care/scheduled-care.facade';
import type {
  DoctorScheduledCareAgenda,
  DoctorScheduledCareItem,
} from '../scheduled-care/scheduled-care.models';
import { CalendarPage } from './calendar-page';

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
  status = 'CONFIRMED',
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

function urgentSummary(overrides: Partial<UrgentRequestSummaryDto> = {}): UrgentRequestSummaryDto {
  return {
    id: 'urgent-1',
    status: 'MATCHED',
    selectedOfferId: 'offer-1',
    matchedAt: '2031-04-08T14:20:00.000Z',
    arrivedAt: null,
    ...overrides,
  };
}

function urgentOffer(overrides: Partial<UrgentOfferDto> = {}): UrgentOfferDto {
  return {
    offerId: 'offer-1',
    requestId: 'urgent-1',
    doctorId: 'doctor-1',
    status: 'ACCEPTED',
    sentAt: '2031-04-08T14:00:00.000Z',
    respondedAt: '2031-04-08T14:05:00.000Z',
    patientName: 'Leïla Trabelsi',
    patientLatitude: 36.8,
    patientLongitude: 10.18,
    visitPreference: 'CABINET_VISIT',
    notes: null,
    requestStatus: 'MATCHED',
    ...overrides,
  };
}

describe('CalendarPage', () => {
  let fixture: ComponentFixture<CalendarPage>;
  let component: CalendarPage;
  let api: AppointmentApiStub;
  let urgentEvents: Subject<UrgentLiveEvent>;
  let urgentRequestIds: WritableSignal<ReadonlySet<string>>;
  let acceptedOffers: WritableSignal<readonly UrgentOfferDto[]>;
  let urgentApi: {
    readonly request: ReturnType<typeof vi.fn<(id: string) => Observable<UrgentRequestSummaryDto>>>;
  };
  let realtimeHealth: WritableSignal<RealtimeHealth>;
  let calendarApi: Pick<Calendar, 'changeView' | 'next' | 'prev' | 'today'>;
  let detailPanel: ScheduledAppointmentDetailPanel;
  let scheduledApi: {
    readonly getDoctorScheduledCare: ReturnType<
      typeof vi.fn<(from: string, to: string) => Observable<DoctorScheduledCareAgenda>>
    >;
  };
  let projectionInvalidationEpoch: WritableSignal<number>;

  beforeEach(async () => {
    urgentEvents = new Subject<UrgentLiveEvent>();
    urgentRequestIds = signal<ReadonlySet<string>>(new Set());
    acceptedOffers = signal<readonly UrgentOfferDto[]>([]);
    urgentApi = { request: vi.fn(() => of(urgentSummary())) };
    realtimeHealth = signal<RealtimeHealth>('live');
    projectionInvalidationEpoch = signal(0);
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
        { provide: AppointmentApiService, useValue: api },
        { provide: ScheduledCareApiService, useValue: scheduledApi },
        {
          provide: ScheduledCareFacade,
          useValue: {
            projectionInvalidationEpoch,
            commandLoading: signal(false),
            appointmentLoading: signal(false),
            appointmentError: signal(null),
            activeAppointment: signal(null),
            commandError: signal(null),
            openAppointment: vi.fn(),
            closeAppointment: vi.fn(),
            cancelAppointment: vi.fn(),
          },
        },
        { provide: DoctorUrgentApiService, useValue: urgentApi },
        { provide: ActiveMatchedRequestStore, useValue: { requestIds: urgentRequestIds } },
        { provide: UrgentAcceptedStore, useValue: { offers: acceptedOffers } },
        {
          provide: RealtimeService,
          useValue: {
            urgentEvents$: urgentEvents,
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
      next: vi.fn(),
      prev: vi.fn(),
      today: vi.fn(),
    };

    const fullCalendar = fixture.debugElement.query(By.directive(FullCalendarComponent))
      .componentInstance as FullCalendarComponent;
    vi.spyOn(fullCalendar, 'getApi').mockReturnValue(calendarApi as unknown as Calendar);
    detailPanel = fixture.debugElement.query(By.directive(ScheduledAppointmentDetailPanel))
      .componentInstance as ScheduledAppointmentDetailPanel;

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
    expect(host.querySelector('.omnicare-calendar')).toBeTruthy();
    expect(host.querySelector('.omnicare-calendar__surface > full-calendar')).toBeTruthy();
  });

  it('uses one OmniCare-owned day-header renderer without native duplicate content', () => {
    const options = component.calendarOptions();
    const dayHeaderContent = options.dayHeaderContent;
    const dayHeaderClass = options.dayHeaderClass;

    expect(dayHeaderContent).toBe(component.renderDayHeader);
    expect(typeof dayHeaderContent).toBe('function');
    expect(
      component.renderDayHeader({
        weekdayText: 'mer.',
        dayNumberText: '7',
        isToday: true,
        view: { type: 'timeGridWeek' },
      } as DayHeaderInfo),
    ).toEqual({
      html: expect.stringContaining(
        'omnicare-calendar-day-heading omnicare-calendar-day-heading--today',
      ),
    });
    expect(typeof dayHeaderClass).toBe('function');
    expect(
      typeof dayHeaderClass === 'function'
        ? dayHeaderClass({ isToday: true } as DayHeaderInfo)
        : dayHeaderClass,
    ).toBe('omnicare-fc-day-header omnicare-fc-day-header--today');

    const headers = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
        '.omnicare-fc-day-header',
      ),
    ];

    expect(headers).toHaveLength(7);
    for (const header of headers) {
      const inner = header.querySelector('.omnicare-fc-day-header__inner');
      expect(inner?.children).toHaveLength(1);
      expect(inner?.firstElementChild?.classList.contains('omnicare-calendar-day-heading')).toBe(
        true,
      );
    }
    expect(
      (fixture.nativeElement as HTMLElement).querySelector(
        '.omnicare-calendar__surface > .omnicare-calendar-day-heading',
      ),
    ).toBeNull();
    expect(fixture.nativeElement.innerHTML).not.toContain('purple');
  });

  it('removes the unused all-day lane and keeps the 07:00 initial scroll', () => {
    const options = component.calendarOptions();

    expect(options.allDaySlot).toBe(false);
    expect(options.allDayHeaderContent).toBeUndefined();
    expect(options.scrollTime).toBe('07:00:00');
    expect(options.scrollTimeReset).toBe(false);
  });

  it('renders the approved production toolbar hierarchy and labels', () => {
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Jour');
    expect(text).toContain('Semaine');
    expect(text).toContain('Mois');
    expect(text).toContain('Modifier les horaires');
    expect(text).toContain('+ Exception');
    expect(text).toContain("Aujourd'hui");
    expect(text).not.toContain('Modifier emploi du temps');
  });

  it('hides healthy local sync status and shows only a passive degraded warning', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Synchronisation différée');
    expect(fixture.nativeElement.textContent).not.toContain('MAJ indisponibles');

    realtimeHealth.set('stale');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Synchronisation différée');
  });

  it('starts in month view with editing disabled', () => {
    expect(component.viewMode()).toBe('month');
    expect(component.calendarOptions().initialView).toBe('dayGridMonth');
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
    expect(classHook({ date: new Date(2026, 9, 9), isToday: false, isOther: false })).toContain(
      'omnicare-fc-day-cell--blocked',
    );
    expect(
      classHook({ date: new Date(2026, 9, 16), isToday: false, isOther: false }),
    ).not.toContain('omnicare-fc-day-cell--blocked');
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

  it('keeps booking requests on Home/Demandes instead of rendering calendar blocks', () => {
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

    expect(component.appointments()).toEqual([]);
    expect(component.calendarEvents()).toEqual([]);
  });

  it('updates the external title and view from datesSet', () => {
    showRange(RANGE_A, 'timeGridWeek', '7 – 13 avril 2031');
    expect(component.visibleTitle()).toBe('7 – 13 avril 2031');
    expect(component.viewMode()).toBe('week');
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
      className: 'omnicare-appointment-event--completed',
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
      'omnicare-fc-event--appointment omnicare-fc-event--confirmed',
    );
    expect(classesFor({ kind: 'urgent-estimate' })).toContain('omnicare-fc-event--urgent');
    expect(classesFor({ kind: 'exception-annotation', exceptionType: 'BLOCK' })).toContain(
      'omnicare-fc-event--block',
    );
    expect(classesFor({ kind: 'exception-annotation', exceptionType: 'EXTRA' })).toContain(
      'omnicare-fc-event--extra',
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
    expect(api.listExceptions.mock.calls[0]?.[0]).toMatch(/^2031-04-/);
    expect(api.listExceptions.mock.calls[0]?.[1]).toMatch(/^2031-0[45]-/);
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

  it('projects matched urgent state from the existing stores', () => {
    acceptedOffers.set([urgentOffer()]);
    urgentRequestIds.set(new Set(['urgent-1']));
    TestBed.flushEffects();

    expect(urgentApi.request).toHaveBeenCalledWith('urgent-1');
    expect(component.urgentEvents()[0]).toMatchObject({
      id: 'urgent:urgent-1',
      extendedProps: {
        kind: 'urgent-estimate',
        patientLabel: 'Leïla Trabelsi',
        estimatedMinutes: 30,
      },
    });
  });

  it('recomputes urgent presentation after the existing realtime stream reports arrival', () => {
    acceptedOffers.set([urgentOffer()]);
    urgentRequestIds.set(new Set(['urgent-1']));
    TestBed.flushEffects();

    urgentEvents.next({
      name: 'DOCTOR_ARRIVED',
      data: { requestId: 'urgent-1', doctorName: 'Dr Test' },
      timestamp: '2031-04-08T14:42:00.000Z',
    });

    expect(component.urgentEvents()[0]).toMatchObject({
      className: 'omnicare-urgent-event--arrived',
      extendedProps: { kind: 'urgent-estimate' },
    });
  });

  it('removes a cancelled urgent record from the agenda', () => {
    acceptedOffers.set([urgentOffer()]);
    urgentRequestIds.set(new Set(['urgent-1']));
    TestBed.flushEffects();

    urgentEvents.next({
      name: 'REQUEST_CANCELLED',
      data: { requestId: 'urgent-1' },
      timestamp: '2031-04-08T14:45:00.000Z',
    });

    expect(component.urgentEvents()).toEqual([]);
  });

  it('keeps the production non-destructive no-click behavior for urgent entries', () => {
    const openWith = vi.spyOn(detailPanel, 'openWith');

    component.onEventClick({
      event: { extendedProps: { kind: 'urgent-estimate', requestId: 'urgent-1' } },
    } as unknown as EventClickInfo);

    expect(openWith).not.toHaveBeenCalled();
    expect(component.selectedException()).toBeNull();
  });

  it('combines appointment and urgent events without ID collision', () => {
    component.appointments.set([appointment('urgent-1')]);
    acceptedOffers.set([urgentOffer()]);
    urgentRequestIds.set(new Set(['urgent-1']));
    TestBed.flushEffects();

    expect(component.calendarEvents().map((event) => event.id)).toEqual(
      expect.arrayContaining(['appointment:urgent-1', 'urgent:urgent-1']),
    );
  });

  it('provides urgent accessible text and a compact month label', () => {
    const info = {
      event: {
        start: new Date('2031-04-08T14:20:00.000Z'),
        end: new Date('2031-04-08T14:50:00.000Z'),
        extendedProps: {
          kind: 'urgent-estimate',
          requestId: 'urgent-1',
          patientLabel: 'Leïla Trabelsi',
          estimatedMinutes: 30,
          statusLabel: 'Arrivée estimée',
          arrivedAtInstant: null,
        },
      },
    } as unknown as EventDisplayInfo;

    expect(component.eventAccessibleLabel(info)).toContain('Urgence');
    expect(component.eventAccessibleLabel(info)).toContain('30 minutes estimées');
    expect(component.urgentMonthLabel(info)).toMatch(/^Urgent · \d{2}:\d{2}$/);
  });
});
