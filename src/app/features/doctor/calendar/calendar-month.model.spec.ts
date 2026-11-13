import { describe, expect, it } from 'vitest';

import {
  DOT_COLOR,
  barWidthPercent,
  buildDayDots,
  buildTimeline,
  closedText,
  dayAriaLabel,
  dotCounts,
  legendLevels,
} from './calendar-month.model';
import type { CalendarState } from './calendar-presentation';
import { dayWith, fixtureDay } from './testing/calendar-summary.testing';

const none = new Set<CalendarState>();

describe('month day model', () => {
  describe('dots', () => {
    it('maps the counts to the canvas colours, follow-ups apart, pending requests last', () => {
      const day = fixtureDay('2026-11-17'); // CONFIRMED 8 (1 follow-up), COMPLETED 2 (1 follow-up), 1 request, 1 awaiting
      const { dots, overflow } = buildDayDots(day, none);

      expect(dotCounts(day)).toEqual({
        upcoming: 7,
        followUpUpcoming: 1,
        inProgress: 0,
        done: 1,
        followUpDone: 1,
        absent: 0,
        waitingPatient: 1,
        request: 1,
      });
      expect(dots.map((dot) => dot.color)).toEqual([
        DOT_COLOR.upcoming, DOT_COLOR.upcoming, DOT_COLOR.upcoming, DOT_COLOR.upcoming, DOT_COLOR.upcoming,
      ]);
      expect(overflow).toBe(7);
    });

    it('uses the exact colours of the canvas', () => {
      expect(DOT_COLOR).toEqual({
        upcoming: '#2563EB',
        followUpUpcoming: '#7A5AF8',
        inProgress: '#0F826D',
        done: '#0F826D',
        followUpDone: '#BDB4FE',
        absent: '#D92D20',
        waitingPatient: '#93C5FD',
        request: '#F79009',
      });
    });

    it('shows every kind in order when they fit, the requests last', () => {
      const day = dayWith('2026-11-16', {
        countsByStatus: { CONFIRMED: 1, IN_PROGRESS: 1, COMPLETED: 1, NO_SHOW: 1, CANCELLED: 4, PROPOSED: 0 },
        followUpCountsByStatus: { CONFIRMED: 0, COMPLETED: 0 },
        pendingRequestCount: 1,
        awaitingPatientRequestCount: 0,
      });
      const { dots, overflow } = buildDayDots(day, none);

      expect(dots.map((dot) => dot.kind)).toEqual(['upcoming', 'inProgress', 'done', 'absent', 'request']);
      expect(overflow).toBe(0);
    });

    it('splits follow-up from non-follow-up for confirmed and completed', () => {
      const day = dayWith('2026-11-16', {
        countsByStatus: { CONFIRMED: 2, COMPLETED: 2, IN_PROGRESS: 0, NO_SHOW: 0, CANCELLED: 0, PROPOSED: 0 },
        followUpCountsByStatus: { CONFIRMED: 1, COMPLETED: 1 },
        pendingRequestCount: 0,
      });
      expect(buildDayDots(day, none).dots.map((dot) => dot.kind)).toEqual([
        'upcoming', 'followUpUpcoming', 'done', 'followUpDone',
      ]);
    });

    it('puts PROPOSED and awaiting-patient requests on the same light-blue dot', () => {
      const day = dayWith('2026-11-16', {
        countsByStatus: { CONFIRMED: 0, IN_PROGRESS: 0, COMPLETED: 0, NO_SHOW: 0, CANCELLED: 0, PROPOSED: 1 },
        followUpCountsByStatus: { CONFIRMED: 0, COMPLETED: 0 },
        pendingRequestCount: 0,
        awaitingPatientRequestCount: 2,
      });
      const { dots } = buildDayDots(day, none);
      expect(dots).toHaveLength(3);
      expect(new Set(dots.map((dot) => dot.color))).toEqual(new Set(['#93C5FD']));
    });

    it('shows at most 5 dots then « +n », and never a cancelled one', () => {
      const day = dayWith('2026-11-16', {
        countsByStatus: { CONFIRMED: 7, IN_PROGRESS: 0, COMPLETED: 0, NO_SHOW: 0, CANCELLED: 9, PROPOSED: 0 },
        followUpCountsByStatus: { CONFIRMED: 0, COMPLETED: 0 },
        pendingRequestCount: 0,
      });
      const { dots, overflow } = buildDayDots(day, none);

      expect(dots).toHaveLength(5);
      expect(overflow).toBe(2);
      const cancelledOnly = dayWith('2026-11-16', {
        countsByStatus: { CONFIRMED: 0, IN_PROGRESS: 0, COMPLETED: 0, NO_SHOW: 0, CANCELLED: 3, PROPOSED: 0 },
        followUpCountsByStatus: { CONFIRMED: 0, COMPLETED: 0 },
        pendingRequestCount: 0,
      });
      expect(buildDayDots(cancelledOnly, none)).toEqual({ dots: [], overflow: 0 });
    });

    it('hides the dots of a filtered state (and the overflow follows)', () => {
      const day = fixtureDay('2026-11-16'); // 2 non-follow-up + 2 follow-up confirmed, 1 proposed, 2 requests
      expect(buildDayDots(day, none).dots.map((dot) => dot.kind)).toEqual([
        'upcoming', 'upcoming', 'followUpUpcoming', 'followUpUpcoming', 'waitingPatient',
      ]);
      expect(buildDayDots(day, none).overflow).toBe(2);

      const noFollowUp = buildDayDots(day, new Set<CalendarState>(['followUpUpcoming']));
      expect(noFollowUp.dots.map((dot) => dot.kind)).toEqual(['upcoming', 'upcoming', 'waitingPatient', 'request', 'request']);
      const noRequests = buildDayDots(day, new Set<CalendarState>(['request', 'waitingPatient']));
      expect(noRequests.dots.map((dot) => dot.kind)).not.toContain('request');
      expect(noRequests.dots.map((dot) => dot.kind)).not.toContain('waitingPatient');
    });
  });

  describe('API values are shown, never recomputed', () => {
    it('keeps the bar width equal to loadPercent even when the slot counts disagree', () => {
      const day = dayWith('2026-11-16', { level: 'FULL', loadPercent: 91, takenSlots: 4, bookableSlots: 20 });
      expect(barWidthPercent(day)).toBe(91);
      expect(dayAriaLabel(day, none)).toContain('complet');
      expect(dayAriaLabel(day, none)).toContain('4 sur 20 créneaux réservés');
    });

    it('draws no bar for a closed day or a null load', () => {
      expect(barWidthPercent(fixtureDay('2026-11-01'))).toBe(0);
      expect(barWidthPercent(dayWith('2026-11-16', { loadPercent: null }))).toBe(0);
    });

    it('reads the legend thresholds from the API', () => {
      expect(legendLevels(50, 85).map((item) => item.label)).toEqual([
        'Disponible (moins de 50 %)', 'Chargé (50–85 %)', 'Complet (85 % et plus)', 'Fermé',
      ]);
      expect(legendLevels(40, 90)[1].label).toBe('Chargé (40–90 %)');
    });
  });

  describe('closed days and labels', () => {
    it('says Fermé for a weekly day off and Congé for an exception', () => {
      expect(closedText(fixtureDay('2026-11-01'))).toBe('Fermé'); // Sunday
      expect(closedText(fixtureDay('2026-11-12'))).toBe('Congé');
      expect(closedText(fixtureDay('2026-11-16'))).toBe('');
    });

    it('writes the accessible label of the canvas', () => {
      expect(dayAriaLabel(fixtureDay('2026-11-16'), none)).toBe(
        'Lundi 16 novembre, disponible, 6 sur 16 créneaux réservés, 2 demandes en attente',
      );
      expect(dayAriaLabel(fixtureDay('2026-11-17'), none)).toContain('1 demande en attente');
      expect(dayAriaLabel(fixtureDay('2026-11-01'), none)).toBe('Dimanche 1 novembre, fermé');
      expect(dayAriaLabel(fixtureDay('2026-11-12'), none)).toBe('Jeudi 12 novembre, fermé, congé');
    });

    it('drops the pending phrase when requests are filtered, but keeps the workload', () => {
      const label = dayAriaLabel(fixtureDay('2026-11-16'), new Set<CalendarState>(['request']));
      expect(label).toBe('Lundi 16 novembre, disponible, 6 sur 16 créneaux réservés');
    });
  });

  describe('mini timeline', () => {
    it('places the segments, break and blocked window as percentages of the open span', () => {
      const timeline = buildTimeline(fixtureDay('2026-11-16'));

      expect(timeline?.startLabel).toBe('08:00');
      expect(timeline?.endLabel).toBe('18:00');
      expect(timeline?.segments).toHaveLength(2);
      expect(timeline?.breakBar?.leftPercent).toBeCloseTo(45);
      expect(timeline?.breakBar?.widthPercent).toBeCloseTo(15);
      expect(timeline?.blocked[0].leftPercent).toBeCloseTo(80);
    });

    it('has no timeline for a day without working hours', () => {
      expect(buildTimeline(fixtureDay('2026-11-01'))).toBeNull();
    });
  });
});
