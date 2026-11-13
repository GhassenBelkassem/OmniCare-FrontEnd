import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  CalendarSummaryService,
  SUMMARY_BAD_RANGE_ERROR,
  SUMMARY_LOAD_ERROR,
  monthGridOfMonth,
  summaryErrorMessage,
  daySummaryErrorMessage,
} from './calendar-summary.service';
import type { CalendarSummary } from './calendar-summary.models';
import { weekdayOfDayKey } from './calendar-time';
import { fixtureDay, summaryFixture } from './testing/calendar-summary.testing';

const URL = '/api/v1/doctor/scheduled-care/calendar-summary';

describe('CalendarSummaryService (contract G4-2b)', () => {
  let service: CalendarSummaryService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(CalendarSummaryService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('calls the exact endpoint with the Tunis dates of the grid', () => {
    let received: CalendarSummary | undefined;
    service.getSummary('2026-10-26', '2026-12-06').subscribe((summary) => (received = summary));

    const request = http.expectOne((candidate) => candidate.url === URL);
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('from')).toBe('2026-10-26');
    expect(request.request.params.get('to')).toBe('2026-12-06');
    expect(request.request.urlWithParams).toBe(`${URL}?from=2026-10-26&to=2026-12-06`);
    request.flush(summaryFixture());

    expect(received?.days).toHaveLength(42);
    expect(received?.timeZone).toBe('Africa/Tunis');
    expect(received?.thresholds).toEqual({ busyFromPercent: 50, fullFromPercent: 85 });
  });

  it('hands the answer over exactly as the API sent it (no recomputation)', () => {
    const sent = summaryFixture();
    // takenSlots / bookableSlots (4 / 20 = 20 %) disagree with loadPercent and level on purpose.
    const odd = { ...sent.days[0], takenSlots: 4, bookableSlots: 20, loadPercent: 91, level: 'FULL' as const };
    let received: CalendarSummary | undefined;
    service.getSummary('2026-10-26', '2026-12-06').subscribe((summary) => (received = summary));
    http.expectOne((candidate) => candidate.url === URL).flush({ ...sent, days: [odd, ...sent.days.slice(1)] });

    expect(received?.days[0]).toEqual(odd);
  });

  it('the fixture covers every level, both closed reasons, a null load, follow-ups and requests', () => {
    const days = summaryFixture().days;
    expect(new Set(days.map((day) => day.level))).toEqual(new Set(['AVAILABLE', 'BUSY', 'FULL', 'CLOSED']));
    expect(days.filter((day) => day.closedReason === 'WEEKLY_OFF').length).toBeGreaterThan(0);
    expect(days.filter((day) => day.closedReason === 'EXCEPTION').length).toBeGreaterThan(0);
    expect(days.some((day) => day.loadPercent === null && day.bookableSlots === 0)).toBe(true);
    expect(days.some((day) => (day.followUpCountsByStatus.CONFIRMED ?? 0) > 0)).toBe(true);
    expect(days.some((day) => day.pendingRequestCount > 0)).toBe(true);
    expect(days.some((day) => day.awaitingPatientRequestCount > 0)).toBe(true);
    expect(fixtureDay('2026-11-16').blockedWindows).toEqual([{ start: '16:00', end: '17:00' }]);
    expect(days.every((day) => (day.level === 'CLOSED') === (day.closedReason !== null))).toBe(true);
  });

  it('maps a 400 to the French period message and anything else to the generic one', () => {
    let failure: unknown;
    service.getSummary('2026-10-26', '2027-01-30').subscribe({ error: (error) => (failure = error) });
    http
      .expectOne((candidate) => candidate.url === URL)
      .flush({ title: 'Bad Request' }, { status: 400, statusText: 'Bad Request' });

    expect(summaryErrorMessage(failure)).toBe(SUMMARY_BAD_RANGE_ERROR);
    expect(SUMMARY_BAD_RANGE_ERROR).toBe("La période demandée n'est pas valide.");
    for (const status of [401, 403, 500]) {
      let other: unknown;
      service.getSummary('2026-10-26', '2026-12-06').subscribe({ error: (error) => (other = error) });
      http.expectOne((candidate) => candidate.url === URL).flush({}, { status, statusText: 'x' });
      expect(summaryErrorMessage(other)).toBe(SUMMARY_LOAD_ERROR);
    }
    expect(SUMMARY_LOAD_ERROR).toBe('Impossible de charger le mois.');
  });
});

describe('month grid', () => {
  it('runs from the first Monday to the last Sunday, in Tunis dates (6 weeks for November 2026)', () => {
    const grid = monthGridOfMonth('2026-11');

    expect(grid?.from).toBe('2026-10-26');
    expect(grid?.to).toBe('2026-12-06');
    expect(grid?.keys).toHaveLength(42);
    expect(grid?.keys[0]).toBe('2026-10-26');
    expect(grid?.keys[41]).toBe('2026-12-06');
  });

  it('has only the weeks the month touches, always Monday to Sunday, never more than 42 days', () => {
    // February 2027 starts on a Monday and has 28 days: exactly 4 weeks.
    expect(monthGridOfMonth('2027-02')).toMatchObject({ from: '2027-02-01', to: '2027-02-28' });
    expect(monthGridOfMonth('2027-02')?.keys).toHaveLength(28);
    // December 2026 ends on a Thursday; January 2027 starts on a Friday.
    expect(monthGridOfMonth('2026-12')).toMatchObject({ from: '2026-11-30', to: '2027-01-03' });
    for (const month of ['2026-01', '2026-02', '2026-03', '2026-05', '2026-08', '2026-10', '2028-02', '2026-12']) {
      const grid = monthGridOfMonth(month);
      expect(grid?.keys.length).toBeGreaterThanOrEqual(28);
      expect(grid?.keys.length).toBeLessThanOrEqual(42);
      expect((grid?.keys.length ?? 0) % 7).toBe(0);
      expect(weekdayOfDayKey(grid?.from ?? '')).toBe(1);
      expect(weekdayOfDayKey(grid?.to ?? '')).toBe(0);
    }
  });

  it('refuses an invalid month', () => {
    expect(monthGridOfMonth('2026-13')).toBeNull();
    expect(monthGridOfMonth('novembre')).toBeNull();
  });
});

describe('CAL-FIX fix 15: backend error codes', () => {
  const problem = (status: number, body: unknown) => new HttpErrorResponse({ status, error: body });

  it('shows the French period message for 400 CALENDAR_RANGE_INVALID (ProblemDetail errorCode)', () => {
    const answer = problem(400, {
      type: 'about:blank', title: 'Bad Request', status: 400, errorCode: 'CALENDAR_RANGE_INVALID',
      detail: "La période demandée n'est pas valide : indiquez deux dates au format AAAA-MM-JJ, la première avant la seconde, sur 42 jours au maximum.",
    });
    expect(summaryErrorMessage(answer)).toBe(SUMMARY_BAD_RANGE_ERROR);
    expect(daySummaryErrorMessage(answer)).toBe(SUMMARY_BAD_RANGE_ERROR);
  });

  it('keeps the generic message for a 400 with another code, and for 401/403/500', () => {
    expect(summaryErrorMessage(problem(400, { errorCode: 'VALIDATION_FAILED' }))).toBe(SUMMARY_LOAD_ERROR);
    for (const status of [401, 403, 500]) expect(summaryErrorMessage(problem(status, { errorCode: 'CALENDAR_RANGE_INVALID' }))).toBe(SUMMARY_LOAD_ERROR);
  });
});

