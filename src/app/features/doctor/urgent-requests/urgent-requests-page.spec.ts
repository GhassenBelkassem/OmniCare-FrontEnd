import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RealtimeService } from '../../../core/realtime/realtime.service';
import {
  URGENT_REQUESTS_DATA_SOURCE,
  type UrgentRequestQueueItem,
} from './urgent-request-queue.models';
import { UrgentRequestsPage } from './urgent-requests-page';

const pending: UrgentRequestQueueItem = {
  offerId: 'offer-1',
  requestId: 'request-1',
  status: 'PENDING',
  requestStatus: 'PENDING',
  sentAt: '2026-11-08T08:00:00Z',
  respondedAt: null,
  visitPreference: 'HOME_VISIT',
  title: 'Demande urgente',
  patientLabel: 'Patient autorisé',
  patientMeta: null,
  birthDate: null,
  summary: 'Motif',
  detail: 'Motif',
  flags: [],
  history: [],
  locationLabel: 'Tunis',
  distanceKm: 2,
  etaMinutes: null,
  latitude: 36.8,
  longitude: 10.18,
  contact: null,
  accessNotes: null,
};

describe('UrgentRequestsPage workflow state', () => {
  const urgentEvents = new Subject<unknown>();
  const source = {
    demo: false,
    load: vi.fn(),
    accept: vi.fn(),
    decline: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        { provide: URGENT_REQUESTS_DATA_SOURCE, useValue: source },
        {
          provide: RealtimeService,
          useValue: {
            urgentEvents$: urgentEvents.asObservable(),
            connectionEpoch: signal(0),
            status: signal('connected'),
          },
        },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({}) } },
        },
        { provide: Router, useValue: { navigate: vi.fn().mockResolvedValue(true) } },
      ],
    });
  });

  it('does not let an older refresh overwrite a newer realtime refresh', () => {
    const older = new Subject<readonly UrgentRequestQueueItem[]>();
    const newer = new Subject<readonly UrgentRequestQueueItem[]>();
    source.load.mockReturnValueOnce(older).mockReturnValueOnce(newer);
    const page = createPage();

    urgentEvents.next({ type: 'URGENT_REQUEST_CHANGED' });
    newer.next([{ ...pending, offerId: 'newer' }]);
    older.next([{ ...pending, offerId: 'older' }]);

    expect(page.requests().map((item) => item.offerId)).toEqual(['newer']);
    expect(page.loading()).toBe(false);
    expect(page.loadError()).toBeNull();
  });

  it('represents load failure without a contradictory loading state', () => {
    source.load.mockReturnValue(throwError(() => new Error('offline')));
    const page = createPage();

    expect(page.loading()).toBe(false);
    expect(page.loadError()).toBe('Impossible de charger les demandes urgentes.');
  });

  it('blocks a rapid duplicate accept while the first mutation is pending', () => {
    const response = new Subject<UrgentRequestQueueItem>();
    source.load.mockReturnValue(of([pending]));
    source.accept.mockReturnValue(response);
    const page = createPage();

    page.accept(pending);
    page.accept(pending);

    expect(source.accept).toHaveBeenCalledTimes(1);
    expect(page.actionOfferId()).toBe('offer-1');
  });

  it('reconciles an accept conflict from the authoritative list instead of inventing a state', () => {
    const authoritative = { ...pending, status: 'DECLINED' as const };
    source.load.mockReturnValueOnce(of([pending])).mockReturnValueOnce(of([authoritative]));
    source.accept.mockReturnValue(throwError(() => ({ status: 409 })));
    const page = createPage();

    page.accept(pending);

    expect(source.load).toHaveBeenCalledTimes(2);
    expect(page.requests()).toEqual([authoritative]);
    expect(page.feedback()?.tone).toBe('information');
  });

  it('does not expose the accept mutation for a terminal offer', () => {
    const terminal = { ...pending, status: 'EXPIRED' as const, requestStatus: 'EXPIRED' as const };
    source.load.mockReturnValue(of([terminal]));
    const page = createPage();

    page.accept(terminal);

    expect(source.accept).not.toHaveBeenCalled();
  });
});

function createPage(): UrgentRequestsPage {
  return TestBed.runInInjectionContext(() => new UrgentRequestsPage());
}
