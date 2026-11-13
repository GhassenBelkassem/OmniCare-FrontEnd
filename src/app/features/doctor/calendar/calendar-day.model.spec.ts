import { describe, expect, it } from 'vitest';

import type { DoctorScheduledCareItem } from '../scheduled-care/scheduled-care.models';
import type { DaySlot } from './calendar-day-slots.models';
import {
  buildDayRows,
  buildDayTimeline,
  dayItems,
  durationLabel,
  freeSlotCount,
  mergeFreeSlots,
  nextPatient,
  nextStartableId,
  pendingChipText,
  summaryLines,
  untilLabel,
  type DayRow,
  type FreeRow,
  type ItemRow,
} from './calendar-day.model';
import type { CalendarState } from './calendar-presentation';
import { at } from './calendar-time.testing';
import { daySlotsFixture } from './testing/day-slots.testing';
import { dayWith, fixtureDay } from './testing/calendar-summary.testing';

const DAY = '2026-11-16';
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

function request(id: string, time: string, status = 'PENDING_DOCTOR'): DoctorScheduledCareItem {
  return care('unused', time, {
    resourceType: 'BOOKING_REQUEST',
    requestId: id,
    appointmentId: null,
    status: status as DoctorScheduledCareItem['status'],
    availableActions: ['ACCEPT_REQUEST', 'DECLINE_REQUEST'],
  });
}

const slot = (start: string, end: string, state: DaySlot['state']): DaySlot => ({ start, end, state });
const none = new Set<CalendarState>();
const kinds = (rows: readonly DayRow[]): string[] =>
  rows.map((row) => (row.kind === 'item' ? row.id : `${row.kind}:${row.timeLabel}`));

function input(overrides: Partial<Parameters<typeof buildDayRows>[0]> = {}): Parameters<typeof buildDayRows>[0] {
  return {
    dayKey: DAY,
    nowMs: NOW,
    items: [],
    hiddenStates: none,
    slots: daySlotsFixture().slots,
    summary: fixtureDay(DAY),
    blockExceptions: [],
    startableId: null,
    ...overrides,
  };
}

describe('free rows (day-slots)', () => {
  it('merges consecutive FREE slots into one run', () => {
    expect(
      mergeFreeSlots([
        slot('11:00', '11:30', 'FREE'),
        slot('11:30', '12:00', 'FREE'),
        slot('12:00', '12:30', 'FREE'),
      ]),
    ).toEqual([{ start: '11:00', end: '12:30', slotCount: 3 }]);
  });

  it('keeps separate runs apart when there is a gap or a taken slot between them', () => {
    expect(
      mergeFreeSlots([
        slot('11:00', '11:30', 'FREE'),
        slot('11:30', '12:00', 'TAKEN'),
        slot('12:00', '12:30', 'FREE'),
        slot('14:00', '14:30', 'FREE'),
      ]),
    ).toEqual([
      { start: '11:00', end: '11:30', slotCount: 1 },
      { start: '12:00', end: '12:30', slotCount: 1 },
      { start: '14:00', end: '14:30', slotCount: 1 },
    ]);
  });

  it('never turns a PAST or TAKEN slot into free time, even when it touches a FREE one', () => {
    const runs = mergeFreeSlots([
      slot('08:00', '08:30', 'PAST'),
      slot('08:30', '09:00', 'FREE'),
      slot('09:00', '09:30', 'TAKEN'),
    ]);

    expect(runs).toEqual([{ start: '08:30', end: '09:00', slotCount: 1 }]);
    expect(mergeFreeSlots([slot('08:00', '08:30', 'PAST'), slot('08:30', '09:00', 'TAKEN')])).toEqual([]);
  });

  it('merges slots given out of order', () => {
    expect(mergeFreeSlots([slot('09:30', '10:00', 'FREE'), slot('09:00', '09:30', 'FREE')])).toEqual([
      { start: '09:00', end: '10:00', slotCount: 2 },
    ]);
  });

  it('the fixture gives three free rows: 11:00–12:30, 14:30–16:00, 17:00–17:30', () => {
    expect(mergeFreeSlots(daySlotsFixture().slots)).toEqual([
      { start: '11:00', end: '12:30', slotCount: 3 },
      { start: '14:30', end: '16:00', slotCount: 3 },
      { start: '17:00', end: '17:30', slotCount: 1 },
    ]);
  });

  it('counts the FREE slots as listed (not the merged rows), and nothing without an answer', () => {
    expect(freeSlotCount(daySlotsFixture().slots)).toBe(7);
    expect(freeSlotCount(null)).toBe(0);
  });
});

describe('rows of the day', () => {
  const items = [
    care('a4', '14:00'),
    care('a1', '08:30', { status: 'COMPLETED' }),
    care('a3', '10:30'),
    request('r1', '15:00'),
  ];

  it('are in time order: items, free rows, the break and the closed windows, with the now row between them', () => {
    const rows = buildDayRows(input({ items }));

    expect(kinds(rows)).toEqual([
      'a1',
      'now:10:20',
      'a3',
      'free:11:00',
      'break:12:30',
      'a4',
      'free:14:30',
      'r1',
      'closed:16:00',
      'free:17:00',
    ]);
  });

  it('shows a free row as « Libre · 11:00 – 12:30 » and never a PAST or TAKEN slot as free', () => {
    const rows = buildDayRows(input());
    const free = rows.filter((row): row is FreeRow => row.kind === 'free');

    expect(free.map((row) => row.label)).toEqual([
      'Libre · 11:00 – 12:30',
      'Libre · 14:30 – 16:00',
      'Libre · 17:00 – 17:30',
    ]);
    // 08:00–10:30 is past or taken in the fixture: no free row starts there.
    expect(free.every((row) => row.startMin >= 11 * 60)).toBe(true);
  });

  it('has the break row with its title, range and length: « Pause déjeuner », « 12:30 – 14:00 · 1 h 30 »', () => {
    const row = buildDayRows(input()).find((candidate) => candidate.kind === 'break');

    expect(row).toMatchObject({ title: 'Pause déjeuner', rangeLabel: '12:30 – 14:00 · 1 h 30' });
  });

  it('has the closed window row, with the closing exception when it is loaded', () => {
    const withoutException = buildDayRows(input()).find((row) => row.kind === 'closed');
    expect(withoutException).toMatchObject({ label: 'Fermé · 16:00 – 17:00', exceptionId: null });

    const matched = buildDayRows(
      input({ blockExceptions: [{ id: 'block-1', start: '16:00', end: '17:00' }] }),
    ).find((row) => row.kind === 'closed');
    expect(matched).toMatchObject({ exceptionId: 'block-1' });

    const other = buildDayRows(
      input({ blockExceptions: [{ id: 'block-2', start: '16:00', end: '16:30' }] }),
    ).find((row) => row.kind === 'closed');
    expect(other).toMatchObject({ exceptionId: null });
  });

  it('puts the now marker only on today, after the rows that started and before the next one', () => {
    const today = buildDayRows(input({ items }));
    expect(today.filter((row) => row.kind === 'now')).toHaveLength(1);
    expect(today.find((row) => row.kind === 'now')).toMatchObject({ ariaLabel: 'Maintenant, 10:20' });

    // The same clock on another day: no marker.
    const otherDay = buildDayRows(input({ dayKey: '2026-11-17', items: [], slots: [], summary: null }));
    expect(otherDay.some((row) => row.kind === 'now')).toBe(false);
    // Yesterday's clock for today's list: still none (not today).
    expect(buildDayRows(input({ nowMs: at('2026-11-15', '10:20').getTime() })).some((row) => row.kind === 'now')).toBe(
      false,
    );
  });

  it('puts the now marker last when everything has started, and first when nothing has', () => {
    const late = buildDayRows(input({ nowMs: at(DAY, '23:00').getTime() }));
    expect(late.at(-1)?.kind).toBe('now');
    const early = buildDayRows(input({ nowMs: at(DAY, '06:00').getTime() }));
    expect(early[0]?.kind).toBe('now');
  });

  it('shows no free row, break or closed window on a closed day', () => {
    const rows = buildDayRows(
      input({ summary: dayWith(DAY, { level: 'CLOSED', closedReason: 'WEEKLY_OFF' }), items }),
    );

    expect(rows.filter((row) => row.kind !== 'item' && row.kind !== 'now')).toEqual([]);
    expect(rows.filter((row) => row.kind === 'item')).toHaveLength(4);
  });

  it('shows no free row while the slots are unknown, but keeps the items and the break', () => {
    const rows = buildDayRows(input({ slots: null, items }));

    expect(rows.some((row) => row.kind === 'free')).toBe(false);
    expect(rows.some((row) => row.kind === 'break')).toBe(true);
  });

  it('hides the states the doctor switched off in « Filtres », without touching the free time', () => {
    const rows = buildDayRows(input({ items, hiddenStates: new Set<CalendarState>(['request', 'done']) }));

    expect(rows.filter((row): row is ItemRow => row.kind === 'item').map((row) => row.id)).toEqual(['a3', 'a4']);
    expect(rows.filter((row) => row.kind === 'free')).toHaveLength(3);
  });

  it('ignores an item of another Tunis day, and a request without an exact time', () => {
    const rows = dayItems(
      [care('mon', '09:00'), care('tue', '09:00', {}, '2026-11-17'), request('r', '10:00')],
      DAY,
      none,
    );
    expect(rows.map((item) => item.appointmentId ?? item.requestId)).toEqual(['mon', 'r']);

    const noTime = { ...request('nt', '10:00'), end: '' } as DoctorScheduledCareItem;
    expect(dayItems([noTime], DAY, none)).toEqual([]);
  });

  it('puts an appointment of the last Tunis hour on the right day whatever the runner zone (23:30 Tunis)', () => {
    const late = care('late', '23:30');
    expect(dayItems([late], DAY, none)).toHaveLength(1);
    expect(dayItems([late], '2026-11-17', none)).toHaveLength(0);
  });

  it('carries the CAL-1 state, label and colour class of each item', () => {
    // 11:00 is still ahead of « now » (10:20), so the follow-up is « Suivi à venir ».
    const rows = buildDayRows(input({ items: [care('f', '11:00', { followUp: true }), request('r', '15:00')] }));
    const follow = rows.find((row): row is ItemRow => row.kind === 'item' && row.id === 'f');
    const demand = rows.find((row): row is ItemRow => row.kind === 'item' && row.id === 'r');

    expect(follow).toMatchObject({ state: 'followUpUpcoming', stateLabel: 'Suivi à venir', cssClass: 'oc-cal-state--followUpUpcoming' });
    expect(demand).toMatchObject({ state: 'request', stateLabel: 'Demande', dashed: true, isRequest: true });
  });

  it('fix 5: a confirmed appointment already over and never started reads « Non clôturé », never « À venir »', () => {
    // NOW is 10:20; the 09:00 appointment (ends 09:30) is over, the 10:00 one still runs until 10:30.
    const rows = buildDayRows(input({ items: [care('past', '09:00'), care('follow', '08:00', { followUp: true }), care('running', '10:00')] }));
    const item = (id: string) => rows.find((row): row is ItemRow => row.kind === 'item' && row.id === id);

    expect(item('past')).toMatchObject({ state: 'upcoming', stateLabel: 'Non clôturé' });
    expect(item('past')?.cssClass).toContain('oc-cal-state--not-closed');
    expect(item('follow')).toMatchObject({ state: 'followUpUpcoming', stateLabel: 'Non clôturé' });
    expect(item('running')).toMatchObject({ state: 'upcoming', stateLabel: 'À venir' });
    expect(rows.some((row) => row.kind === 'item' && row.stateLabel === 'À venir' && row.id === 'past')).toBe(false);
  });
});

describe('« Démarrer » eligibility', () => {
  const items = [care('late', '16:00'), care('a3', '10:30'), care('done', '08:30', { status: 'COMPLETED' })];

  it('is the first CONFIRMED appointment of today that has not ended, and nobody else', () => {
    expect(nextStartableId(items, DAY, NOW, true)).toBe('a3');
    const rows = buildDayRows(input({ items, startableId: nextStartableId(items, DAY, NOW, true) }));
    expect(rows.filter((row): row is ItemRow => row.kind === 'item').filter((row) => row.canStart).map((row) => row.id)).toEqual(['a3']);
  });

  it('moves on to the next one once the first has ended', () => {
    expect(nextStartableId(items, DAY, at(DAY, '11:30').getTime(), true)).toBe('late');
    expect(nextStartableId(items, DAY, at(DAY, '17:00').getTime(), true)).toBeNull();
  });

  it('is offered to nobody while another consultation runs (same condition as the panel)', () => {
    expect(nextStartableId(items, DAY, NOW, false)).toBeNull();
  });

  it('is offered to nobody on another day than today', () => {
    expect(nextStartableId([care('x', '10:30', {}, '2026-11-17')], '2026-11-17', NOW, true)).toBeNull();
    expect(nextStartableId(items, DAY, at('2026-11-15', '10:20').getTime(), true)).toBeNull();
  });

  it('is never offered on a request, a proposed, an in-progress or a cancelled appointment', () => {
    const others = [
      request('r', '10:30'),
      care('p', '10:30', { status: 'PROPOSED' }),
      care('i', '10:30', { status: 'IN_PROGRESS' }),
      care('c', '10:30', { status: 'CANCELLED' }),
    ];
    expect(nextStartableId(others, DAY, NOW, true)).toBeNull();
  });
});

describe('timeline (14 px bar)', () => {
  const summary = fixtureDay(DAY);

  it('has the working segments, the break in grey, the closed window and the booked appointments as bars', () => {
    const line = buildDayTimeline(
      summary,
      [care('a1', '08:30', { status: 'COMPLETED' }), care('a3', '10:30'), request('r', '15:00')],
      none,
      DAY,
      NOW,
      false,
    );

    expect(line?.segments).toHaveLength(2);
    expect(line?.breakBar).not.toBeNull();
    expect(line?.blocked).toHaveLength(1);
    expect(line?.booked.map((bar) => bar.id)).toEqual(['a1', 'a3']);
    expect(line?.booked[0].cssClass).toBe('oc-cal-state--done');
    expect(line?.booked[1].cssClass).toBe('oc-cal-state--upcoming');
  });

  it('never draws a cancelled appointment as booked, nor a state switched off in « Filtres »', () => {
    const items = [care('x', '09:00', { status: 'CANCELLED' }), care('y', '10:00'), care('z', '11:00', { status: 'COMPLETED' })];

    expect(buildDayTimeline(summary, items, none, DAY, NOW, false)?.booked.map((bar) => bar.id)).toEqual(['y', 'z']);
    expect(
      buildDayTimeline(summary, items, new Set<CalendarState>(['done']), DAY, NOW, false)?.booked.map((bar) => bar.id),
    ).toEqual(['y']);
  });

  it('has the red now marker only today and only inside the drawn hours', () => {
    expect(buildDayTimeline(summary, [], none, DAY, NOW, false)?.nowPercent).not.toBeNull();
    expect(buildDayTimeline(summary, [], none, DAY, at('2026-11-15', '10:20').getTime(), false)?.nowPercent).toBeNull();
    expect(buildDayTimeline(summary, [], none, DAY, at(DAY, '06:00').getTime(), false)?.nowPercent).toBeNull();
    expect(buildDayTimeline(summary, [], none, DAY, at(DAY, '19:30').getTime(), false)?.nowPercent).toBeNull();
  });

  it('labels the hours under the bar from the first to the last working hour', () => {
    const ticks = buildDayTimeline(summary, [], none, DAY, NOW, false)?.ticks.map((tick) => tick.label);

    expect(ticks?.[0]).toBe('08');
    expect(ticks?.at(-1)).toBe('18');
    expect(ticks).toHaveLength(11);
  });

  it('speaks names, or only initials in « Mode discret »', () => {
    const items = [care('a', '10:30', { subject: { subjectType: 'SELF', displayName: 'Karim Mansour', relationship: null } })];

    expect(buildDayTimeline(summary, items, none, DAY, NOW, false)?.ariaLabel).toContain('10:30 Karim Mansour');
    const discreet = buildDayTimeline(summary, items, none, DAY, NOW, true)?.ariaLabel ?? '';
    expect(discreet).toContain('10:30 K. M.');
    expect(discreet).not.toContain('Karim');
    expect(discreet).not.toContain('Mansour');
  });

  it('draws nothing for a closed day or a missing summary', () => {
    expect(buildDayTimeline(dayWith(DAY, { level: 'CLOSED', closedReason: 'WEEKLY_OFF', workingSegments: [] }), [], none, DAY, NOW, false)).toBeNull();
    expect(buildDayTimeline(null, [], none, DAY, NOW, false)).toBeNull();
  });
});

describe('aside', () => {
  it('« Patient suivant »: today only, the next CONFIRMED appointment that has not started, in minutes', () => {
    const next = nextPatient([care('a4', '14:00'), care('a3', '10:30', { subject: { subjectType: 'PRACTICE_PATIENT', displayName: 'Leila Gharbi', relationship: null } })], DAY, NOW, none);

    expect(next).toMatchObject({ id: 'a3', timeLabel: '10:30', minutesUntil: 10, isPracticePatient: true });
    expect(untilLabel(next?.minutesUntil ?? 0)).toBe('dans 10 min');
    expect(untilLabel(65)).toBe('dans 1 h 05');
    expect(untilLabel(0)).toBe('maintenant');
  });

  it('has no next patient on another day, after the last one, or for a started appointment', () => {
    expect(nextPatient([care('a', '10:30')], DAY, at('2026-11-15', '10:20').getTime(), none)).toBeNull();
    expect(nextPatient([care('a', '10:30')], DAY, at(DAY, '10:45').getTime(), none)).toBeNull();
    expect(nextPatient([care('a', '10:30', { status: 'IN_PROGRESS' })], DAY, NOW, none)).toBeNull();
  });

  it('« Résumé » shows the API counts as received, plus the FREE slot count of day-slots', () => {
    const lines = summaryLines(fixtureDay(DAY), 7);

    expect(lines.map((line) => `${line.label}: ${line.value}`)).toEqual([
      'Terminés: 0',
      'Suivis terminés: 0',
      'En cours: 0',
      'À venir: 2',
      'Suivis à venir: 2',
      'Demandes en attente: 2',
      'Créneaux libres: 7',
    ]);
  });

  it('« Résumé » does not invent « Créneaux libres » without the slots, nor counts without the summary', () => {
    expect(summaryLines(fixtureDay(DAY), null).some((line) => line.key === 'free')).toBe(false);
    expect(summaryLines(null, 4).map((line) => line.key)).toEqual(['free']);
  });
});

describe('texts', () => {
  it('durations: « 45 min », « 1 h », « 1 h 30 »', () => {
    expect(durationLabel(45)).toBe('45 min');
    expect(durationLabel(60)).toBe('1 h');
    expect(durationLabel(90)).toBe('1 h 30');
  });

  it('pending requests chip: singular and plural', () => {
    expect(pendingChipText(1)).toBe('1 demande en attente');
    expect(pendingChipText(2)).toBe('2 demandes en attente');
  });
});
