import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

import type {
  UrgentOfferStatusDto,
  UrgentRequestStatusDto,
  UrgentVisitPreferenceDto,
} from '../appointment-api.models';

export type UrgentQueueTab = 'pending' | 'active' | 'history';
export type UrgentLocationFilter = 'all' | 'home' | 'cabinet';

export interface UrgentRequestQueueItem {
  readonly offerId: string;
  readonly requestId: string;
  readonly status: UrgentOfferStatusDto;
  readonly requestStatus: UrgentRequestStatusDto;
  readonly sentAt: string;
  readonly respondedAt: string | null;
  readonly visitPreference: UrgentVisitPreferenceDto | null;
  readonly title: string;
  readonly patientLabel: string;
  readonly patientMeta: string | null;
  readonly birthDate: string | null;
  readonly summary: string;
  readonly detail: string;
  readonly flags: readonly string[];
  readonly history: readonly string[];
  readonly locationLabel: string;
  readonly distanceKm: number | null;
  readonly etaMinutes: number | null;
  readonly latitude: number;
  readonly longitude: number;
  readonly contact: string | null;
  readonly accessNotes: string | null;
  readonly relativeLabel?: string;
}

export abstract class UrgentRequestsDataSource {
  abstract readonly demo: boolean;
  abstract load(): Observable<readonly UrgentRequestQueueItem[]>;
  abstract accept(offerId: string): Observable<UrgentRequestQueueItem>;
  abstract decline(offerId: string): Observable<UrgentRequestQueueItem>;
}

export const URGENT_REQUESTS_DATA_SOURCE = new InjectionToken<UrgentRequestsDataSource>(
  'URGENT_REQUESTS_DATA_SOURCE',
);
