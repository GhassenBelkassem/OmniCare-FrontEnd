import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NzPopconfirmDirective } from 'ng-zorro-antd/popconfirm';
import { en_GB, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { OMNICARE_ICONS } from '../../../app.icons';
import type { DoctorScheduledCareItem } from '../scheduled-care/scheduled-care.models';
import { CalendarDay } from './calendar-day';
import { daySlotsWith } from './testing/day-slots.testing';
import type { CalendarState } from './calendar-presentation';
import { at } from './calendar-time.testing';
import type { CalendarDayInput, CalendarViewAction, CalendarViewModel } from './calendar-view.models';
import { daySlotsFixture } from './testing/day-slots.testing';
import { backendClosedExceptionDay, dayWith, fixtureDay } from './testing/calendar-summary.testing';

const DAY = '2026-11-16';
const NOW = at(DAY, '10:20').getTime();

function care(
  id: string,
  time: string,
  overrides: Partial<DoctorScheduledCareItem> = {},
): DoctorScheduledCareItem {
  const start = at(DAY, time);
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

const items = (): DoctorScheduledCareItem[] => [
  care('a1', '08:30', { status: 'COMPLETED', ...named('Karim Mansour') }),
  care('a3', '10:30', named('Leila Gharbi', 'PRACTICE_PATIENT')),
  care('a4', '14:00', named('Sami Jlassi')),
  request('r1', '15:00'),
];

describe('CalendarDay', () => {
  let fixture: ComponentFixture<CalendarDay>;
  let actions: CalendarViewAction[];

  const model = (overrides: Partial<CalendarViewModel> = {}): CalendarViewModel =>
    ({ viewMode: 'day', discreet: false, shortcutsEnabled: true, selectedAppointmentId: null, ...overrides }) as CalendarViewModel;

  const data = (overrides: Partial<CalendarDayInput> = {}): CalendarDayInput => ({
    dayKey: DAY,
    nowMs: NOW,
    items: { status: 'ready', error: null, list: items() },
    summary: { status: 'ready', error: null, day: fixtureDay(DAY) },
    slots: { status: 'ready', error: null, list: daySlotsFixture().slots },
    hiddenStates: new Set<CalendarState>(),
    canStart: true,
    startingId: null,
    acceptingId: null,
    commandBusy: false,
    commandError: null,
    blockExceptions: [],
    ...overrides,
  });

  function render(input: CalendarDayInput = data(), view: CalendarViewModel = model()): void {
    fixture.componentRef.setInput('model', view);
    fixture.componentRef.setInput('data', input);
    fixture.detectChanges();
  }

  const q = <T extends HTMLElement = HTMLElement>(selector: string): T | null =>
    fixture.nativeElement.querySelector(selector) as T | null;
  const qa = (selector: string): HTMLElement[] => [...fixture.nativeElement.querySelectorAll(selector)];
  const summaryLine = (line: HTMLElement): string =>
    `${line.querySelector('dt')?.textContent?.trim()} ${line.querySelector('dd')?.textContent?.trim()}`;
  const text = (): string => (fixture.nativeElement.textContent as string).replace(/\s+/g, ' ');
  const rowOf = (id: string): HTMLElement => q(`[data-cal-id="${id}"]`)!.closest('.cal-day__item') as HTMLElement;
  const buttonsOf = (element: HTMLElement): string[] =>
    [...element.querySelectorAll('button')].map((button) => (button.textContent ?? '').trim()).filter(Boolean);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CalendarDay],
      providers: [provideNzI18n(en_GB), provideNzIcons(OMNICARE_ICONS)],
    }).compileComponents();
    fixture = TestBed.createComponent(CalendarDay);
    actions = [];
    fixture.componentInstance.action.subscribe((action) => actions.push(action));
  });

  afterEach(() => {
    fixture.destroy();
    TestBed.resetTestingModule();
  });

  describe('header line', () => {
    it('shows « 6 / 16 créneaux réservés », the level chip and the pending requests chip, as the API gave them', () => {
      render();

      expect(q('.cal-day__slots')?.textContent).toContain('6 / 16 créneaux réservés');
      expect(q('.cal-day__level')?.textContent?.trim()).toBe('Disponible');
      expect(q('.cal-day__level')?.classList).toContain('cal-day__level--available');
      expect(q('.cal-day__chip--request')?.textContent?.trim()).toBe('2 demandes en attente');
    });

    it('shows the numbers and the level of the API even when they disagree with the rows (no recomputation)', () => {
      // 4 appointments are listed, the API says 9 / 12, FULL, and 1 pending request.
      render(
        data({
          summary: {
            status: 'ready',
            error: null,
            day: dayWith(DAY, { takenSlots: 9, bookableSlots: 12, loadPercent: 12, level: 'FULL', pendingRequestCount: 1 }),
          },
        }),
      );

      expect(q('.cal-day__slots')?.textContent).toContain('9 / 12 créneaux réservés');
      expect(q('.cal-day__level')?.textContent?.trim()).toBe('Complet');
      expect(q('.cal-day__chip--request')?.textContent?.trim()).toBe('1 demande en attente');
    });

    it('uses the four level words: Disponible, Chargé, Complet, Fermé', () => {
      const words: Record<string, string> = { AVAILABLE: 'Disponible', BUSY: 'Chargé', FULL: 'Complet', CLOSED: 'Fermé' };
      for (const level of ['AVAILABLE', 'BUSY', 'FULL', 'CLOSED'] as const) {
        render(data({ summary: { status: 'ready', error: null, day: dayWith(DAY, { level }) } }));
        expect(q('.cal-day__level')?.textContent?.trim()).toBe(words[level]);
      }
    });

    it('shows no pending chip when the API sends none', () => {
      render(data({ summary: { status: 'ready', error: null, day: dayWith(DAY, { pendingRequestCount: 0 }) } }));
      expect(q('.cal-day__chip--request')).toBeNull();
    });
  });

  describe('rows', () => {
    it('are real buttons with the French accessible label of the card, and a 64 px time column', () => {
      render();

      const open = q<HTMLButtonElement>('[data-cal-id="a3"]')!;
      expect(open.tagName).toBe('BUTTON');
      expect(open.getAttribute('aria-label')).toBe('Rendez-vous à 10:30 avec Leila Gharbi. Statut : À venir.');
      expect(q('.cal-day__row--item .cal-day__time')?.textContent?.trim()).toBe('08:30');
    });

    it('show the name, the type and cabinet line and the CAL-1 status chip with its colour class', () => {
      render();

      const row = rowOf('a3');
      expect(row.textContent).toContain('Leila Gharbi');
      expect(row.textContent).toContain('Patient externe · Cabinet Lac');
      expect(row.querySelector('.cal-day__chip--state')?.textContent?.trim()).toBe('À venir');
      expect(row.classList).toContain('oc-cal-state--upcoming');
      expect(rowOf('r1').classList).toContain('oc-cal-state--request');
      expect(rowOf('r1').querySelector('.cal-day__chip--state')?.textContent?.trim()).toBe('Demande');
      expect(rowOf('a1').querySelector('.cal-day__chip--state')?.textContent?.trim()).toBe('Terminé');
    });

    it('are in time order with the free time, the break and the closed window between them', () => {
      render();

      const order = qa('.cal-day__list > li').map((li) => li.className.replace('cal-day__row ', '').replace('cal-day__row--', ''));
      expect(order).toEqual(['item', 'now', 'item', 'free', 'break', 'item', 'free', 'item', 'closed', 'free']);
    });

    it('open the side panel when clicked (and from « ⋯ »)', () => {
      render();

      q<HTMLButtonElement>('[data-cal-id="a3"]')!.click();
      q<HTMLButtonElement>('[data-cal-id="r1"]')!.click();
      rowOf('a4').querySelector<HTMLButtonElement>('.cal-day__btn--icon')!.click();

      expect(actions).toEqual([
        { kind: 'OPEN_ITEM', resource: 'appointment', id: 'a3' },
        { kind: 'OPEN_ITEM', resource: 'request', id: 'r1' },
        { kind: 'OPEN_ITEM', resource: 'appointment', id: 'a4' },
      ]);
      expect(rowOf('a4').querySelector('.cal-day__btn--icon')?.getAttribute('aria-label')).toBe('Plus d’actions');
    });

    it('mark the selected row', () => {
      render(data(), model({ selectedAppointmentId: 'a3' }));
      expect(rowOf('a3').classList).toContain('cal-day__item--selected');
      expect(rowOf('a4').classList).not.toContain('cal-day__item--selected');
    });
  });

  describe('row actions', () => {
    it('« Démarrer » is on the next CONFIRMED appointment that can start, and on no other row', () => {
      render();

      expect(buttonsOf(rowOf('a3'))).toContain('Démarrer');
      expect(buttonsOf(rowOf('a4'))).not.toContain('Démarrer');
      expect(buttonsOf(rowOf('a1'))).not.toContain('Démarrer');
      expect(buttonsOf(rowOf('r1'))).not.toContain('Démarrer');
      expect(qa('button').filter((button) => button.textContent?.trim() === 'Démarrer')).toHaveLength(1);
    });

    it('« Démarrer » sends the start action of that appointment, once per click', () => {
      render();
      rowOf('a3').querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
        if (button.textContent?.trim() === 'Démarrer') button.click();
      });

      expect(actions).toEqual([{ kind: 'DAY_START', id: 'a3' }]);
    });

    it('« Démarrer » is not offered while another consultation runs', () => {
      render(data({ canStart: false }));
      expect(qa('button').some((button) => button.textContent?.trim() === 'Démarrer')).toBe(false);
    });

    it('« Démarrer » is not offered on another day, even for a CONFIRMED appointment', () => {
      render(data({ nowMs: at('2026-11-15', '10:20').getTime() }));
      expect(qa('button').some((button) => button.textContent?.trim() === 'Démarrer')).toBe(false);
    });

    it('a request row has « Accepter » and « Refuser »; an appointment row has neither', () => {
      render();

      expect(buttonsOf(rowOf('r1'))).toEqual(expect.arrayContaining(['Accepter', 'Refuser', '⋯']));
      for (const id of ['a1', 'a3', 'a4']) {
        expect(buttonsOf(rowOf(id))).not.toContain('Accepter');
        expect(buttonsOf(rowOf(id))).not.toContain('Refuser');
      }
    });

    it('« Accepter » and « Refuser » each send one action; nothing is accepted or refused by the row itself', () => {
      render();
      const [accept, decline] = ['Accepter', 'Refuser'].map(
        (label) => [...rowOf('r1').querySelectorAll('button')].find((button) => button.textContent?.trim() === label)!,
      );

      accept.click();
      decline.click();

      expect(actions).toEqual([
        { kind: 'DAY_ACCEPT', id: 'r1' },
        { kind: 'DAY_DECLINE', id: 'r1' },
      ]);
    });

    it('the buttons wait while a command is running', () => {
      render(data({ commandBusy: true }));
      const disabled = (id: string, label: string): boolean =>
        ([...rowOf(id).querySelectorAll('button')].find((button) => button.textContent?.trim() === label) as HTMLButtonElement).disabled;

      expect(disabled('r1', 'Accepter')).toBe(true);
      expect(disabled('r1', 'Refuser')).toBe(true);
      expect(disabled('a3', 'Démarrer')).toBe(true);
    });

    it('« Accepter » is not shown for a request that waits for the patient, nor a request without that action', () => {
      const waiting = { ...request('r2', '16:30'), status: 'PENDING_PATIENT_TIME_CONFIRMATION' } as DoctorScheduledCareItem;
      const noAction = { ...request('r3', '17:00'), availableActions: [] } as DoctorScheduledCareItem;
      render(data({ items: { status: 'ready', error: null, list: [waiting, noAction] } }));

      expect(buttonsOf(rowOf('r2'))).not.toContain('Accepter');
      expect(buttonsOf(rowOf('r3'))).not.toContain('Accepter');
      expect(buttonsOf(rowOf('r3'))).not.toContain('Refuser');
    });
  });

  describe('free row', () => {
    it('merges neighbouring FREE slots: « Libre · 11:00 – 12:30 »', () => {
      render();
      const labels = qa('.cal-day__free-label').map((element) => element.textContent?.trim());

      expect(labels).toEqual(['Libre · 11:00 – 12:30', 'Libre · 14:30 – 16:00', 'Libre · 17:00 – 17:30']);
    });

    it('does not show PAST or TAKEN time as free', () => {
      render(
        data({
          slots: {
            status: 'ready',
            error: null,
            list: daySlotsWith([
              { start: '08:00', end: '08:30', state: 'PAST' },
              { start: '08:30', end: '09:00', state: 'TAKEN' },
              { start: '09:00', end: '09:30', state: 'FREE' },
            ]).slots,
          },
        }),
      );

      expect(qa('.cal-day__free-label').map((element) => element.textContent?.trim())).toEqual(['Libre · 09:00 – 09:30']);
    });

    it('« + Ajouter » sends the day and the start of that run', () => {
      render();
      const add = qa('.cal-day__free .cal-day__btn');

      add[1].click();

      expect(actions).toEqual([{ kind: 'DAY_ADD_SLOT', date: DAY, start: '14:30' }]);
      expect(add[1].getAttribute('aria-label')).toBe('Ajouter un rendez-vous, libre de 14:30 à 16:00');
    });
  });

  describe('break, closed windows and the closed day', () => {
    it('shows the break row: cup icon, « Pause déjeuner », « 12:30 – 14:00 · 1 h 30 » and « Modifier »', () => {
      render();
      const row = q('.cal-day__break')!;

      expect(row.textContent).toContain('Pause déjeuner');
      expect(row.textContent).toContain('12:30 – 14:00 · 1 h 30');
      expect(row.querySelector('nz-icon')?.getAttribute('nztype')).toBe('coffee');
      [...row.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Modifier')!.click();
      expect(actions).toEqual([{ kind: 'CONFIGURE_SCHEDULE' }]);
    });

    it('shows a closed window as « Fermé · 16:00 – 17:00 »; « Rouvrir » only when the closing exception is known', () => {
      render();
      expect(q('.cal-day__closed')?.textContent).toContain('Fermé · 16:00 – 17:00');
      expect(q('.cal-day__closed button')).toBeNull();

      render(data({ blockExceptions: [{ id: 'block-1', start: '16:00', end: '17:00' }] }));
      expect(q('.cal-day__closed button')?.textContent?.trim()).toBe('Rouvrir');
    });

    it('« Rouvrir » asks for a confirmation first, then reopens that exception', () => {
      render(data({ blockExceptions: [{ id: 'block-1', start: '16:00', end: '17:00' }] }));
      const button = q<HTMLButtonElement>('.cal-day__closed button')!;
      const popconfirm = fixture.debugElement.query(By.directive(NzPopconfirmDirective)).injector.get(NzPopconfirmDirective);

      button.click();
      fixture.detectChanges();
      expect(actions).toEqual([]);

      popconfirm.nzOnConfirm.emit();
      expect(actions).toEqual([{ kind: 'REOPEN_EXCEPTION', exceptionId: 'block-1' }]);
    });

    it('a closed day shows one message « Journée fermée » with « Prolonger la journée », and no free time', () => {
      render(
        data({
          summary: { status: 'ready', error: null, day: dayWith(DAY, { level: 'CLOSED', closedReason: 'WEEKLY_OFF', workingSegments: [], breakWindow: null, blockedWindows: [], bookableSlots: 0, takenSlots: 0, loadPercent: null }) },
          slots: { status: 'ready', error: null, list: [] },
          items: { status: 'ready', error: null, list: [] },
        }),
      );

      expect(q('.cal-day__closed-day strong')?.textContent).toBe('Journée fermée');
      expect(q('.cal-day__free')).toBeNull();
      expect(q('.cal-day__slots')).toBeNull();
      expect(q('.cal-day__level')?.textContent?.trim()).toBe('Fermé');
      expect(q('.cal-day__timeline')).toBeNull();
      expect(q('.cal-day__empty')).toBeNull();
      q<HTMLButtonElement>('.cal-day__closed-day button')!.click();
      expect(actions).toEqual([{ kind: 'DAY_EXTEND', date: DAY }]);
    });

    it('fix 14: a closed EXCEPTION day with its segments and blocked window (backend payload) is closed, from level only', () => {
      render(
        data({
          summary: { status: 'ready', error: null, day: backendClosedExceptionDay(DAY) },
          slots: { status: 'ready', error: null, list: [] },
          items: { status: 'ready', error: null, list: [] },
        }),
      );

      expect(q('.cal-day__closed-day strong')?.textContent).toBe('Journée fermée');
      expect(q('.cal-day__level')?.textContent?.trim()).toBe('Fermé');
      expect(q('.cal-day__timeline')).toBeNull();
      expect(q('.cal-day__free')).toBeNull();
      expect(q('.cal-day__empty')).toBeNull();
      // The segments and the blocked window are not drawn as working time or as « Fermé » rows.
      expect(qa('.cal-day__row--closed')).toHaveLength(0);
      expect(qa('.cal-day__row--break')).toHaveLength(0);
    });

    it('an open day does not show the closed-day message', () => {
      render();
      expect(q('.cal-day__closed-day')).toBeNull();
    });
  });

  describe('now marker', () => {
    it('is a red marker with « Maintenant, 10:20 », between the rows that started and the next one, on today only', () => {
      render();
      expect(qa('.cal-day__now')).toHaveLength(1);
      expect(q('.cal-day__now')?.getAttribute('aria-label')).toBe('Maintenant, 10:20');
      const order = qa('.cal-day__list > li').map((li) => li.className);
      expect(order[1]).toContain('--now');
      expect(q('.cal-day__now-marker')).not.toBeNull();

      render(data({ dayKey: '2026-11-17', nowMs: NOW }));
      expect(q('.cal-day__now')).toBeNull();
      expect(q('.cal-day__now-marker')).toBeNull();
    });
  });

  describe('states', () => {
    it('shows skeleton rows while the appointments load', () => {
      render(data({ items: { status: 'loading', error: null, list: [] } }));

      expect(qa('.cal-day__skeleton--row')).toHaveLength(4);
      expect(q('[data-cal-id]')).toBeNull();
    });

    it('shows a header skeleton while the summary loads, and the rest of the day still renders', () => {
      render(data({ summary: { status: 'loading', error: null, day: null } }));

      expect(q('.cal-day__skeleton--header')).not.toBeNull();
      expect(qa('[data-cal-id]')).toHaveLength(4);
    });

    it('shows each source’s own error with « Réessayer »: summary', () => {
      render(data({ summary: { status: 'error', error: 'Impossible de charger le résumé de la journée.', day: null } }));

      expect(q('.cal-day__inline-error')?.textContent).toContain('Impossible de charger le résumé de la journée.');
      q<HTMLButtonElement>('.cal-day__inline-error button')!.click();
      expect(actions).toEqual([{ kind: 'RETRY_DAY_SUMMARY' }]);
      expect(qa('[data-cal-id]')).toHaveLength(4);
    });

    it('shows each source’s own error with « Réessayer »: free slots (inline), the rest of the day renders', () => {
      render(data({ slots: { status: 'error', error: 'Impossible de charger les créneaux libres.', list: null } }));

      const banner = q('.cal-day__banner--slots')!;
      expect(banner.textContent).toContain('Impossible de charger les créneaux libres.');
      banner.querySelector('button')!.click();
      expect(actions).toEqual([{ kind: 'RETRY_DAY_SLOTS' }]);
      expect(q('.cal-day__free')).toBeNull();
      expect(qa('[data-cal-id]')).toHaveLength(4);
      expect(q('.cal-day__break')).not.toBeNull();
      expect(q('.cal-day__closed')).not.toBeNull();
      expect(q('.cal-day__level')?.textContent?.trim()).toBe('Disponible');
    });

    it('shows each source’s own error with « Réessayer »: appointments', () => {
      render(data({ items: { status: 'error', error: 'Impossible de charger les rendez-vous.', list: [] } }));

      expect(q('.cal-day__banner')?.textContent).toContain('Impossible de charger les rendez-vous.');
      q<HTMLButtonElement>('.cal-day__banner button')!.click();
      expect(actions).toEqual([{ kind: 'RETRY_APPOINTMENTS' }]);
      // The free time and the break still show.
      expect(q('.cal-day__free')).not.toBeNull();
      expect(q('.cal-day__break')).not.toBeNull();
    });

    it('shows a command error under the header', () => {
      render(data({ commandError: 'Le créneau n’est plus disponible.' }));
      expect(q('.cal-day__banner')?.textContent).toContain('Le créneau n’est plus disponible.');
    });

    it('says « Aucun rendez-vous · n créneaux libres » for a day without appointment, with the free time still listed', () => {
      render(data({ items: { status: 'ready', error: null, list: [] } }));

      // CAL-FIX-2 fix 7: « Aucun rendez-vous ce jour » only when there is no free row either.
      expect(q('.cal-day__empty')?.textContent).toContain('Aucun rendez-vous · ');
      expect(q('.cal-day__free')).not.toBeNull();
    });

    it('does not say the day is empty when only the filters hide the appointments', () => {
      render(data({ hiddenStates: new Set<CalendarState>(['upcoming', 'done', 'request']) }));

      expect(q('.cal-day__empty')).toBeNull();
      expect(q('[data-cal-id]')).toBeNull();
    });
  });

  describe('Mode discret, search and filters', () => {
    it('shows initials in the rows, the aside, the timeline label and the accessible label', () => {
      render(data(), model({ discreet: true }));

      expect(rowOf('a3').textContent).toContain('L. G.');
      expect(rowOf('a3').textContent).not.toContain('Leila');
      expect(q('[data-cal-id="a3"]')?.getAttribute('aria-label')).toBe('Rendez-vous à 10:30. Statut : À venir.');
      expect(q('.cal-day__next')?.textContent).toContain('L. G.');
      expect(q('.cal-day__next')?.textContent).not.toContain('Leila');
      const timeline = q('.cal-day__timeline')?.getAttribute('aria-label') ?? '';
      expect(timeline).toContain('10:30 L. G.');
      expect(text()).not.toContain('Karim');
      expect(text()).not.toContain('Mansour');
      expect(text()).not.toContain('Sonia');
      expect(text()).not.toContain('Jlassi');
    });

    it('shows full names when Mode discret is off', () => {
      render();
      expect(text()).toContain('Karim Mansour');
      expect(q('.cal-day__timeline')?.getAttribute('aria-label')).toContain('Karim Mansour');
    });

    it('dims the rows that do not match the search and keeps the matching ones normal', () => {
      render(data(), model({ search: { active: true, results: [], ids: new Set(['a3']) } as never }));

      expect(rowOf('a3').classList).not.toContain('cal-day__item--dim');
      for (const id of ['a1', 'a4', 'r1']) expect(rowOf(id).classList).toContain('cal-day__item--dim');
    });

    it('dims nothing without a search', () => {
      render();
      expect(qa('.cal-day__item--dim')).toHaveLength(0);
    });

    it('hides the rows of a state switched off in « Filtres » (and their timeline bars), keeps the free time', () => {
      render(data({ hiddenStates: new Set<CalendarState>(['request', 'done']) }));

      expect(q('[data-cal-id="r1"]')).toBeNull();
      expect(q('[data-cal-id="a1"]')).toBeNull();
      expect(q('[data-cal-id="a3"]')).not.toBeNull();
      expect(qa('.cal-day__booked')).toHaveLength(2);
      expect(qa('.cal-day__free')).toHaveLength(3);
    });

    it('shows cancelled appointments struck through, and only when « Annulé » is not switched off', () => {
      const cancelled = care('c1', '09:00', { status: 'CANCELLED' });
      render(data({ items: { status: 'ready', error: null, list: [cancelled] } }));
      expect(rowOf('c1').classList).toContain('cal-day__item--struck');

      render(data({ items: { status: 'ready', error: null, list: [cancelled] }, hiddenStates: new Set<CalendarState>(['cancelled']) }));
      expect(q('[data-cal-id="c1"]')).toBeNull();
    });
  });

  describe('aside', () => {
    it('shows « Patient suivant · dans 10 min » with the name and the time, today only', () => {
      render();
      const card = q('.cal-day__next')!;

      expect(card.querySelector('h2')?.textContent?.trim()).toBe('Patient suivant · dans 10 min');
      expect(card.textContent).toContain('Leila Gharbi');
      expect(card.textContent).toContain('10:30');

      render(data({ dayKey: '2026-11-17' }));
      expect(q('.cal-day__next')).toBeNull();
    });

    it('« Voir le dossier » is only for practice patients', () => {
      render();
      const card = q('.cal-day__next')!;
      expect([...card.querySelectorAll('button')].map((button) => button.textContent?.trim())).toEqual(['Voir le dossier']);
      card.querySelector('button')!.click();
      expect(actions).toEqual([{ kind: 'DAY_OPEN_PATIENT_FILE', id: 'a3' }]);

      render(data({ items: { status: 'ready', error: null, list: [care('p', '10:30', named('Nadia Ben Salah'))] } }));
      expect(q('.cal-day__next button')).toBeNull();
      expect(q('.cal-day__next')?.textContent).toContain('Nadia Ben Salah');
    });

    it('says so when nobody is left today', () => {
      render(data({ items: { status: 'ready', error: null, list: [care('done', '08:30', { status: 'COMPLETED' })] } }));
      expect(q('.cal-day__next')?.textContent).toContain('Aucun patient à venir');
    });

    it('« Résumé » lists the API counts as received and the FREE slot count', () => {
      render();
      const lines = qa('.cal-day__summary-line').map((line) => summaryLine(line));

      expect(lines).toEqual([
        'Terminés 0',
        'Suivis terminés 0',
        'En cours 0',
        'À venir 2',
        'Suivis à venir 2',
        'Demandes en attente 2',
        'Créneaux libres 7',
      ]);
    });

    it('« Créneaux libres » counts the FREE slots, not the merged rows, and follows the slots as received', () => {
      render(data({ slots: { status: 'ready', error: null, list: daySlotsWith([{ start: '09:00', end: '09:30', state: 'FREE' }, { start: '09:30', end: '10:00', state: 'FREE' }, { start: '10:00', end: '10:30', state: 'TAKEN' }]).slots } }));

      expect(summaryLine(qa('.cal-day__summary-line').pop()!)).toBe('Créneaux libres 2');
      expect(qa('.cal-day__free')).toHaveLength(1);
    });

    it('« Créneaux libres » is left out while the slots are not loaded', () => {
      render(data({ slots: { status: 'loading', error: null, list: null } }));
      expect(qa('.cal-day__summary-line').some((line) => line.textContent?.includes('Créneaux libres'))).toBe(false);
    });
  });

  describe('accessibility helpers', () => {
    it('scrollToRow brings the row into view; focusedRow reports the focused row', () => {
      render();
      const open = q<HTMLButtonElement>('[data-cal-id="a4"]')!;
      let scrolled = 0;
      open.scrollIntoView = () => {
        scrolled += 1;
      };

      fixture.componentInstance.scrollToRow('a4');
      fixture.componentInstance.scrollToRow('missing');
      expect(scrolled).toBe(1);

      expect(fixture.componentInstance.focusedRow()).toBeNull();
      open.focus();
      expect(fixture.componentInstance.focusedRow()).toEqual({ id: 'a4', resource: 'appointment' });
      q<HTMLButtonElement>('[data-cal-id="r1"]')!.focus();
      expect(fixture.componentInstance.focusedRow()).toEqual({ id: 'r1', resource: 'request' });
    });

    it('has real buttons for every action (no clickable div)', () => {
      render();
      expect(qa('.cal-day__actions [role="button"], .cal-day__free [role="button"]')).toHaveLength(0);
      expect(qa('.cal-day__actions button').length).toBeGreaterThan(0);
    });
  });

  describe('CAL-FIX-2', () => {
    const PAST_DAY = '2026-11-13';
    const FUTURE_DAY = '2026-11-17';
    const pastWidth = (): string | null => q<HTMLElement>('.cal-day__past')?.style.width ?? null;

    it('fix 6: a past day reads « Passé » (neutral) and its whole timeline is grey', () => {
      render(data({ dayKey: PAST_DAY, summary: { status: 'ready', error: null, day: fixtureDay(PAST_DAY) }, items: { status: 'ready', error: null, list: [] }, slots: { status: 'ready', error: null, list: [] } }));
      expect(q('.cal-day__level')?.textContent?.trim()).toBe('Passé');
      expect(q('.cal-day__level')?.className).toContain('cal-day__level--past');
      expect(pastWidth()).toBe('100%');
      expect(text()).not.toContain('+ Ajouter');
      expect(q('.cal-day__new')).toBeNull();
    });

    it('fix 6: today keeps its level chip; only the time before now (10:20) is grey', () => {
      render();
      expect(q('.cal-day__level')?.textContent?.trim()).not.toBe('Passé');
      // span 08:00 – 18:00, now 10:20 → 140 / 600 minutes
      expect(parseFloat(pastWidth() ?? '0')).toBeCloseTo((140 / 600) * 100, 3);
    });

    it('fix 6: a future day has no grey part and keeps its level chip', () => {
      render(data({ dayKey: FUTURE_DAY, summary: { status: 'ready', error: null, day: fixtureDay(FUTURE_DAY) }, items: { status: 'ready', error: null, list: [] } }));
      expect(q('.cal-day__level')?.textContent?.trim()).toBe('Chargé');
      expect(q('.cal-day__past')).toBeNull();
    });

    it('fix 6: a past day that is closed still reads « Fermé »', () => {
      render(data({ dayKey: PAST_DAY, summary: { status: 'ready', error: null, day: dayWith(PAST_DAY, { level: 'CLOSED', closedReason: 'WEEKLY_OFF', workingSegments: [], breakWindow: null, bookableSlots: 0, takenSlots: 0, loadPercent: null }) }, items: { status: 'ready', error: null, list: [] }, slots: { status: 'ready', error: null, list: [] } }));
      expect(q('.cal-day__level')?.textContent?.trim()).toBe('Fermé');
    });

    it('fix 7: no appointment but free rows → « Aucun rendez-vous · n créneaux libres »', () => {
      render(data({ items: { status: 'ready', error: null, list: [] } }));
      const free = daySlotsFixture().slots.filter((slot) => slot.state === 'FREE').length;
      expect(q('.cal-day__empty')?.textContent?.trim()).toBe(`Aucun rendez-vous · ${free} créneaux libres`);
      expect(qa('.cal-day__free').length).toBeGreaterThan(0);

      render(data({ items: { status: 'ready', error: null, list: [] }, slots: { status: 'ready', error: null, list: [{ start: '16:00', end: '16:30', state: 'FREE' }] } }));
      expect(q('.cal-day__empty')?.textContent?.trim()).toBe('Aucun rendez-vous · 1 créneau libre');
    });

    it('fix 7: « Aucun rendez-vous ce jour » only with no appointment and no free row', () => {
      render(data({ items: { status: 'ready', error: null, list: [] }, slots: { status: 'ready', error: null, list: [{ start: '08:00', end: '08:30', state: 'PAST' }] } }));
      expect(q('.cal-day__empty')?.textContent?.trim()).toBe('Aucun rendez-vous ce jour');
      expect(q('.cal-day__free')).toBeNull();
    });

    it('fix 8: « Nouveau rendez-vous » card with the first free slot opens the booking drawer on it', () => {
      render();
      const card = q('.cal-day__new') as HTMLElement;
      expect(card.querySelector('h2')?.textContent?.trim()).toBe('Nouveau rendez-vous');
      expect(card.textContent?.replace(/\s+/g, ' ')).toContain('Premier créneau libre : 11:00');
      expect(card.textContent).not.toMatch(/durée|type/i);
      (card.querySelector('button') as HTMLButtonElement).click();
      expect(card.querySelector('button')?.textContent?.trim()).toBe('Choisir le patient');
      expect(actions).toEqual([{ kind: 'DAY_ADD_SLOT', date: DAY, start: '11:00' }]);
    });

    it('fix 8: the card is hidden when the day has no free slot', () => {
      render(data({ slots: { status: 'ready', error: null, list: [{ start: '08:00', end: '08:30', state: 'TAKEN' }] } }));
      expect(q('.cal-day__new')).toBeNull();
    });

    it('fix 8: « Patient suivant » appears with a future confirmed appointment of today', () => {
      render(data({ items: { status: 'ready', error: null, list: [care('next', '11:00', named('Nadia Ben Salah'))] } }));
      expect(q('.cal-day__next-title')?.textContent?.trim()).toBe('Patient suivant · dans 40 min');
      expect(q('.cal-day__next-name')?.textContent?.trim()).toBe('Nadia Ben Salah');
    });
  });
});

