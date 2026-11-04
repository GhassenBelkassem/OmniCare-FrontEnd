import { Injectable, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NEVER, Observable, delay, of, throwError } from 'rxjs';

import { UrgentRequestQueueItem, UrgentRequestsDataSource } from './urgent-request-queue.models';
import { DEMO_URGENT_REQUESTS } from './urgent-requests-demo.fixtures';

@Injectable()
export class UrgentRequestsDemoDataSource extends UrgentRequestsDataSource {
  private readonly route = inject(ActivatedRoute);
  private items = [...DEMO_URGENT_REQUESTS];
  private loadAttempts = 0;

  readonly demo = true;

  load(): Observable<readonly UrgentRequestQueueItem[]> {
    this.loadAttempts += 1;
    switch (this.route.snapshot.queryParamMap.get('state')) {
      case 'loading':
        return NEVER;
      case 'error':
        return this.loadAttempts === 1
          ? throwError(() => new Error('demo-load-error')).pipe(delay(120))
          : of(this.items).pipe(delay(120));
      case 'empty':
        return of([]).pipe(delay(120));
      default:
        return of(this.items).pipe(delay(120));
    }
  }

  accept(offerId: string): Observable<UrgentRequestQueueItem> {
    if (this.route.snapshot.queryParamMap.get('state') === 'unavailable') {
      return throwError(() => ({ status: 409 })).pipe(delay(320));
    }
    return this.update(offerId, 'ACCEPTED');
  }

  decline(offerId: string): Observable<UrgentRequestQueueItem> {
    return this.update(offerId, 'DECLINED');
  }

  private update(
    offerId: string,
    status: 'ACCEPTED' | 'DECLINED',
  ): Observable<UrgentRequestQueueItem> {
    const current = this.items.find((item) => item.offerId === offerId);
    if (!current) return throwError(() => ({ status: 404 }));
    const updated: UrgentRequestQueueItem = {
      ...current,
      status,
      respondedAt: '2026-10-31T14:27:00+01:00',
      relativeLabel: status === 'ACCEPTED' ? 'Acceptée à 14:27' : 'Refusée à 14:27',
    };
    this.items = this.items.map((item) => (item.offerId === offerId ? updated : item));
    return of(updated).pipe(delay(320));
  }
}
