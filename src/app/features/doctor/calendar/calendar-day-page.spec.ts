import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { DatesSetInfo, FullCalendarComponent } from '@fullcalendar/angular';
import { Calendar } from 'fullcalendar';
import { en_GB, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzPopconfirmDirective } from 'ng-zorro-antd/popconfirm';
import { Observable, Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OMNICARE_ICONS } from '../../../app.icons';
import { RealtimeService } from '../../../core/realtime/realtime.service';
import type { AvailabilityExceptionDto, AvailabilityRuleDto } from '../appointment-api.models';
import { AppointmentApiService } from '../appointment-api.service';
import { ActiveConsultationStore } from '../active-consultation.store';
import { ScheduledCareApiService } from '../scheduled-care/scheduled-care-api.service';
import { ScheduledCareFacade } from '../scheduled-care/scheduled-care.facade';
import type {
  DoctorScheduledCareAgenda,
  DoctorScheduledCareItem,
} from '../scheduled-care/scheduled-care.models';
import { CalendarDay } from './calendar-day';
import { CalendarDetailPanel } from './calendar-detail-panel';
import type { DaySlotsResponse } from './calendar-day-slots.models';
import { CalendarDaySlotsService } from './calendar-day-slots.service';
import { CalendarPage } from './calendar-page';
import { CalendarPreferencesStore } from './calendar-preferences.store';
import type { CalendarSummary } from './calendar-summary.models';
import { CalendarSummaryService } from './calendar-summary.service';
import { addDaysToKey } from './calendar-time';
import { at } from './calendar-time.testing';
import { daySlotsFixture } from './testing/day-slots.testing';
import { fixtureDay, summaryFixture } from './testing/calendar-summary.testing';

const DAY = '2026-11-16';
const NEXT_DAY = '2026-11-17';
const NOW = at(DAY, '10:20').getTime();

function care(
  id: string,
  time: string,
  overrides: Partial<DoctorScheduledCareItem> = {},
  day = DAY,
): DoctorScheduledCareItem {
  const start = at(day, time);
  return {
    resourceType: 'APPOINTMENT',
    requestId: null,
    appointmentId: id,
    sourceBookingRequestId: null,
    version: 3,
    status: 'CONFIRMED',
    doctor: { displayName: 'Dr Test', specialty: null },
    subject: { subjectType: 'SELF', displayName: 'Ahmed Ben Ali', relationship: null },
    cabinet: { name: 'Cabinet Lac', address: '', city: '', governorate: '', timezone: 'Africa/Tunis' },
    start: start.toISOString(),
    end: new Date(start.getTime() + 30 * 60_000).toISOString(),
    timezone: 'Africa/Tunis',
    responseDeadline: null,
    cancellation: null,
    intakeStatus: null,
    availableActions: [],
    sortAt: start.toISOString(),
    updatedAt: start.toISOString(),
    ...overrides,
  } as DoctorScheduledCareItem;
}

const named = (name: string, type = 'SELF'): Partial<DoctorScheduledCareItem> => ({
  subject: { subjectType: type, displayName: name, relationship: null },
});

function request(id: string, time: string, name = 'Sonia Trabelsi'): DoctorScheduledCareItem {
  return care('unused', time, {
    resourceType: 'BOOKING_REQUEST',
    requestId: id,
    appointmentId: null,
    status: 'PENDING_DOCTOR',
    availableActions: ['ACCEPT_REQUEST', 'DECLINE_REQUEST'],
    ...named(name),
  });
}

const dayItems = (): DoctorScheduledCareItem[] => [
  care('a1', '08:30', { status: 'COMPLETED', ...named('Karim Mansour') }),
  care('a3', '10:30', named('Leila Gharbi', 'PRACTICE_PATIENT')),
  care('a4', '14:00', named('Sami Jlassi')),
  request('r1', '15:00'),
];

const agenda = (items: readonly DoctorScheduledCareItem[]): DoctorScheduledCareAgenda => ({
  generatedAt: '',
  from: '',
  to: '',
  items,
});

const rule = (dayOfWeek: AvailabilityRuleDto['dayOfWeek']): AvailabilityRuleDto => ({
  dayOfWeek,
  active: true,
  startTime: '08:00',
  endTime: '18:00',
  pauseStart: '12:30',
  pauseEnd: '14:00',
  slotDurationMinutes: 30,
});

const blockException = (): AvailabilityExceptionDto => ({
  id: 'ex1',
  exceptionDate: DAY,
  type: 'BLOCK',
  startTime: '16:00:00',
  endTime: '17:00:00',
  reason: null,
});

describe('CalendarPage — day view (CAL-6)', () => {
  let fixture: ComponentFixture<CalendarPage>;
  let component: CalendarPage;
  let getDoctorScheduledCare: ReturnType<typeof vi.fn<(from: string, to: string) => Observable<DoctorScheduledCareAgenda>>>;
  let getSummary: ReturnType<typeof vi.fn<(from: string, to: string) => Observable<CalendarSummary>>>;
  let getDaySlots: ReturnType<typeof vi.fn<(date: string) => Observable<DaySlotsResponse>>>;
  let deleteException: ReturnType<typeof vi.fn<(id: string) => Observable<void>>>;
  let listExceptions: ReturnType<typeof vi.fn<(from: string, to: string) => Observable<AvailabilityExceptionDto[]>>>;
  let startScheduledAppointment: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.fn>;
  let realApi: Calendar;
  let calendarApi: Pick<Calendar, 'changeView' | 'gotoDate' | 'next' | 'prev' | 'today'>;

  const prefs = () => TestBed.inject(CalendarPreferencesStore);
  const care_ = () => TestBed.inject(ScheduledCareFacade) as unknown as Record<string, ReturnType<typeof vi.fn> & ReturnType<typeof signal<unknown>>>;
  const consultations = () => TestBed.inject(ActiveConsultationStore) as unknown as { active: ReturnType<typeof signal<unknown>> };
  const q = <T extends HTMLElement = HTMLElement>(selector: string): T | null =>
    fixture.nativeElement.querySelector(selector) as T | null;
  const qa = (selector: string): HTMLElement[] => [...fixture.nativeElement.querySelectorAll(selector)];
  const text = (): string => (fixture.nativeElement.textContent as string).replace(/\s+/g, ' ');
  const rowOf = (id: string): HTMLElement => q(`app-calendar-day [data-cal-id="${id}"]`)!.closest('.cal-day__item') as HTMLElement;
  const button = (scope: HTMLElement, label: string): HTMLButtonElement =>
    [...scope.querySelectorAll('button')].find((candidate) => candidate.textContent?.trim() === label) as HTMLButtonElement;
  const panel = () => fixture.debugElement.query(By.directive(CalendarDetailPanel)).componentInstance as CalendarDetailPanel;

  function press(key: string, target: EventTarget = document, init: KeyboardEventInit = {}): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(event);
    fixture.detectChanges();
    return event;
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /** Puts the real FullCalendar (hidden behind the custom day) on a Tunis day and tells the page, as FullCalendar does. */
  async function showDay(day = DAY): Promise<void> {
    realApi.changeView('timeGridDay', day);
    await settle();
    const start = at(day);
    const end = at(addDaysToKey(day, 1));
    component.onDatesSet({
      start,
      end,
      startStr: start.toISOString(),
      endStr: end.toISOString(),
      timeZone: 'Africa/Tunis',
      view: { type: 'timeGridDay', title: 'lundi 16 novembre 2026' },
    } as DatesSetInfo);
    component.dayNowMs.set(NOW);
    await settle();
  }

  async function showWeek(): Promise<void> {
    realApi.changeView('timeGridWeek', DAY);
    await settle();
  }

  function configure(realHttp: boolean): Promise<unknown> {
    getDoctorScheduledCare = vi.fn(() => of(agenda(dayItems())));
    getSummary = vi.fn(() => of(summaryFixture()));
    getDaySlots = vi.fn(() => of(daySlotsFixture()));
    deleteException = vi.fn(() => of(undefined));
    listExceptions = vi.fn(() => of([blockException()]));
    startScheduledAppointment = vi.fn(() => Promise.resolve({ kind: 'STARTED', consultation: { consultationId: 'consultation-1' } }));
    navigate = vi.fn(() => Promise.resolve(true));
    const api = {
      listRules: vi.fn(() => of([rule('MONDAY')])),
      listExceptions,
      addException: vi.fn(() => of(blockException())),
      deleteException,
    };

    return TestBed.configureTestingModule({
      imports: [CalendarPage],
      providers: [
        provideNzI18n(en_GB),
        provideNzIcons(OMNICARE_ICONS),
        { provide: Router, useValue: { navigate } },
        { provide: AppointmentApiService, useValue: api },
        ...(realHttp
          ? [provideHttpClient(), provideHttpClientTesting()]
          : [
              { provide: ScheduledCareApiService, useValue: { getDoctorScheduledCare } },
              { provide: CalendarSummaryService, useValue: { getSummary } },
              { provide: CalendarDaySlotsService, useValue: { getDaySlots } },
            ]),
        {
          provide: ScheduledCareFacade,
          useValue: {
            projectionInvalidationEpoch: signal(0),
            commandLoading: signal(false),
            appointmentLoading: signal(false),
            appointmentError: signal(null),
            activeAppointment: signal(null),
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
            active: signal(null),
            loading: signal(false),
            error: signal(null),
            starting: signal(false),
            startError: signal(null),
            clearStartError: vi.fn(),
            startScheduledAppointment,
          },
        },
        { provide: RealtimeService, useValue: { health: vi.fn(() => signal('live')) } },
      ],
    }).compileComponents();
  }

  function create(): void {
    fixture = TestBed.createComponent(CalendarPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    calendarApi = { changeView: vi.fn(), gotoDate: vi.fn(), next: vi.fn(), prev: vi.fn(), today: vi.fn() };
    const fullCalendar = fixture.debugElement.query(By.directive(FullCalendarComponent)).componentInstance as FullCalendarComponent;
    realApi = fullCalendar.getApi();
    vi.spyOn(fullCalendar, 'getApi').mockReturnValue(calendarApi as unknown as Calendar);
  }

  afterEach(() => {
    if (!prefs().shortcutsEnabled()) prefs().toggleShortcuts();
    if (prefs().discreet()) prefs().toggle();
    fixture.destroy();
    TestBed.resetTestingModule();
  });

  describe('with the services mocked', () => {
    beforeEach(async () => {
      await configure(false);
      create();
      getDoctorScheduledCare.mockClear();
      getSummary.mockClear();
      getDaySlots.mockClear();
    });

    describe('data: three calls for one Tunis day', () => {
      it('asks for the appointments, the summary (from = to = the day) and the slots of that Tunis day, once each', async () => {
        await showDay();

        expect(getDoctorScheduledCare).toHaveBeenCalledTimes(1);
        expect(getDoctorScheduledCare).toHaveBeenCalledWith(at(DAY).toISOString(), at(NEXT_DAY).toISOString());
        expect(getSummary).toHaveBeenCalledTimes(1);
        expect(getSummary).toHaveBeenCalledWith(DAY, DAY);
        expect(getDaySlots).toHaveBeenCalledTimes(1);
        expect(getDaySlots).toHaveBeenCalledWith(DAY);
      });

      it('draws the custom day and keeps FullCalendar out of sight, without events', async () => {
        await showDay();

        expect(q('app-calendar-day')).toBeTruthy();
        expect(q('.doctor-calendar-demo__calendar-host')?.classList).toContain('doctor-calendar-demo__calendar-host--hidden');
        expect(component.presentation().events).toEqual([]);
        expect(q('.doctor-calendar-demo__summary')).toBeNull();
      });

      it('does not ask for the summary or the slots outside the day view, and asks again when the day is re-entered', async () => {
        await showWeek();
        expect(getSummary).not.toHaveBeenCalled();
        expect(getDaySlots).not.toHaveBeenCalled();
        expect(q('app-calendar-day')).toBeNull();
        expect(q('.doctor-calendar-demo__calendar-host')?.classList).not.toContain('doctor-calendar-demo__calendar-host--hidden');

        await showDay();
        expect(getDaySlots).toHaveBeenCalledTimes(1);
        await showWeek();
        await showDay();
        expect(getDaySlots).toHaveBeenCalledTimes(2);
        expect(getSummary).toHaveBeenCalledTimes(2);
      });

      it('asks for the three sources of the next Tunis day when the doctor goes there', async () => {
        await showDay();
        getDoctorScheduledCare.mockClear();
        getSummary.mockClear();
        getDaySlots.mockClear();

        await showDay(NEXT_DAY);

        expect(getDoctorScheduledCare).toHaveBeenCalledWith(at(NEXT_DAY).toISOString(), at('2026-11-18').toISOString());
        expect(getSummary).toHaveBeenCalledWith(NEXT_DAY, NEXT_DAY);
        expect(getDaySlots).toHaveBeenCalledWith(NEXT_DAY);
      });

      it('shows the answers as received: header, rows, free time and the summary card', async () => {
        await showDay();

        expect(q('.cal-day__slots')?.textContent).toContain('6 / 16 créneaux réservés');
        expect(q('.cal-day__level')?.textContent?.trim()).toBe('Disponible');
        expect(q('.cal-day__chip--request')?.textContent?.trim()).toBe('2 demandes en attente');
        expect(qa('app-calendar-day [data-cal-id]')).toHaveLength(4);
        expect(qa('.cal-day__free-label').map((element) => element.textContent?.trim())).toEqual([
          'Libre · 11:00 – 12:30',
          'Libre · 14:30 – 16:00',
          'Libre · 17:00 – 17:30',
        ]);
        const last = qa('.cal-day__summary-line').pop()!;
        expect(`${last.querySelector('dt')?.textContent?.trim()} ${last.querySelector('dd')?.textContent?.trim()}`).toBe('Créneaux libres 7');
      });

      it('does not recompute: a summary and slot states that disagree with the rows are shown as sent', async () => {
        const base = summaryFixture();
        const sent: CalendarSummary = {
          ...base,
          days: base.days.map((day) => (day.date === DAY ? { ...day, takenSlots: 11, bookableSlots: 12, level: 'FULL' as const, loadPercent: 5, pendingRequestCount: 0 } : day)),
        };
        getSummary.mockReturnValue(of(sent));
        // Slot 10:30 has an appointment (a3) but the API calls it FREE: it is shown as free, the page does not argue.
        getDaySlots.mockReturnValue(of({ ...daySlotsFixture(), slots: [{ start: '10:30', end: '11:00', state: 'FREE' }, { start: '11:00', end: '11:30', state: 'FREE' }] }));
        await showDay();

        expect(q('.cal-day__slots')?.textContent).toContain('11 / 12 créneaux réservés');
        expect(q('.cal-day__level')?.textContent?.trim()).toBe('Complet');
        expect(q('.cal-day__chip--request')).toBeNull();
        expect(qa('.cal-day__free-label').map((element) => element.textContent?.trim())).toEqual(['Libre · 10:30 – 11:30']);
      });

      it('shows TAKEN and PAST slots as nothing (never as free time)', async () => {
        getDaySlots.mockReturnValue(of({ ...daySlotsFixture(), slots: [{ start: '08:00', end: '08:30', state: 'PAST' }, { start: '08:30', end: '09:00', state: 'TAKEN' }] }));
        await showDay();

        expect(qa('.cal-day__free')).toHaveLength(0);
      });
    });

    describe('states', () => {
      it('shows skeleton rows while the appointments load, then the rows', async () => {
        const answer = new Subject<DoctorScheduledCareAgenda>();
        getDoctorScheduledCare.mockReturnValue(answer);
        await showDay();

        expect(qa('.cal-day__skeleton--row')).toHaveLength(4);
        answer.next(agenda(dayItems()));
        fixture.detectChanges();
        expect(qa('.cal-day__skeleton--row')).toHaveLength(0);
        expect(qa('app-calendar-day [data-cal-id]')).toHaveLength(4);
      });

      it('shows each source’s own error and « Réessayer », and the rest of the day still renders', async () => {
        getDaySlots.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
        await showDay();

        expect(q('.cal-day__banner--slots')?.textContent).toContain('Impossible de charger les créneaux libres.');
        expect(qa('app-calendar-day [data-cal-id]')).toHaveLength(4);
        expect(q('.cal-day__break')).not.toBeNull();

        getDaySlots.mockReturnValue(of(daySlotsFixture()));
        button(q('.cal-day__banner--slots')!, 'Réessayer').click();
        await settle();

        expect(getDaySlots).toHaveBeenCalledTimes(2);
        expect(getSummary).toHaveBeenCalledTimes(1);
        expect(q('.cal-day__banner--slots')).toBeNull();
        expect(qa('.cal-day__free')).toHaveLength(3);
      });

      it('summary error: « Impossible de charger le résumé de la journée. » with « Réessayer » that reloads only the summary', async () => {
        getSummary.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
        await showDay();

        expect(q('.cal-day__inline-error')?.textContent).toContain('Impossible de charger le résumé de la journée.');
        getSummary.mockReturnValue(of(summaryFixture()));
        button(q('.cal-day__inline-error')!, 'Réessayer').click();
        await settle();

        expect(getSummary).toHaveBeenCalledTimes(2);
        expect(getDaySlots).toHaveBeenCalledTimes(1);
        expect(q('.cal-day__slots')?.textContent).toContain('6 / 16 créneaux réservés');
      });

      it('appointments error: « Impossible de charger les rendez-vous. » with « Réessayer »', async () => {
        getDoctorScheduledCare.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
        await showDay();

        expect(q('app-calendar-day')?.textContent).toContain('Impossible de charger les rendez-vous.');
        // Shown once, in the day view (the generic page banner is replaced).
        expect(qa('.doctor-calendar-demo__state--error')).toHaveLength(0);
        getDoctorScheduledCare.mockReturnValue(of(agenda(dayItems())));
        button(q('app-calendar-day .cal-day__banner')!, 'Réessayer').click();
        await settle();

        expect(qa('app-calendar-day [data-cal-id]')).toHaveLength(4);
      });

      it('shows « Aucun rendez-vous · n créneaux libres » for a day without appointment (CAL-FIX-2 fix 7)', async () => {
        getDoctorScheduledCare.mockReturnValue(of(agenda([])));
        await showDay();

        expect(q('.cal-day__empty')?.textContent).toMatch(/Aucun rendez-vous · \d+ créneaux libres/);
        expect(qa('.cal-day__free')).toHaveLength(3);
      });

      it('shows « Journée fermée » for a closed day and « Prolonger la journée » opens the existing exception form, pre-filled', async () => {
        expect(fixtureDay('2026-11-15').level).toBe('CLOSED');
        getDaySlots.mockReturnValue(of({ ...daySlotsFixture(), date: '2026-11-15', slots: [] }));
        getDoctorScheduledCare.mockReturnValue(of(agenda([])));
        await showDay('2026-11-15');

        expect(q('.cal-day__closed-day strong')?.textContent).toBe('Journée fermée');
        button(q('.cal-day__closed-day')!, 'Prolonger la journée').click();
        fixture.detectChanges();

        expect(component.exceptionFormOpen()).toBe(true);
        expect(component.exceptionForm.getRawValue()).toMatchObject({ type: 'EXTRA', scope: 'TIME_WINDOW', date: '2026-11-15' });
      });
    });

    describe('row actions', () => {
      it('« Démarrer » is only on the next CONFIRMED appointment that can start, and runs the panel’s command', async () => {
        await showDay();

        const starts = qa('app-calendar-day button').filter((candidate) => candidate.textContent?.trim() === 'Démarrer');
        expect(starts).toHaveLength(1);
        expect(rowOf('a3').contains(starts[0])).toBe(true);

        starts[0].click();
        await settle();

        expect(startScheduledAppointment).toHaveBeenCalledTimes(1);
        expect(startScheduledAppointment).toHaveBeenCalledWith('a3', 3);
        expect(navigate).toHaveBeenCalledWith(['/doctor', 'consultation', 'consultation-1']);
      });

      it('« Démarrer » is not offered while another consultation is running', async () => {
        consultations().active.set({ consultationId: 'other', sourceType: 'SCHEDULED_APPOINTMENT', sourceId: 'zzz' });
        await showDay();

        expect(qa('app-calendar-day button').some((candidate) => candidate.textContent?.trim() === 'Démarrer')).toBe(false);
      });

      it('« Démarrer » does not navigate when the start failed', async () => {
        startScheduledAppointment.mockResolvedValue({ kind: 'FAILED', consultation: null });
        await showDay();

        button(rowOf('a3'), 'Démarrer').click();
        await settle();

        expect(startScheduledAppointment).toHaveBeenCalledTimes(1);
        expect(navigate).not.toHaveBeenCalled();
      });

      it('« Accepter » opens the request in the facade, then calls acceptRequest() exactly once when it is loaded', async () => {
        await showDay();

        button(rowOf('r1'), 'Accepter').click();
        await settle();
        expect(care_()['openRequest']).toHaveBeenCalledWith('r1');
        // Not accepted before the request is loaded.
        expect(care_()['acceptRequest']).not.toHaveBeenCalled();

        care_()['activeRequest'].set({ requestId: 'r1', availableActions: ['ACCEPT_REQUEST', 'DECLINE_REQUEST'] });
        await settle();

        expect(care_()['acceptRequest']).toHaveBeenCalledTimes(1);
        expect(care_()['closeRequest']).toHaveBeenCalledTimes(1);
        await settle();
        expect(care_()['acceptRequest']).toHaveBeenCalledTimes(1);
      });

      it('« Accepter » never accepts when the request cannot be loaded', async () => {
        await showDay();

        button(rowOf('r1'), 'Accepter').click();
        care_()['requestError'].set('Impossible de charger la demande.');
        await settle();

        expect(care_()['acceptRequest']).not.toHaveBeenCalled();
        expect(component.acceptingRequestId()).toBeNull();
        expect(q('app-calendar-day .cal-day__banner')?.textContent).toContain('Impossible de charger la demande.');
      });

      it('« Refuser » opens the panel on its two-step refusal and refuses nothing', async () => {
        await showDay();

        button(rowOf('r1'), 'Refuser').click();
        await settle();

        expect(panel().open()).toBe(true);
        expect(panel().mode()).toBe('request');
        expect(panel().showDecline()).toBe(true);
        expect(panel().declineReason()).toBe('');
        expect(care_()['openRequest']).toHaveBeenCalledWith('r1');
        expect(care_()['declineRequest']).not.toHaveBeenCalled();
        expect(care_()['acceptRequest']).not.toHaveBeenCalled();
      });

      it('a row click and « ⋯ » open the side panel on that appointment or request', async () => {
        await showDay();

        q<HTMLButtonElement>('app-calendar-day [data-cal-id="a4"]')!.click();
        await settle();
        expect(care_()['openAppointment']).toHaveBeenCalledTimes(1);
        expect(care_()['openAppointment'].mock.calls[0][0]).toBe('a4');

        rowOf('r1').querySelector<HTMLButtonElement>('.cal-day__btn--icon')!.click();
        await settle();
        expect(care_()['openRequest']).toHaveBeenCalledWith('r1');
        expect(component.selectedAppointmentId()).toBe('r1');
      });

      it('« + Ajouter » opens the booking drawer preselected on the start of that free row', async () => {
        await showDay();

        button(qa('.cal-day__free')[1], '+ Ajouter').click();
        fixture.detectChanges();

        expect(component.quickBookingOpen()).toBe(true);
        expect(component.quickBookingStart()).toBe(at(DAY, '14:30').toISOString());
      });

      it('the next-patient « Voir le dossier » opens the panel on that appointment (practice patients only)', async () => {
        await showDay();

        button(q('.cal-day__next')!, 'Voir le dossier').click();
        await settle();

        expect(care_()['openAppointment'].mock.calls[0][0]).toBe('a3');
        expect(panel().open()).toBe(true);
      });

      it('« Rouvrir » on a closed window confirms first, then deletes that exception and reloads the day', async () => {
        await showDay();
        expect(q('.cal-day__closed')?.textContent).toContain('Fermé · 16:00 – 17:00');
        const popconfirm = fixture.debugElement.query(By.directive(NzPopconfirmDirective)).injector.get(NzPopconfirmDirective);

        button(q('.cal-day__closed')!, 'Rouvrir').click();
        fixture.detectChanges();
        expect(deleteException).not.toHaveBeenCalled();

        getSummary.mockClear();
        getDaySlots.mockClear();
        popconfirm.nzOnConfirm.emit();
        await settle();

        expect(deleteException).toHaveBeenCalledTimes(1);
        expect(deleteException).toHaveBeenCalledWith('ex1');
        expect(getSummary).toHaveBeenCalledWith(DAY, DAY);
        expect(getDaySlots).toHaveBeenCalledWith(DAY);
      });

      it('the break row sends « Modifier » to the schedule settings', async () => {
        await showDay();

        button(q('.cal-day__break')!, 'Modifier').click();

        expect(navigate).toHaveBeenCalledWith(['/doctor/settings'], { queryParams: { tab: 'schedule' } });
      });
    });

    describe('keyboard: no shortcut changes a patient’s appointment', () => {
      it('A, R, S, C, X, Entrée and Espace pressed on the page accept, refuse, start or cancel nothing', async () => {
        await showDay();

        for (const key of ['a', 'A', 'r', 'R', 'c', 'C', 'x', 'X', 'Enter', ' ', 'Delete', 'Backspace']) press(key);

        expect(care_()['acceptRequest']).not.toHaveBeenCalled();
        expect(care_()['declineRequest']).not.toHaveBeenCalled();
        expect(care_()['cancelAppointment']).not.toHaveBeenCalled();
        expect(startScheduledAppointment).not.toHaveBeenCalled();
        expect(deleteException).not.toHaveBeenCalled();
      });

      it('← and → go to the previous and the next day, and nothing else', async () => {
        await showDay();

        press('ArrowLeft');
        press('ArrowRight');

        expect(calendarApi.prev).toHaveBeenCalledTimes(1);
        expect(calendarApi.next).toHaveBeenCalledTimes(1);
        expect(care_()['acceptRequest']).not.toHaveBeenCalled();
      });

      it('Entrée on a focused row opens it once (the row is a real button: no second open from the page)', async () => {
        await showDay();
        const open = q<HTMLButtonElement>('app-calendar-day [data-cal-id="a4"]')!;
        open.focus();

        press('Enter', open);
        expect(care_()['openAppointment']).not.toHaveBeenCalled();
        open.click(); // what the browser does for Entrée on a button
        await settle();

        expect(care_()['openAppointment']).toHaveBeenCalledTimes(1);
      });

      it('Entrée while the focus is on « Accepter » only does what the button does, and nothing is triggered by the page', async () => {
        await showDay();
        const accept = button(rowOf('r1'), 'Accepter');
        accept.focus();

        press('Enter', accept);

        expect(care_()['acceptRequest']).not.toHaveBeenCalled();
        expect(care_()['openRequest']).not.toHaveBeenCalled();
      });

      it('the shortcuts are off with the CAL-4 switch: arrows do nothing', async () => {
        await showDay();
        prefs().toggleShortcuts();
        fixture.detectChanges();

        press('ArrowLeft');
        press('ArrowRight');
        press('t');

        expect(calendarApi.prev).not.toHaveBeenCalled();
        expect(calendarApi.next).not.toHaveBeenCalled();
        expect(calendarApi.today).not.toHaveBeenCalled();
      });

      it('Échap closes the side panel opened from a row (the panel keeps its own keyboard handling)', async () => {
        await showDay();
        button(rowOf('r1'), 'Refuser').click();
        await settle();
        expect(panel().open()).toBe(true);

        panel().close();
        await settle();

        expect(panel().open()).toBe(false);
      });
    });

    describe('now marker', () => {
      it('shows the red marker with « Maintenant, 10:20 » on today only', async () => {
        await showDay();
        expect(qa('.cal-day__now')).toHaveLength(1);
        expect(q('.cal-day__now')?.getAttribute('aria-label')).toBe('Maintenant, 10:20');
        expect(q('.cal-day__now-marker')).not.toBeNull();

        component.dayNowMs.set(at('2026-11-15', '10:20').getTime());
        fixture.detectChanges();
        expect(q('.cal-day__now')).toBeNull();
        expect(q('.cal-day__now-marker')).toBeNull();
      });

      it('shows no marker on a day that is not today', async () => {
        getDoctorScheduledCare.mockReturnValue(of(agenda([])));
        await showDay(NEXT_DAY);

        expect(q('.cal-day__now')).toBeNull();
        expect(q('.cal-day__next')).toBeNull();
      });
    });

    describe('Mode discret, filters and search (CAL-4)', () => {
      it('shows initials in the rows, the aside and the timeline label', async () => {
        await showDay();
        prefs().toggle();
        fixture.detectChanges();

        expect(text()).not.toContain('Karim');
        expect(text()).not.toContain('Leila');
        expect(rowOf('a3').textContent).toContain('L. G.');
        expect(q('.cal-day__next')?.textContent).toContain('L. G.');
        expect(q('.cal-day__timeline')?.getAttribute('aria-label')).toContain('L. G.');
      });

      it('hides the rows of a state switched off in « Filtres »', async () => {
        await showDay();
        component.handleViewAction({ kind: 'TOGGLE_FILTER', state: 'request' });
        fixture.detectChanges();

        expect(q('app-calendar-day [data-cal-id="r1"]')).toBeNull();
        expect(q('app-calendar-day [data-cal-id="a3"]')).not.toBeNull();
        component.handleViewAction({ kind: 'RESET_FILTERS' });
        fixture.detectChanges();
        expect(q('app-calendar-day [data-cal-id="r1"]')).not.toBeNull();
      });

      it('dims the rows that do not match the search; choosing a result scrolls to the row and opens the panel', async () => {
        await showDay();
        component.handleViewAction({ kind: 'SET_SEARCH', query: 'leila' });
        fixture.detectChanges();

        expect(rowOf('a3').classList).not.toContain('cal-day__item--dim');
        expect(rowOf('a1').classList).toContain('cal-day__item--dim');
        expect(rowOf('r1').classList).toContain('cal-day__item--dim');

        const open = q<HTMLButtonElement>('app-calendar-day [data-cal-id="a3"]')!;
        let scrolled = 0;
        open.scrollIntoView = () => {
          scrolled += 1;
        };
        component.handleViewAction({ kind: 'OPEN_ITEM', resource: 'appointment', id: 'a3' });
        await settle();

        expect(scrolled).toBe(1);
        expect(care_()['openAppointment'].mock.calls[0][0]).toBe('a3');
      });

      it('the search is available in the day view (it is only disabled in the month)', async () => {
        await showDay();
        expect(q<HTMLInputElement>('#cal-search-input')?.disabled).toBeFalsy();
      });
    });

    describe('the other views', () => {
      it('the week keeps FullCalendar; the custom day is only in the day view', async () => {
        await showDay();
        expect(fixture.debugElement.query(By.directive(CalendarDay))).toBeTruthy();

        await showWeek();
        expect(fixture.debugElement.query(By.directive(CalendarDay))).toBeNull();
        expect(q('.doctor-calendar-demo__calendar-host')?.classList).not.toContain('doctor-calendar-demo__calendar-host--hidden');
      });
    });

    describe('Tunis days whatever the machine zone', () => {
      it('an appointment at 23:30 Tunis belongs to its Tunis day, and the summary and slots ask for that day', async () => {
        getDoctorScheduledCare.mockReturnValue(of(agenda([care('late', '23:30', named('Nadia Ben Salah'))])));
        await showDay();

        expect(q('app-calendar-day [data-cal-id="late"]')).not.toBeNull();
        expect(getSummary).toHaveBeenCalledWith(DAY, DAY);
        expect(rowOf('late').closest('li')?.querySelector('.cal-day__time')?.textContent?.trim()).toBe('23:30');
      });

      it('an appointment of the next Tunis day that is still loaded is not shown on this day', async () => {
        getDoctorScheduledCare.mockReturnValue(of(agenda([care('tomorrow', '00:30', {}, NEXT_DAY), care('today', '09:00')])));
        await showDay();

        expect(q('app-calendar-day [data-cal-id="tomorrow"]')).toBeNull();
        expect(q('app-calendar-day [data-cal-id="today"]')).not.toBeNull();
      });
    });
  });

  describe('over HTTP (the three calls of one Tunis day)', () => {
    let http: HttpTestingController;

    beforeEach(async () => {
      await configure(true);
      create();
      http = TestBed.inject(HttpTestingController);
      // Whatever the first week load asked for, then start clean.
      http.match(() => true);
    });

    it('sends exactly three requests for the day: scheduled-care, calendar-summary and day-slots, with the right Tunis day', async () => {
      await showDay();

      const care = http.match((request) => request.url === '/api/v1/doctor/scheduled-care' && request.params.get('from') === at(DAY).toISOString());
      const summary = http.match((request) => request.url === '/api/v1/doctor/scheduled-care/calendar-summary');
      const slots = http.match((request) => request.url === '/api/v1/doctor/scheduled-care/day-slots');

      expect(care).toHaveLength(1);
      expect(care[0].request.params.get('to')).toBe(at(NEXT_DAY).toISOString());
      expect(summary).toHaveLength(1);
      expect(summary[0].request.urlWithParams).toBe('/api/v1/doctor/scheduled-care/calendar-summary?from=2026-11-16&to=2026-11-16');
      expect(slots).toHaveLength(1);
      expect(slots[0].request.urlWithParams).toBe('/api/v1/doctor/scheduled-care/day-slots?date=2026-11-16');
      // Nothing else was requested for the day (rules and exceptions go through the mocked appointment API).
      http.verify();

      care[0].flush(agenda(dayItems()));
      summary[0].flush(summaryFixture());
      slots[0].flush(daySlotsFixture());
      await settle();

      expect(q('.cal-day__slots')?.textContent).toContain('6 / 16 créneaux réservés');
      expect(qa('.cal-day__free-label')).toHaveLength(3);
    });

    it('a failed day-slots call (the endpoint does not exist yet) shows the inline error and the rest of the day', async () => {
      await showDay();
      http.expectOne((request) => request.url === '/api/v1/doctor/scheduled-care/calendar-summary').flush(summaryFixture());
      http
        .expectOne((request) => request.url === '/api/v1/doctor/scheduled-care' && request.params.get('from') === at(DAY).toISOString())
        .flush(agenda(dayItems()));
      http.expectOne((request) => request.url === '/api/v1/doctor/scheduled-care/day-slots').flush('not found', { status: 404, statusText: 'Not Found' });
      await settle();

      expect(q('.cal-day__banner--slots')?.textContent).toContain('Impossible de charger les créneaux libres.');
      expect(qa('app-calendar-day [data-cal-id]')).toHaveLength(4);
      expect(q('.cal-day__break')).not.toBeNull();
      expect(q('.cal-day__slots')?.textContent).toContain('6 / 16 créneaux réservés');
    });
  });
});
