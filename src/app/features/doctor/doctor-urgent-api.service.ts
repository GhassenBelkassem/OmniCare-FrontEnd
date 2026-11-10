import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { RUNTIME_CONFIG } from '../../core/config/runtime-config';
import {
  UrgentAvailabilityStatusDto,
  UrgentAvailabilityToggleDto,
  UrgentOfferDto,
  UrgentRequestStatusDto,
} from './appointment-api.models';

@Injectable({ providedIn: 'root' })
export class DoctorUrgentApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RUNTIME_CONFIG);
  private readonly availabilityUrl = `${this.config.apiBaseUrl}/urgent-requests/availability`;

  getStatus(): Observable<UrgentAvailabilityStatusDto> {
    return this.http.get<UrgentAvailabilityStatusDto>(this.availabilityUrl);
  }

  toggle(input: UrgentAvailabilityToggleDto): Observable<UrgentAvailabilityStatusDto> {
    return this.http.patch<UrgentAvailabilityStatusDto>(this.availabilityUrl, input);
  }

  incoming(): Observable<readonly UrgentOfferDto[]> {
    return this.http.get<readonly UrgentOfferDto[]>(
      `${this.config.apiBaseUrl}/urgent-requests/incoming`,
    );
  }

  accept(offerId: string): Observable<UrgentOfferDto> {
    return this.http.patch<UrgentOfferDto>(
      `${this.config.apiBaseUrl}/urgent-requests/offers/${offerId}/accept`,
      null,
    );
  }

  decline(offerId: string): Observable<UrgentOfferDto> {
    return this.http.patch<UrgentOfferDto>(
      `${this.config.apiBaseUrl}/urgent-requests/offers/${offerId}/decline`,
      null,
    );
  }

  request(id: string): Observable<UrgentRequestSummaryDto> {
    return this.http.get<UrgentRequestSummaryDto>(
      `${this.config.apiBaseUrl}/urgent-requests/${id}`,
    );
  }

  arrive(id: string): Observable<UrgentRequestSummaryDto> {
    return this.http.patch<UrgentRequestSummaryDto>(
      `${this.config.apiBaseUrl}/urgent-requests/${id}/arrive`,
      null,
    );
  }

  pushLocation(id: string, latitude: number, longitude: number): Observable<void> {
    return this.http.patch<void>(`${this.config.apiBaseUrl}/urgent-requests/${id}/location`, {
      latitude,
      longitude,
    });
  }
}

export interface UrgentRequestSummaryDto {
  readonly id: string;
  readonly status: UrgentRequestStatusDto;
  readonly selectedOfferId: string | null;
  readonly matchedAt: string | null;
  readonly arrivedAt: string | null;
}
