import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { DatesSetInfo, FullCalendarComponent } from '@fullcalendar/angular';
import { Calendar } from 'fullcalendar';
import { en_GB, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { Observable, Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OMNICARE_ICONS } from '../../../app.icons';
import { RealtimeService } from '../../../core/realtime/realtime.service';
import type {
  AvailabilityExceptionDto,
  AvailabilityExceptionRequestDto,
  AvailabilityRuleDto,
} from '../appointment-api.models';
import { AppointmentApiService } from '../appointment-api.service';
import { ActiveConsultationStore } from '../active-consultation.store';
import { ScheduledCareApiService } from '../scheduled-care/scheduled-care-api.service';
import { ScheduledCareFacade } from '../scheduled-care/scheduled-care.facade';
import type { DoctorScheduledCareAgenda } from '../scheduled-care/scheduled-care.models';
import { CalendarMonth } from './calendar-month';
import { CalendarPage } from './calendar-page';
import { CalendarPreferencesStore } from './calendar-preferences.store';
import type { CalendarSummary } from './calendar-summary.models';
import { CalendarSummaryService, SUMMARY_BAD_RANGE_ERROR } from './calendar-summary.service';
import { CalendarToolbar } from './calendar-toolbar';
import { at } from './calendar-time.testing';
import { summaryFixture } from './testing/calendar-summary.testing';

const GRID_START = at('2026-10-26');
const GRID_END = at('2026-12-07'); // exclusive: Sunday 6 December 24:00

describe('CalendarPage — month view (CAL-5)', () => {
  let fixture: ComponentFixture<CalendarPage>;
  let component: CalendarPage;
  let getSummary: ReturnType<typeof vi.fn<(from: string, to: string) => Observable<CalendarSummary>>>;
  let addException: ReturnType<typeof vi.fn<(input: AvailabilityExceptionRequestDto) => Observable<AvailabilityExceptionDto>>>;
  let getDoctorScheduledCare: ReturnType<typeof vi.fn<(from: string, to: string) => Observable<DoctorScheduledCareAgenda>>>;
  let realApi: Calendar;
  let calendarApi: Pick<Calendar, 'changeView' | 'gotoDate' | 'next' | 'prev' | 'today'>;

  const prefs = () => TestBed.inject(CalendarPreferencesStore);
  const q = <T extends HTMLElement = HTMLElement>(selector: string): T | null =>
    fixture.nativeElement.querySelector(selector) as T | null;
  const qa = (selector: string): HTMLElement[] => [...fixture.nativeElement.querySelectorAll(selector)];
  const cell = (day: string): HTMLElement => q(`app-calendar-month [role="gridcell"][data-day="${day}"]`) as HTMLElement;
  const monthComponent = () => fixture.debugElement.query(By.directive(CalendarMonth)).componentInstance as CalendarMonth;
  const toolbar = () => fixture.debugElement.query(By.directive(CalendarToolbar)).componentInstance as CalendarToolbar;

  function press(key: string, target: EventTarget = document, init: KeyboardEventInit = {}): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(event);
    fixture.detectChanges();
    return event;
  }

  /**
   * Puts the real FullCalendar (hidden behind the custom month) on the month of 16 November 2026 and tells the
   * page, as FullCalendar does. Its real range is checked too: it must be 26 Oct → 6 Dec.
   */
  async function showMonth(): Promise<void> {
    realApi.changeView('dayGridMonth', '2026-11-16');
    await settle();
    component.onDatesSet({
      start: GRID_START,
      end: GRID_END,
      startStr: GRID_START.toISOString(),
      endStr: GRID_END.toISOString(),
      timeZone: 'Africa/Tunis',
      view: { type: 'dayGridMonth', title: 'novembre 2026' },
    } as DatesSetInfo);
    await settle();
  }

  async function showWeek(): Promise<void> {
    realApi.changeView('timeGridWeek', '2026-11-16');
    await settle();
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const rule = (dayOfWeek: AvailabilityRuleDto['dayOfWeek']): AvailabilityRuleDto => ({
    dayOfWeek,
    active: true,
    startTime: '08:00',
    endTime: '18:00',
    pauseStart: '12:30',
    pauseEnd: '14:00',
    slotDurationMinutes: 30,
  });

  beforeEach(async () => {
    getSummary = vi.fn(() => of(summaryFixture()));
    addException = vi.fn((input) => of({ id: 'created', ...input } as unknown as AvailabilityExceptionDto));
    getDoctorScheduledCare = vi.fn(() => of({ generatedAt: '', from: '', to: '', items: [] }));
    const api = {
      listRules: vi.fn(() => of([rule('MONDAY')])),
      listExceptions: vi.fn(() => of([])),
      addException,
      deleteException: vi.fn(() => of(undefined)),
    };

    await TestBed.configureTestingModule({
      imports: [CalendarPage],
      providers: [
        provideNzI18n(en_GB),
        provideNzIcons(OMNICARE_ICONS),
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: AppointmentApiService, useValue: api },
        { provide: ScheduledCareApiService, useValue: { getDoctorScheduledCare } },
        { provide: CalendarSummaryService, useValue: { getSummary } },
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
            startScheduledAppointment: vi.fn(),
          },
        },
        { provide: RealtimeService, useValue: { health: vi.fn(() => signal('live')) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CalendarPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    calendarApi = { changeView: vi.fn(), gotoDate: vi.fn(), next: vi.fn(), prev: vi.fn(), today: vi.fn() };
    const fullCalendar = fixture.debugElement.query(By.directive(FullCalendarComponent))
      .componentInstance as FullCalendarComponent;
    realApi = fullCalendar.getApi();
    vi.spyOn(fullCalendar, 'getApi').mockReturnValue(calendarApi as unknown as Calendar);
    getSummary.mockClear();
  });

  afterEach(() => {
    if (!prefs().shortcutsEnabled()) prefs().toggleShortcuts();
    fixture.destroy();
    TestBed.resetTestingModule();
  });

  describe('data', () => {
    it('asks for the calendar summary of the visible grid: first Monday to last Sunday, in Tunis dates', async () => {
      await showMonth();

      expect(getSummary).toHaveBeenCalledTimes(1);
      expect(getSummary).toHaveBeenCalledWith('2026-10-26', '2026-12-06');
      expect(component.monthInput().status).toBe('ready');
      expect(component.monthInput().gridKeys).toHaveLength(42);
      expect(component.monthInput().referenceMonth).toBe('2026-11');
    });

    it('draws the month with the custom grid and keeps FullCalendar out of sight', async () => {
      await showMonth();

      expect(q('app-calendar-month [role="grid"]')).toBeTruthy();
      expect(qa('app-calendar-month [role="gridcell"]')).toHaveLength(42);
      expect(q('.doctor-calendar-demo__calendar-host')?.classList).toContain('doctor-calendar-demo__calendar-host--hidden');
      expect(component.presentation().events).toEqual([]);
    });

    it('does not ask for the summary outside the month view, and asks again when the month is re-entered', async () => {
      await showWeek();
      expect(getSummary).not.toHaveBeenCalled();
      expect(q('app-calendar-month')).toBeNull();

      await showMonth();
      expect(getSummary).toHaveBeenCalledTimes(1);
      await showWeek();
      await showMonth();
      expect(getSummary).toHaveBeenCalledTimes(2);
    });

    it('shows skeleton cells until the answer arrives', async () => {
      const answer = new Subject<CalendarSummary>();
      getSummary.mockReturnValue(answer);
      await showMonth();

      expect(component.monthInput().status).toBe('loading');
      expect(qa('.cal-month__cell--skeleton')).toHaveLength(42);
      answer.next(summaryFixture());
      fixture.detectChanges();
      expect(qa('.cal-month__cell--skeleton')).toHaveLength(0);
      expect(qa('app-calendar-month [role="gridcell"]')).toHaveLength(42);
    });

    it('shows « Impossible de charger le mois. » with « Réessayer », and a retry asks again', async () => {
      getSummary.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
      await showMonth();

      expect(q('.cal-month__error')?.textContent).toContain('Impossible de charger le mois.');
      getSummary.mockReturnValue(of(summaryFixture()));
      qa('.cal-month__error button').find((button) => button.textContent?.includes('Réessayer'))?.click();
      fixture.detectChanges();

      expect(getSummary).toHaveBeenCalledTimes(2);
      expect(q('.cal-month__error')).toBeNull();
      expect(qa('app-calendar-month [role="gridcell"]')).toHaveLength(42);
    });

    it('shows the French message of a 400', async () => {
      getSummary.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 400 })));
      await showMonth();

      expect(q('.cal-month__error')?.textContent).toContain(SUMMARY_BAD_RANGE_ERROR);
    });
  });

  describe('opening a day, quick create', () => {
    it('a day opens the Jour view on that date', async () => {
      await showMonth();
      cell('2026-11-19').click();

      expect(component.viewMode()).toBe('day');
      expect(calendarApi.changeView).toHaveBeenCalledWith('timeGridDay');
      expect(calendarApi.gotoDate).toHaveBeenCalledWith('2026-11-19');
    });

    it('« + Rendez-vous » opens the booking drawer on that day, at its first working hour (Tunis)', async () => {
      await showMonth();
      component.handleViewAction({ kind: 'NEW_APPOINTMENT_ON', date: '2026-11-17' });

      expect(component.quickBookingOpen()).toBe(true);
      expect(component.quickBookingStart()).toBe(at('2026-11-17', '08:00').toISOString());
    });

    it('the « Raccourcis clavier » card opens the CAL-4 window', async () => {
      await showMonth();
      qa('[aria-labelledby="cal-month-shortcuts-title"] button')[0].click();
      fixture.detectChanges();

      expect(toolbar().shortcutsOpen()).toBe(true);
    });
  });

  describe('day menu uses the existing exception flows', () => {
    const open = (day: string, label: string): void => {
      cell(day).querySelector<HTMLButtonElement>('.cal-month__menu-btn')?.click();
      fixture.detectChanges();
      qa('[role="menuitem"]').find((item) => item.textContent?.trim() === label)?.click();
      fixture.detectChanges();
    };

    it('« Fermer la journée » opens the exception form for that day (full day block); saving reloads the summary', async () => {
      await showMonth();
      component.rules.set([rule('MONDAY')]);
      open('2026-11-16', 'Fermer la journée');

      expect(component.exceptionFormOpen()).toBe(true);
      expect(component.exceptionForm.getRawValue()).toMatchObject({ type: 'BLOCK', scope: 'FULL_DAY', date: '2026-11-16' });

      component.saveException();
      expect(addException).toHaveBeenCalledWith({
        exceptionDate: '2026-11-16',
        type: 'BLOCK',
        startTime: '08:00',
        endTime: '18:00',
        reason: null,
      });
      expect(getSummary).toHaveBeenCalledTimes(2); // once on entering the month, once after the change
      expect(getSummary).toHaveBeenLastCalledWith('2026-10-26', '2026-12-06');
    });

    it('« Prolonger la journée » prefills an exceptional opening after the last working hour', async () => {
      await showMonth();
      open('2026-11-16', 'Prolonger la journée');

      expect(component.exceptionFormOpen()).toBe(true);
      expect(component.exceptionForm.getRawValue()).toMatchObject({
        type: 'EXTRA',
        scope: 'TIME_WINDOW',
        date: '2026-11-16',
        startTime: '18:00',
        endTime: '19:00',
      });
      component.saveException();
      expect(addException).toHaveBeenCalledWith({
        exceptionDate: '2026-11-16',
        type: 'EXTRA',
        startTime: '18:00',
        endTime: '19:00',
        reason: null,
      });
    });

    it('« Ajouter une pause » prefills a blocked window on the day\'s break', async () => {
      await showMonth();
      open('2026-11-16', 'Ajouter une pause');

      expect(component.exceptionForm.getRawValue()).toMatchObject({
        type: 'BLOCK',
        scope: 'TIME_WINDOW',
        date: '2026-11-16',
        startTime: '12:30',
        endTime: '14:00',
      });
    });

    it('never shows « Patients à prévenir »', async () => {
      await showMonth();
      cell('2026-11-16').querySelector<HTMLButtonElement>('.cal-month__menu-btn')?.click();
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).not.toContain('Patients à prévenir');
    });
  });

  describe('keyboard (CAL-4 rules apply)', () => {
    beforeEach(async () => {
      await showMonth();
      getDoctorScheduledCare.mockClear(); // the page's own range load is not what these tests count
      cell('2026-11-16').focus();
      fixture.detectChanges();
    });

    it('arrows move the focus between days instead of changing the period', async () => {
      const event = press('ArrowRight', cell('2026-11-16'));

      expect((document.activeElement as HTMLElement).getAttribute('data-day')).toBe('2026-11-17');
      expect(event.defaultPrevented).toBe(true);
      expect(calendarApi.next).not.toHaveBeenCalled();
    });

    it('arrows still change the period when the focus is not on a day', async () => {
      press('ArrowRight', document.body);

      expect(calendarApi.next).toHaveBeenCalledTimes(1);
    });

    it('Espace opens and closes the preview of the focused day, Échap closes it', async () => {
      press(' ', cell('2026-11-16'));
      expect(q('.cal-month__preview')).toBeTruthy();
      expect(getDoctorScheduledCare).toHaveBeenCalledTimes(1);
      expect(getDoctorScheduledCare).toHaveBeenCalledWith(at('2026-11-16').toISOString(), at('2026-11-17').toISOString());

      press(' ', cell('2026-11-16'));
      expect(q('.cal-month__preview')).toBeNull();

      press(' ', cell('2026-11-16'));
      expect(q('.cal-month__preview')).toBeTruthy();
      press('Escape', cell('2026-11-16'));
      expect(q('.cal-month__preview')).toBeNull();
      expect(getDoctorScheduledCare).toHaveBeenCalledTimes(1); // one day, once
    });

    it('Entrée opens the day', async () => {
      press('Enter', cell('2026-11-16'));

      expect(component.viewMode()).toBe('day');
      expect(calendarApi.changeView).toHaveBeenCalledWith('timeGridDay');
      expect(calendarApi.gotoDate).toHaveBeenCalledWith('2026-11-16');
    });

    it('is off with the CAL-4 switch: nothing moves, opens or previews', async () => {
      prefs().toggleShortcuts();
      fixture.detectChanges();

      expect(press('ArrowRight', cell('2026-11-16')).defaultPrevented).toBe(false);
      expect((document.activeElement as HTMLElement).getAttribute('data-day')).toBe('2026-11-16');
      press(' ', cell('2026-11-16'));
      expect(q('.cal-month__preview')).toBeNull();
      press('Enter', cell('2026-11-16'));
      expect(component.viewMode()).toBe('month');
      expect(calendarApi.next).not.toHaveBeenCalled();
    });

    it('is ignored while typing and while a dialog is open', async () => {
      const field = document.createElement('input');
      document.body.appendChild(field);
      field.focus();
      press('ArrowRight', field);
      expect(calendarApi.next).not.toHaveBeenCalled();
      field.remove();

      component.exceptionFormOpen.set(true);
      press(' ', cell('2026-11-16'));
      expect(q('.cal-month__preview')).toBeNull();
    });
  });

  describe('search', () => {
    it('is disabled in the month view with its hint as placeholder and tooltip (no text under it), and works again in Jour and Semaine', async () => {
      await showMonth();
      const input = q<HTMLInputElement>('#cal-search-input') as HTMLInputElement;
      const hint = 'La recherche fonctionne en vue Jour et Semaine';

      expect(input.disabled).toBe(true);
      // CAL-FIX-2 fix 4: no wrapped text under the field, so nothing moves.
      expect(q('.cal-search__hint')).toBeNull();
      expect(input.placeholder).toBe(hint);
      expect(input.title).toBe(hint);
      expect(input.closest('.cal-search')?.getAttribute('title')).toBe(hint);
      expect(q('#cal-search-help')?.textContent?.trim()).toBe(hint);

      await showWeek();
      expect(input.disabled).toBe(false);
      expect(input.placeholder).toBe("Rechercher dans l'agenda…");
      expect(input.getAttribute('title')).toBeNull();
      expect(input.closest('.cal-search')?.getAttribute('title')).toBeNull();
    });
  });

  describe('Mode discret', () => {
    it('shows initials in the request rows of the aside', async () => {
      prefs().toggle();
      getDoctorScheduledCare.mockReturnValue(
        of({
          generatedAt: '',
          from: '',
          to: '',
          items: [
            {
              resourceType: 'BOOKING_REQUEST',
              requestId: 'r1',
              appointmentId: null,
              status: 'PENDING_DOCTOR',
              subject: { subjectType: 'SELF', displayName: 'Sonia Trabelsi', relationship: null },
              start: at('2026-11-20', '09:00').toISOString(),
              end: at('2026-11-20', '09:30').toISOString(),
            } as never,
          ],
        }),
      );
      await showMonth();
      const aside = q('.cal-month__aside')?.textContent as string;
      prefs().toggle();

      expect(aside).toContain('S. T.');
      expect(aside).not.toContain('Sonia');
    });
  });
});
