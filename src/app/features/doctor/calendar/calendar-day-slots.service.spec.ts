import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { DaySlotsResponse } from './calendar-day-slots.models';
import {
  CalendarDaySlotsService,
  DAY_SLOTS_BAD_DATE_ERROR,
  DAY_SLOTS_LOAD_ERROR,
  daySlotsErrorMessage,
} from './calendar-day-slots.service';
import { daySlotsFixture } from './testing/day-slots.testing';

const URL = '/api/v1/doctor/scheduled-care/day-slots';

describe('CalendarDaySlotsService (contract G4-3)', () => {
  let service: CalendarDaySlotsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(CalendarDaySlotsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('calls the exact endpoint with the Tunis date', () => {
    let received: DaySlotsResponse | undefined;
    service.getDaySlots('2026-11-16').subscribe((response) => (received = response));

    const request = http.expectOne((candidate) => candidate.url === URL);
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('date')).toBe('2026-11-16');
    expect(request.request.urlWithParams).toBe(`${URL}?date=2026-11-16`);
    request.flush(daySlotsFixture());

    expect(received?.timeZone).toBe('Africa/Tunis');
    expect(received?.date).toBe('2026-11-16');
    expect(received?.slots).toHaveLength(15);
  });

  it('hands the answer over exactly as the API sent it (states are never recomputed)', () => {
    const sent = daySlotsFixture();
    let received: DaySlotsResponse | undefined;
    service.getDaySlots('2026-11-16').subscribe((response) => (received = response));

    http.expectOne((candidate) => candidate.url === URL).flush(sent);

    expect(received).toEqual(sent);
  });

  it('the fixture follows the contract: Tunis « HH:mm » times, state FREE | TAKEN | PAST, only open slots', () => {
    const fixture = daySlotsFixture();

    for (const slot of fixture.slots) {
      expect(slot.start).toMatch(/^\d{2}:\d{2}$/);
      expect(slot.end).toMatch(/^\d{2}:\d{2}$/);
      expect(['FREE', 'TAKEN', 'PAST']).toContain(slot.state);
    }
    // The break (12:30 – 14:00) and the closed window (16:00 – 17:00) are not listed.
    expect(fixture.slots.some((slot) => slot.start >= '12:30' && slot.start < '14:00')).toBe(false);
    expect(fixture.slots.some((slot) => slot.start >= '16:00' && slot.start < '17:00')).toBe(false);
  });

  it('turns a 400 into « La date demandée n’est pas valide. » and anything else into the generic message', () => {
    expect(daySlotsErrorMessage(new HttpErrorResponse({ status: 400 }))).toBe(DAY_SLOTS_BAD_DATE_ERROR);
    for (const status of [401, 403, 500, 0]) {
      expect(daySlotsErrorMessage(new HttpErrorResponse({ status }))).toBe(DAY_SLOTS_LOAD_ERROR);
    }
    expect(daySlotsErrorMessage(new Error('boom'))).toBe(DAY_SLOTS_LOAD_ERROR);
    expect(DAY_SLOTS_LOAD_ERROR).toBe('Impossible de charger les créneaux libres.');
  });
});

describe('CAL-FIX fix 15: day-slots error code', () => {
  const problem = (status: number, body: unknown) => new HttpErrorResponse({ status, error: body });

  it('shows the French date message for 400 DAY_SLOTS_DATE_INVALID and the generic one otherwise', () => {
    expect(daySlotsErrorMessage(problem(400, {
      status: 400, errorCode: 'DAY_SLOTS_DATE_INVALID',
      detail: "La date demandée n'est pas valide : indiquez une date au format AAAA-MM-JJ.",
    }))).toBe(DAY_SLOTS_BAD_DATE_ERROR);
    expect(daySlotsErrorMessage(problem(400, null))).toBe(DAY_SLOTS_BAD_DATE_ERROR);
    expect(daySlotsErrorMessage(problem(400, { errorCode: 'CALENDAR_RANGE_INVALID' }))).toBe(DAY_SLOTS_LOAD_ERROR);
    expect(daySlotsErrorMessage(problem(500, { errorCode: 'DAY_SLOTS_DATE_INVALID' }))).toBe(DAY_SLOTS_LOAD_ERROR);
  });
});

