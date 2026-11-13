import { describe, expect, it } from 'vitest';

import type { DoctorScheduledCareItem } from '../scheduled-care/scheduled-care.models';
import { MIN_SEARCH_LENGTH, normalizeSearchText, searchCalendarItems } from './calendar-search';

function item(overrides: Record<string, unknown> = {}): DoctorScheduledCareItem {
  return {
    resourceType: 'APPOINTMENT',
    requestId: null,
    appointmentId: 'apt-1',
    sourceBookingRequestId: null,
    version: 1,
    status: 'CONFIRMED',
    doctor: { displayName: 'Dr Test', specialty: null },
    subject: { subjectType: 'SELF', displayName: 'Hélène Ben Ali', relationship: null },
    cabinet: { name: 'Cabinet', address: '', city: '', governorate: '', timezone: 'Africa/Tunis' },
    // Monday 16 November 2026, 09:30 in Tunis.
    start: '2026-11-16T08:30:00.000Z',
    end: '2026-11-16T09:00:00.000Z',
    timezone: 'Africa/Tunis',
    responseDeadline: null,
    cancellation: null,
    intakeStatus: null,
    availableActions: [],
    sortAt: '2026-11-16T08:30:00.000Z',
    updatedAt: '2026-11-16T08:30:00.000Z',
    ...overrides,
  } as DoctorScheduledCareItem;
}

const request = (id: string, name: string, start = '2026-11-17T09:00:00.000Z') =>
  item({
    resourceType: 'BOOKING_REQUEST',
    requestId: id,
    appointmentId: null,
    status: 'PENDING_DOCTOR',
    subject: { subjectType: 'SELF', displayName: name, relationship: null },
    start,
    end: '2026-11-17T09:30:00.000Z',
  });

describe('normalizeSearchText', () => {
  it('ignores case, accents and extra spaces', () => {
    expect(normalizeSearchText('  Hélène   BEN Ali ')).toBe('helene ben ali');
    expect(normalizeSearchText('ÉMILE')).toBe('emile');
    expect(normalizeSearchText('Zoë Çelik')).toBe('zoe celik');
  });

  it('copes with empty input', () => {
    expect(normalizeSearchText(null)).toBe('');
    expect(normalizeSearchText(undefined)).toBe('');
    expect(normalizeSearchText('')).toBe('');
  });
});

describe('searchCalendarItems', () => {
  const items = [
    item(),
    item({
      appointmentId: 'apt-2',
      subject: { subjectType: 'SELF', displayName: 'Karim Mansour', relationship: null },
      start: '2026-11-16T07:00:00.000Z',
      end: '2026-11-16T07:30:00.000Z',
    }),
    request('req-1', 'Hélène Trabelsi'),
  ];

  it('needs at least two characters', () => {
    expect(MIN_SEARCH_LENGTH).toBe(2);
    for (const query of ['', ' ', 'h', ' h ']) {
      const outcome = searchCalendarItems(items, query, false);
      expect(outcome.active).toBe(false);
      expect(outcome.results).toEqual([]);
      expect(outcome.ids.size).toBe(0);
    }
    expect(searchCalendarItems(items, 'he', false).active).toBe(true);
  });

  it('matches without caring about case or accents', () => {
    for (const query of ['helene', 'HÉLÈNE', 'hélène', 'hEleNe']) {
      expect(searchCalendarItems(items, query, false).results.map((r) => r.id)).toEqual(['apt-1', 'req-1']);
    }
  });

  it('matches part of a name, in any word', () => {
    expect(searchCalendarItems(items, 'ben ali', false).results.map((r) => r.id)).toEqual(['apt-1']);
    expect(searchCalendarItems(items, 'mans', false).results.map((r) => r.id)).toEqual(['apt-2']);
  });

  it('lists appointments and requests together, in time order, with their state', () => {
    // Clock pinned before the appointments, so « À venir » does not turn into « Non clôturé » with time.
    const { results } = searchCalendarItems(items, 'helene', false, Date.parse('2026-11-01T00:00:00.000Z'));

    expect(results.map((r) => r.kind)).toEqual(['appointment', 'request']);
    expect(results[0]).toMatchObject({
      id: 'apt-1',
      dayKey: '2026-11-16',
      timeLabel: '09:30',
      name: 'Hélène Ben Ali',
      stateLabel: 'À venir',
      cssClass: 'oc-cal-state--upcoming',
    });
    expect(results[1]).toMatchObject({
      id: 'req-1',
      dayKey: '2026-11-17',
      timeLabel: '10:00',
      stateLabel: 'Demande',
      cssClass: 'oc-cal-state--request',
    });
    expect(results[0]?.dayLabel).toMatch(/lun\.? 16 nov/i);
  });

  it('sorts results by time, not by the order of the list', () => {
    const outcome = searchCalendarItems([...items].reverse(), 'e', false);

    const times = outcome.results.map((r) => r.startMs);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it('only searches what it is given: the loaded period', () => {
    const outcome = searchCalendarItems([items[1] as DoctorScheduledCareItem], 'helene', false);

    expect(outcome.active).toBe(true);
    expect(outcome.results).toEqual([]);
    expect(outcome.ids.size).toBe(0);
  });

  it('returns the ids of the matching cards (the others are dimmed)', () => {
    const outcome = searchCalendarItems(items, 'helene', false);

    expect([...outcome.ids].sort()).toEqual(['apt-1', 'req-1']);
    expect(outcome.ids.has('apt-2')).toBe(false);
  });

  it('shows initials only in Mode discret, but still finds by name', () => {
    const outcome = searchCalendarItems(items, 'helene', true);

    expect(outcome.results.map((r) => r.name)).toEqual(['H. B.', 'H. T.']);
    expect(JSON.stringify(outcome.results)).not.toContain('Hélène');
    expect(JSON.stringify(outcome.results)).not.toContain('Trabelsi');
  });

  it('reports the Tunis day of an appointment at 23:30 UTC as the next day', () => {
    const late = item({ appointmentId: 'late', start: '2026-11-15T23:30:00.000Z', end: '2026-11-16T00:00:00.000Z' });

    expect(searchCalendarItems([late], 'helene', false).results[0]).toMatchObject({
      dayKey: '2026-11-16',
      timeLabel: '00:30',
    });
  });

  it('skips items without an identity or a valid time', () => {
    const broken = [
      item({ appointmentId: null }),
      item({ appointmentId: 'no-time', start: 'soon' }),
      item({ resourceType: 'SOMETHING' }),
    ];

    expect(searchCalendarItems(broken, 'helene', false).results).toEqual([]);
  });

  it('marks follow-ups with their own state', () => {
    const followUp = item({ appointmentId: 'fu', followUp: true });

    expect(searchCalendarItems([followUp], 'helene', false).results[0]?.stateLabel).toBe('Suivi à venir');
  });

  it('fix 5: a confirmed appointment already over reads « Non clôturé », never « À venir »', () => {
    const after = Date.parse('2026-11-16T09:00:00.000Z'); // its exact end
    const [result] = searchCalendarItems([item()], 'helene', false, after).results;
    expect(result).toMatchObject({ stateLabel: 'Non clôturé' });
    expect(result?.cssClass).toContain('oc-cal-state--not-closed');
    expect(searchCalendarItems([item()], 'helene', false, after - 1).results[0]?.stateLabel).toBe('À venir');
  });
});

