import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  DoctorScheduledCareAgenda,
  DoctorScheduledCareItem,
} from '../scheduled-care/scheduled-care.models';
import { CalendarMonth, PREVIEW_DELAY_MS, monthCellClass } from './calendar-month';
import type { CalendarState } from './calendar-presentation';
import type { CalendarSummary } from './calendar-summary.models';
import { addDaysToKey } from './calendar-time';
import { at } from './calendar-time.testing';
import type {
  CalendarMonthInput,
  CalendarViewAction,
  CalendarViewModel,
} from './calendar-view.models';
import { backendClosedExceptionDay, dayWith, summaryFixture } from './testing/calendar-summary.testing';

const AGENDA_URL = '/api/v1/doctor/scheduled-care';
const TODAY = '2026-11-18';

function gridKeys(): string[] {
  return Array.from({ length: 42 }, (_, index) => addDaysToKey('2026-10-26', index));
}

function care(
  id: string,
  day: string,
  time: string,
  overrides: Partial<DoctorScheduledCareItem> = {},
): DoctorScheduledCareItem {
  const start = at(day, time);
  const end = new Date(start.getTime() + 30 * 60_000);
  return {
    resourceType: 'APPOINTMENT',
    requestId: null,
    appointmentId: id,
    sourceBookingRequestId: null,
    version: 1,
    status: 'CONFIRMED',
    doctor: { displayName: 'Dr Test', specialty: null },
    subject: { subjectType: 'SELF', displayName: 'Ahmed Ben Ali', relationship: null },
    cabinet: { name: 'Cabinet', address: '', city: '', governorate: '', timezone: 'Africa/Tunis' },
    start: start.toISOString(),
    end: end.toISOString(),
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

function request(id: string, day: string, time: string, name = 'Sonia Trabelsi'): DoctorScheduledCareItem {
  return care('unused', day, time, {
    resourceType: 'BOOKING_REQUEST',
    requestId: id,
    appointmentId: null,
    status: 'PENDING_DOCTOR',
    subject: { subjectType: 'SELF', displayName: name, relationship: null },
  });
}

function agenda(items: readonly DoctorScheduledCareItem[]): DoctorScheduledCareAgenda {
  return { generatedAt: '', from: '', to: '', items };
}

describe('CalendarMonth', () => {
  let fixture: ComponentFixture<CalendarMonth>;
  let component: CalendarMonth;
  let http: HttpTestingController;
  let actions: CalendarViewAction[];
  let summary: CalendarSummary;

  const model = (overrides: Partial<CalendarViewModel> = {}): CalendarViewModel =>
    ({ viewMode: 'month', discreet: false, shortcutsEnabled: true, ...overrides }) as CalendarViewModel;

  const input = (overrides: Partial<CalendarMonthInput> = {}): CalendarMonthInput => ({
    status: 'ready',
    error: null,
    gridKeys: gridKeys(),
    referenceMonth: '2026-11',
    summary,
    hiddenStates: new Set<CalendarState>(),
    appointments: [],
    requests: [],
    ...overrides,
  });

  function render(data: CalendarMonthInput = input(), view: CalendarViewModel = model()): void {
    fixture.componentRef.setInput('model', view);
    fixture.componentRef.setInput('data', data);
    fixture.detectChanges();
  }

  const q = <T extends HTMLElement = HTMLElement>(selector: string): T | null =>
    fixture.nativeElement.querySelector(selector) as T | null;
  const qa = (selector: string): HTMLElement[] => [...fixture.nativeElement.querySelectorAll(selector)];
  const cell = (day: string): HTMLElement => q(`[role="gridcell"][data-day="${day}"]`) as HTMLElement;
  const text = (): string => (fixture.nativeElement.textContent as string).replace(/\s+/g, ' ');
  const agendaRequests = (): ReturnType<HttpTestingController['match']> =>
    http.match((candidate) => candidate.url === AGENDA_URL);

  /** A key press on a day cell, routed to the component the way the page does it. */
  function press(target: HTMLElement, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
    const handler = (candidate: Event): void => {
      if (component.handleKey(candidate as KeyboardEvent)) candidate.preventDefault();
    };
    document.addEventListener('keydown', handler);
    target.dispatchEvent(event);
    document.removeEventListener('keydown', handler);
    fixture.detectChanges();
    return event;
  }

  function hover(day: string): void {
    cell(day).dispatchEvent(new MouseEvent('mouseenter'));
    vi.advanceTimersByTime(PREVIEW_DELAY_MS);
    fixture.detectChanges();
  }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(at(TODAY, '10:00'));
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    summary = summaryFixture();
    actions = [];
    fixture = TestBed.createComponent(CalendarMonth);
    component = fixture.componentInstance;
    component.action.subscribe((action) => actions.push(action));
  });

  afterEach(() => {
    // Tests that only look at the screen leave their day request unanswered on purpose.
    http.match(() => true);
    http.verify();
    fixture.destroy();
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  describe('grid', () => {
    it('is a grid with LUN…DIM headers and one cell per day', () => {
      render();

      expect(q('[role="grid"]')).toBeTruthy();
      expect(qa('[role="columnheader"]').map((header) => header.textContent?.trim())).toEqual([
        'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM',
      ]);
      expect(qa('[role="row"]')).toHaveLength(7);
      expect(qa('[role="gridcell"]')).toHaveLength(42);
      expect(qa('.cal-month__row:not(.cal-month__row--head)')[0].children).toHaveLength(7);
    });

    it('shows only the day number in a cell (and Fermé / Congé on closed days)', () => {
      render();

      expect(cell('2026-11-16').querySelector('.cal-month__num')?.textContent?.trim()).toBe('16');
      const readable = (day: string): string =>
        [...cell(day).children]
          .filter((child) => !child.matches('button, .cal-month__dots, .cal-month__bar'))
          .map((child) => child.textContent?.trim())
          .join('|');
      expect(readable('2026-11-16')).toBe('16');
      expect(readable('2026-11-01')).toBe('1|Fermé'); // weekly day off
      expect(readable('2026-11-12')).toBe('12|Congé'); // exception
    });

    it('writes the accessible label of each cell', () => {
      render();

      expect(cell('2026-11-16').getAttribute('aria-label')).toBe(
        'Lundi 16 novembre, disponible, 6 sur 16 créneaux réservés, 2 demandes en attente',
      );
      expect(cell('2026-11-18').getAttribute('aria-label')).toContain('complet, 16 sur 16');
      expect(cell('2026-11-17').getAttribute('aria-label')).toContain('chargé');
    });

    it('colours each cell by the level the API gives and fills the bar to loadPercent', () => {
      render();

      expect(cell('2026-11-16').classList).toContain('cal-month__cell--available');
      expect(cell('2026-11-17').classList).toContain('cal-month__cell--busy');
      expect(cell('2026-11-18').classList).toContain('cal-month__cell--full');
      expect(cell('2026-11-01').classList).toContain('cal-month__cell--closed');
      const width = (day: string): string | undefined =>
        cell(day).querySelector<HTMLElement>('.cal-month__fill')?.style.width;
      expect(width('2026-11-16')).toBe('38%');
      expect(width('2026-11-17')).toBe('63%');
      expect(width('2026-11-18')).toBe('100%');
      expect(cell('2026-11-01').querySelector('.cal-month__bar')).toBeNull();
    });

    it('never recomputes: a level and a width that disagree with the slot counts are shown as sent', () => {
      const days = summary.days.map((day) =>
        day.date === '2026-11-16'
          ? { ...day, level: 'FULL' as const, loadPercent: 91, takenSlots: 2, bookableSlots: 20 }
          : day.date === '2026-11-17'
            ? { ...day, level: 'AVAILABLE' as const, loadPercent: 12, takenSlots: 20, bookableSlots: 20 }
            : day,
      );
      render(input({ summary: { ...summary, days } }));

      expect(cell('2026-11-16').classList).toContain('cal-month__cell--full');
      expect(cell('2026-11-16').querySelector<HTMLElement>('.cal-month__fill')?.style.width).toBe('91%');
      expect(cell('2026-11-17').classList).toContain('cal-month__cell--available');
      expect(cell('2026-11-17').querySelector<HTMLElement>('.cal-month__fill')?.style.width).toBe('12%');
    });

    it('dims days outside the month and past days, and puts today in a pill', () => {
      render();

      expect(cell('2026-10-26').classList).toContain('cal-month__cell--outside');
      expect(cell('2026-12-01').classList).toContain('cal-month__cell--outside');
      expect(cell('2026-11-16').classList).toContain('cal-month__cell--past');
      expect(cell('2026-11-20').classList).not.toContain('cal-month__cell--past');
      expect(cell(TODAY).classList).toContain('cal-month__cell--today');
      expect(cell(TODAY).querySelector('.cal-month__num--today')).toBeTruthy();
      expect(qa('.cal-month__num--today')).toHaveLength(1);
    });

    it('draws at most 5 dots then « +n »', () => {
      render();

      expect(cell('2026-11-17').querySelectorAll('.cal-dot')).toHaveLength(5);
      expect(cell('2026-11-17').querySelector('.cal-month__more')?.textContent?.trim()).toBe('+7');
      expect(cell('2026-11-16').querySelectorAll('.cal-dot')).toHaveLength(5);
      expect(cell('2026-11-23').querySelectorAll('.cal-dot')).toHaveLength(2); // cancelled never shown
      expect(cell('2026-11-23').querySelector('.cal-month__more')).toBeNull();
    });

    it('the filters hide the dots of their state; level, colour and bar stay', () => {
      render(input({ hiddenStates: new Set<CalendarState>(['upcoming', 'followUpUpcoming', 'waitingPatient', 'request']) }));

      expect(cell('2026-11-16').querySelectorAll('.cal-dot')).toHaveLength(0);
      expect(cell('2026-11-16').classList).toContain('cal-month__cell--available');
      expect(cell('2026-11-16').querySelector<HTMLElement>('.cal-month__fill')?.style.width).toBe('38%');
      expect(cell('2026-11-16').getAttribute('aria-label')).toBe(
        'Lundi 16 novembre, disponible, 6 sur 16 créneaux réservés',
      );
    });

    it('shows the legend of the canvas with the API thresholds', () => {
      render();

      for (const label of [
        'Disponible (moins de 50 %)', 'Chargé (50–85 %)', 'Complet (85 % et plus)', 'Fermé',
        'Rendez-vous à venir', 'Suivi à venir', 'Suivi terminé', 'Terminé', 'Demande en attente',
      ]) {
        expect(qa('.cal-legend__item').map((item) => item.textContent?.trim())).toContain(label);
      }
    });

    it('is in French only and never mentions « Patients à prévenir »', () => {
      render();
      expect(text()).not.toContain('Patients à prévenir');
    });
  });

  describe('states', () => {
    it('shows skeleton cells while loading', () => {
      render(input({ status: 'loading', summary: null }));

      expect(qa('.cal-month__cell--skeleton')).toHaveLength(42);
      expect(q('[role="grid"]')?.getAttribute('aria-busy')).toBe('true');
    });

    it('shows the French error with « Réessayer », which asks the page to reload', () => {
      render(input({ status: 'error', error: 'Impossible de charger le mois.', summary: null }));

      expect(q('[role="alert"]')?.textContent).toContain('Impossible de charger le mois.');
      const retry = qa('button').find((button) => button.textContent?.includes('Réessayer'));
      retry?.click();
      expect(actions).toContainEqual({ kind: 'RETRY_SUMMARY' });
    });

    it('shows the French message of a 400', () => {
      render(input({ status: 'error', error: "La période demandée n'est pas valide.", summary: null }));
      expect(q('[role="alert"]')?.textContent).toContain("La période demandée n'est pas valide.");
    });
  });

  describe('click and day menu', () => {
    it('opens the Jour view on a clicked day', () => {
      render();
      cell('2026-11-19').click();

      expect(actions).toEqual([{ kind: 'OPEN_DAY', date: '2026-11-19' }]);
    });

    it('has a « ⋯ » button per cell with the three actions, and no « Patients à prévenir »', () => {
      render();
      const button = cell('2026-11-16').querySelector<HTMLButtonElement>('.cal-month__menu-btn') as HTMLButtonElement;
      button.click();
      fixture.detectChanges();

      expect(actions).toEqual([]); // opening the menu does not open the day
      expect(button.getAttribute('aria-expanded')).toBe('true');
      expect(qa('[role="menuitem"]').map((item) => item.textContent?.trim())).toEqual([
        'Prolonger la journée', 'Fermer la journée', 'Ajouter une pause',
      ]);
      expect(text()).not.toContain('Patients à prévenir');
    });

    it('sends the chosen command for that day to the page', () => {
      render();
      for (const [label, command] of [
        ['Prolonger la journée', 'EXTEND'],
        ['Fermer la journée', 'CLOSE'],
        ['Ajouter une pause', 'ADD_BREAK'],
      ] as const) {
        cell('2026-11-16').querySelector<HTMLButtonElement>('.cal-month__menu-btn')?.click();
        fixture.detectChanges();
        qa('[role="menuitem"]').find((item) => item.textContent?.trim() === label)?.click();
        fixture.detectChanges();
        expect(actions.at(-1)).toEqual({ kind: 'DAY_MENU', date: '2026-11-16', command });
      }
      expect(qa('[role="menu"]')).toHaveLength(0);
    });

    it('offers only « Prolonger la journée » on a closed day, and Échap closes the menu', () => {
      render();
      cell('2026-11-01').querySelector<HTMLButtonElement>('.cal-month__menu-btn')?.click();
      fixture.detectChanges();
      expect(qa('[role="menuitem"]').map((item) => item.textContent?.trim())).toEqual(['Prolonger la journée']);

      qa('[role="menuitem"]')[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      fixture.detectChanges();
      expect(qa('[role="menu"]')).toHaveLength(0);
    });
  });

  describe('preview', () => {
    const items = (): DoctorScheduledCareItem[] => [
      care('a1', '2026-11-16', '09:00'),
      care('a2', '2026-11-16', '09:30', { subject: { subjectType: 'SELF', displayName: 'Karim Mejri', relationship: null } }),
      care('a3', '2026-11-16', '10:00'),
      care('a4', '2026-11-16', '10:30'),
      care('a5', '2026-11-16', '11:00'),
      request('r1', '2026-11-16', '11:30'),
      care('gone', '2026-11-16', '12:00', { status: 'CANCELLED' }),
      care('other-day', '2026-11-17', '09:00'),
    ];

    it('opens after the delay on hover and loads only that Tunis day, once', () => {
      render();
      cell('2026-11-16').dispatchEvent(new MouseEvent('mouseenter'));
      vi.advanceTimersByTime(PREVIEW_DELAY_MS - 1);
      fixture.detectChanges();
      expect(q('.cal-month__preview')).toBeNull();
      expect(agendaRequests()).toHaveLength(0);

      vi.advanceTimersByTime(1);
      fixture.detectChanges();
      expect(q('.cal-month__preview')).toBeTruthy();
      const calls = agendaRequests();
      expect(calls).toHaveLength(1);
      expect(calls[0].request.params.get('from')).toBe(at('2026-11-16').toISOString());
      expect(calls[0].request.params.get('to')).toBe(at('2026-11-17').toISOString());
      calls[0].flush(agenda(items()));
      fixture.detectChanges();
      expect(q('.cal-pv__list')).toBeTruthy();
    });

    it('uses the per-day cache: leaving and coming back does not ask again', () => {
      render();
      hover('2026-11-16');
      agendaRequests()[0].flush(agenda(items()));
      cell('2026-11-16').dispatchEvent(new MouseEvent('mouseleave'));
      fixture.detectChanges();
      expect(q('.cal-month__preview')).toBeNull();

      hover('2026-11-16');
      expect(q('.cal-month__preview')).toBeTruthy();
      expect(agendaRequests()).toHaveLength(0);
      expect(q('.cal-pv__list')).toBeTruthy();

      hover('2026-11-17'); // another day: one more request, for that day only
      expect(agendaRequests()).toHaveLength(1);
    });

    it('shows the date, the level chip, the counts, the first 4 appointments and « + n autres »', () => {
      render();
      hover('2026-11-16');
      agendaRequests()[0].flush(agenda(items()));
      fixture.detectChanges();

      const preview = q('.cal-month__preview') as HTMLElement;
      expect(preview.querySelector('.cal-pv__title')?.textContent).toBe('Lundi 16 novembre 2026');
      // 16 November is before TODAY (18 November): its chip reads « Passé » since CAL-FIX-2 (fix 6).
      expect(preview.querySelector('.cal-pv__level')?.textContent?.trim()).toBe('Passé');
      expect(preview.querySelector('.cal-pv__slots')?.textContent?.trim()).toBe('6 / 16 créneaux réservés · 2 en attente');
      const rows = [...preview.querySelectorAll('.cal-pv__item')];
      expect(rows).toHaveLength(4);
      expect(rows[0].textContent).toContain('09:00');
      expect(rows[0].textContent).toContain('Ahmed Ben Ali');
      expect(rows[1].textContent).toContain('Karim Mejri');
      expect(preview.querySelector('.cal-pv__more')?.textContent?.trim()).toBe('+ 2 autres');
      expect(preview.querySelector('.cal-pv__timeline')).toBeTruthy();
      expect(preview.querySelectorAll('.cal-pv__booked').length).toBeGreaterThan(0);
      expect(preview.textContent).not.toContain('gone');
    });

    it('marks a request with « Demande » and says « Aucun rendez-vous » on an empty day', () => {
      render();
      hover('2026-11-16');
      agendaRequests()[0].flush(agenda([request('r1', '2026-11-16', '09:00')]));
      fixture.detectChanges();
      expect(q('.cal-pv__item .cal-chip--request')?.textContent?.trim()).toBe('Demande');

      hover('2026-11-20');
      agendaRequests()[0].flush(agenda([]));
      fixture.detectChanges();
      expect(q('.cal-month__preview .cal-pv__muted')?.textContent?.trim()).toBe('Aucun rendez-vous');
    });

    it('says the day is closed, and loads nothing for it', () => {
      render();
      hover('2026-11-01');

      expect(q('.cal-month__preview .cal-pv__muted')?.textContent?.trim()).toBe('Aucun créneau ce jour (fermé)');
      expect(q('.cal-pv__level')?.textContent?.trim()).toBe('Fermé');
      expect(agendaRequests()).toHaveLength(0);
    });

    it('fix 14: a closed EXCEPTION day with segments (backend payload) reads « Congé », shows no timeline and loads nothing', () => {
      summary = { ...summary, days: summary.days.map((day) => (day.date === '2026-11-18' ? backendClosedExceptionDay('2026-11-18') : day)) };
      render();
      expect(cell('2026-11-18').textContent).toContain('Congé');
      expect(cell('2026-11-18').querySelector('.cal-month__bar, .cal-month__load')).toBeNull();
      hover('2026-11-18');

      expect(q('.cal-month__preview .cal-pv__muted')?.textContent?.trim()).toBe('Aucun créneau ce jour (fermé)');
      expect(q('.cal-pv__timeline')).toBeNull();
      expect(q('.cal-pv__level')?.textContent?.trim()).toBe('Fermé');
      expect(agendaRequests()).toHaveLength(0);
    });

    it('fix 5: a confirmed appointment already over shows « Non clôturé » in the preview', () => {
      render();
      hover('2026-11-16'); // two days before TODAY (2026-11-18)
      agendaRequests()[0].flush(agenda([care('old', '2026-11-16', '09:00')]));
      fixture.detectChanges();

      const row = q('.cal-pv__item') as HTMLElement;
      expect(row.classList).toContain('cal-pv__item--not-closed');
      expect(row.querySelector('.cal-chip--not-closed')?.textContent?.trim()).toBe('Non clôturé');
      expect(row.textContent).not.toContain('À venir');
    });

    it('has « Ouvrir la journée » and « + Rendez-vous » (a future day; a past day has no « + Rendez-vous », CAL-FIX-2)', () => {
      render();
      hover('2026-11-23');
      agendaRequests()[0].flush(agenda([]));
      fixture.detectChanges();
      const buttons = qa('.cal-pv__actions button');

      expect(buttons.map((button) => button.textContent?.trim())).toEqual(['Ouvrir la journée', '+ Rendez-vous']);
      buttons[0].click();
      buttons[1].click();
      expect(actions).toEqual([
        { kind: 'OPEN_DAY', date: '2026-11-23' },
        { kind: 'NEW_APPOINTMENT_ON', date: '2026-11-23' },
      ]);
    });

    it('opens beside the cell and flips near the right and bottom edges', () => {
      render();
      hover('2026-11-16'); // Monday, second row
      agendaRequests()[0].flush(agenda([]));
      fixture.detectChanges();
      expect(q('.cal-month__preview')?.classList).not.toContain('cal-month__preview--left');
      expect(q('.cal-month__preview')?.classList).not.toContain('cal-month__preview--up');

      cell('2026-11-16').dispatchEvent(new MouseEvent('mouseleave'));
      hover('2026-12-04'); // Friday, last row
      agendaRequests()[0].flush(agenda([]));
      fixture.detectChanges();
      expect(q('.cal-month__preview')?.classList).toContain('cal-month__preview--left');
      expect(q('.cal-month__preview')?.classList).toContain('cal-month__preview--up');
    });

    it('hides the pending count and the filtered appointments when their state is filtered', () => {
      render(input({ hiddenStates: new Set<CalendarState>(['request']) }));
      hover('2026-11-16');
      agendaRequests()[0].flush(agenda(items()));
      fixture.detectChanges();

      expect(q('.cal-pv__slots')?.textContent?.trim()).toBe('6 / 16 créneaux réservés');
      expect(qa('.cal-pv__item .cal-chip--request')).toHaveLength(0);
    });

    it('shows initials in « Mode discret »', () => {
      render(input(), model({ discreet: true }));
      hover('2026-11-16');
      agendaRequests()[0].flush(agenda(items()));
      fixture.detectChanges();

      const names = qa('.cal-pv__name').map((name) => name.textContent?.trim());
      expect(names[0]).toBe('A. B.');
      expect(names[1]).toBe('K. M.');
      expect(text()).not.toContain('Ahmed');
      expect(text()).not.toContain('Karim');
    });

    it('says when the day cannot be loaded, and asks again the next time', () => {
      render();
      hover('2026-11-16');
      agendaRequests()[0].flush({}, { status: 500, statusText: 'Erreur' });
      fixture.detectChanges();
      expect(q('.cal-month__preview [role="alert"]')?.textContent).toContain('Impossible de charger');

      cell('2026-11-16').dispatchEvent(new MouseEvent('mouseleave'));
      hover('2026-11-16');
      expect(agendaRequests()).toHaveLength(1);
    });
  });

  describe('keyboard', () => {
    it('Espace opens the preview of the focused day and closes it again', () => {
      render();
      const target = cell('2026-11-16');
      target.focus();

      const event = press(target, ' ');
      expect(event.defaultPrevented).toBe(true);
      expect(q('.cal-month__preview')).toBeTruthy();
      expect(agendaRequests()).toHaveLength(1);

      press(target, ' ');
      expect(q('.cal-month__preview')).toBeNull();
      expect(agendaRequests()).toHaveLength(0); // the day is not asked for again
    });

    it('Échap closes the preview', () => {
      render();
      const target = cell('2026-11-16');
      press(target, ' ');
      expect(q('.cal-month__preview')).toBeTruthy();

      expect(component.closePreview()).toBe(true);
      fixture.detectChanges();
      expect(q('.cal-month__preview')).toBeNull();
      expect(component.closePreview()).toBe(false);
    });

    it('arrows move the focus between days (left, right, up, down) and stay in the grid', () => {
      render();
      cell('2026-11-16').focus();

      press(document.activeElement as HTMLElement, 'ArrowRight');
      expect((document.activeElement as HTMLElement).getAttribute('data-day')).toBe('2026-11-17');
      press(document.activeElement as HTMLElement, 'ArrowDown');
      expect((document.activeElement as HTMLElement).getAttribute('data-day')).toBe('2026-11-24');
      press(document.activeElement as HTMLElement, 'ArrowLeft');
      expect((document.activeElement as HTMLElement).getAttribute('data-day')).toBe('2026-11-23');
      press(document.activeElement as HTMLElement, 'ArrowUp');
      expect((document.activeElement as HTMLElement).getAttribute('data-day')).toBe('2026-11-16');

      cell('2026-10-26').focus();
      press(document.activeElement as HTMLElement, 'ArrowLeft');
      expect((document.activeElement as HTMLElement).getAttribute('data-day')).toBe('2026-10-26');
    });

    it('only one cell is in the tab order, and it follows the focus', () => {
      render();
      expect(qa('[role="gridcell"][tabindex="0"]')).toHaveLength(1);
      expect(qa('[role="gridcell"][tabindex="0"]')[0].getAttribute('data-day')).toBe(TODAY);

      cell('2026-11-20').focus();
      fixture.detectChanges();
      expect(qa('[role="gridcell"][tabindex="0"]')[0].getAttribute('data-day')).toBe('2026-11-20');
    });

    it('Entrée opens the day', () => {
      render();
      const target = cell('2026-11-19');
      target.focus();

      press(target, 'Enter');
      expect(actions).toEqual([{ kind: 'OPEN_DAY', date: '2026-11-19' }]);
    });

    it('ignores keys with a modifier, other keys, and keys that do not come from a day cell', () => {
      render();
      const target = cell('2026-11-16');
      target.focus();

      expect(press(target, 'ArrowRight', { ctrlKey: true }).defaultPrevented).toBe(false);
      expect(press(target, 'a').defaultPrevented).toBe(false);
      const menuButton = target.querySelector<HTMLElement>('.cal-month__menu-btn') as HTMLElement;
      expect(press(menuButton, 'Enter').defaultPrevented).toBe(false);
      expect(actions).toEqual([]);
    });
  });

  describe('left panel', () => {
    const today = (): DoctorScheduledCareItem[] => [
      care('t1', TODAY, '08:00', { status: 'COMPLETED' }),
      care('t2', TODAY, '09:30', { status: 'IN_PROGRESS' }),
      care('t3', TODAY, '15:00', { subject: { subjectType: 'SELF', displayName: 'Leila Gharbi', relationship: null } }),
      care('t4', TODAY, '16:00', { status: 'CANCELLED' }),
      care('t5', '2026-11-19', '09:00'),
    ];

    it('shows today: booked / bookable from the summary, its appointments, « En cours », past rows faded', () => {
      render(input({ appointments: today() }));
      const card = q('[aria-labelledby="cal-month-today-title"]') as HTMLElement;

      expect(card.querySelector('.cal-card__figure')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
        '16 / 16 créneaux réservés',
      );
      const rows = [...card.querySelectorAll('.cal-list__row')];
      expect(rows).toHaveLength(3); // cancelled and other days left out
      expect(rows[1].textContent).toContain('En cours');
      expect(rows[0].classList).toContain('cal-list__row--past'); // 08:00-08:30, before the 10:00 « now »
      expect(rows[2].classList).not.toContain('cal-list__row--past');
    });

    it('lists the pending requests with a count, and a row opens the side panel through the page', () => {
      render(input({ requests: [request('r1', '2026-11-20', '09:00'), request('r2', '2026-11-21', '10:00', 'Mounir Hamdi')] }));
      const card = q('[aria-labelledby="cal-month-requests-title"]') as HTMLElement;

      expect(card.querySelector('.cal-chip--count')?.textContent?.trim()).toBe('2');
      const rows = [...card.querySelectorAll<HTMLButtonElement>('.cal-list__button')];
      expect(rows).toHaveLength(2);
      expect(rows[1].textContent).toContain('Mounir Hamdi');
      // No one-click action: nothing to accept or refuse in the panel.
      expect(card.textContent).not.toMatch(/Accepter|Refuser/);
      rows[0].click();
      expect(actions).toEqual([{ kind: 'OPEN_ITEM', resource: 'request', id: 'r1' }]);
    });

    it('opens the CAL-4 shortcuts window from the « Raccourcis clavier » card', () => {
      render();
      const card = q('[aria-labelledby="cal-month-shortcuts-title"]') as HTMLElement;
      card.querySelector('button')?.click();

      expect(card.querySelector('h2')?.textContent?.trim()).toBe('Raccourcis clavier');
      expect(actions).toEqual([{ kind: 'SHOW_SHORTCUTS' }]);
    });

    it('shows initials in the aside in « Mode discret »', () => {
      render(
        input({ appointments: today(), requests: [request('r1', '2026-11-20', '09:00', 'Sonia Trabelsi')] }),
        model({ discreet: true }),
      );

      const aside = (q('.cal-month__aside') as HTMLElement).textContent as string;
      expect(aside).toContain('S. T.');
      expect(aside).toContain('L. G.');
      expect(aside).not.toContain('Sonia');
      expect(aside).not.toContain('Leila');
      expect(aside).not.toContain('Ahmed');
    });

    it('leaves out the « Aujourd\'hui » card when today is not in the visible month', () => {
      vi.setSystemTime(at('2027-03-10', '10:00'));
      fixture.destroy();
      fixture = TestBed.createComponent(CalendarMonth);
      component = fixture.componentInstance;
      render();

      expect(q('[aria-labelledby="cal-month-today-title"]')).toBeNull();
    });
  });

  it('uses the summary day of the fixture (a day with a blocked window keeps it in the model)', () => {
    expect(dayWith('2026-11-16', {}).blockedWindows).toHaveLength(1);
  });

  describe('CAL-FIX-2', () => {
    const styles = (): string =>
      [...document.querySelectorAll('style')].map((style) => style.textContent ?? '').join(' ').replace(/\s+/g, ' ');

    it('fix 1: fading never applies to the cell element, so the preview inside it stays fully opaque', () => {
      render();
      hover('2026-11-16'); // a past day of the month
      agendaRequests()[0].flush(agenda([]));
      fixture.detectChanges();

      const preview = q('.cal-month__preview') as HTMLElement;
      expect(cell('2026-11-16').classList).toContain('cal-month__cell--past');
      expect(cell('2026-11-16').contains(preview)).toBe(true);
      const css = styles();
      // The fade is a variable read by the background layer and the day's content only.
      expect(css).toMatch(/\.cal-month__cell--past(\[[^\]]+\])? ?\{ ?--cal-fade: ?0\.6;? ?\}/);
      expect(css).toMatch(/\.cal-month__cell--outside(\[[^\]]+\])? ?\{ ?--cal-fade: ?0\.5;? ?\}/);
      expect(css).toMatch(/\.cal-month__cell(\[[^\]]+\])?::before ?\{[^}]*opacity: ?var\(--cal-fade\)/);
      expect(css).not.toMatch(/\.cal-month__cell--(past|outside)(\[[^\]]+\])? ?\{[^}]*opacity:/);
      expect(css).not.toMatch(/\.cal-month__preview[^{]*\{[^}]*--cal-fade/);
    });

    it('fix 2: every cell keeps its level colour; out-of-month 50 %, past of the month 60 %, today and future 100 %', () => {
      render();
      const classes = (day: string): string[] => [...cell(day).classList];
      expect(classes('2026-10-26')).toEqual(expect.arrayContaining(['cal-month__cell--outside']));
      expect(classes('2026-10-26')).not.toContain('cal-month__cell--past');
      expect(classes('2026-12-01')).toEqual(expect.arrayContaining(['cal-month__cell--outside']));
      expect(classes('2026-11-16')).toEqual(expect.arrayContaining(['cal-month__cell--past']));
      expect(classes('2026-11-18')).toEqual(expect.arrayContaining(['cal-month__cell--today']));
      expect(classes('2026-11-18').some((name) => name === 'cal-month__cell--past' || name === 'cal-month__cell--outside')).toBe(false);
      expect(classes('2026-11-20').some((name) => name === 'cal-month__cell--past' || name === 'cal-month__cell--outside')).toBe(false);
      for (const day of ['2026-10-26', '2026-12-01', '2026-11-16', '2026-11-18', '2026-11-20']) {
        expect(classes(day).some((name) => /^cal-month__cell--(available|busy|full|closed)$/.test(name))).toBe(true);
      }
      expect(monthCellClass('BUSY', false, false, false)).toBe('cal-month__cell cal-month__cell--busy');
      expect(monthCellClass(null, true, true, false)).toBe('cal-month__cell cal-month__cell--none cal-month__cell--outside');
    });

    it('fix 6: a past day reads « Passé », has no « + Rendez-vous » and an all-grey timeline', () => {
      render();
      hover('2026-11-16');
      agendaRequests()[0].flush(agenda([]));
      fixture.detectChanges();

      expect(q('.cal-pv__level')?.textContent?.trim()).toBe('Passé');
      expect(q('.cal-pv__level')?.className).toContain('cal-pv__level--past');
      expect(qa('.cal-pv__actions button').map((button) => button.textContent?.trim())).toEqual(['Ouvrir la journée']);
      expect(q<HTMLElement>('.cal-pv__past')?.style.width).toBe('100%');
      // The cell keeps its level colour (it shows how busy the day was).
      expect([...cell('2026-11-16').classList].some((name) => /^cal-month__cell--(available|busy|full)$/.test(name))).toBe(true);
      component.newAppointment('2026-11-16');
      expect(actions).toEqual([]);
    });

    it('fix 6: today keeps its chip and « + Rendez-vous »; only the time before now (10:00) is grey', () => {
      render();
      hover(TODAY);
      agendaRequests()[0].flush(agenda([]));
      fixture.detectChanges();

      expect(q('.cal-pv__level')?.textContent?.trim()).not.toBe('Passé');
      expect(qa('.cal-pv__actions button').map((button) => button.textContent?.trim())).toEqual(['Ouvrir la journée', '+ Rendez-vous']);
      // span 08:00 – 18:00, now 10:00 → 120 / 600
      expect(parseFloat(q<HTMLElement>('.cal-pv__past')?.style.width ?? '0')).toBeCloseTo(20, 3);
    });

    it('fix 6: a future day has no grey part, its level chip and « + Rendez-vous »', () => {
      render();
      hover('2026-11-20');
      agendaRequests()[0].flush(agenda([]));
      fixture.detectChanges();

      expect(q('.cal-pv__level')?.textContent?.trim()).toBe('Disponible');
      expect(q('.cal-pv__past')).toBeNull();
      expect(qa('.cal-pv__actions button').map((button) => button.textContent?.trim())).toContain('+ Rendez-vous');
    });
  });
});

