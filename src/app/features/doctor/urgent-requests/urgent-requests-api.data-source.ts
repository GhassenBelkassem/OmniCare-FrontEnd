import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, tap } from 'rxjs';

import type { UrgentAvailabilityStatusDto, UrgentOfferDto } from '../appointment-api.models';
import { DoctorUrgentApiService } from '../doctor-urgent-api.service';
import { UrgentRequestQueueItem, UrgentRequestsDataSource } from './urgent-request-queue.models';

@Injectable()
export class UrgentRequestsApiDataSource extends UrgentRequestsDataSource {
  private readonly api = inject(DoctorUrgentApiService);
  private availability: UrgentAvailabilityStatusDto | null = null;

  readonly demo = false;

  load(): Observable<readonly UrgentRequestQueueItem[]> {
    return forkJoin({
      offers: this.api.incoming(),
      availability: this.api.getStatus().pipe(catchError(() => of(null))),
    }).pipe(
      tap(({ availability }) => (this.availability = availability)),
      map(({ offers, availability }) => offers.map((offer) => mapOffer(offer, availability))),
    );
  }

  accept(offerId: string): Observable<UrgentRequestQueueItem> {
    return this.api.accept(offerId).pipe(map((offer) => mapOffer(offer, this.availability)));
  }

  decline(offerId: string): Observable<UrgentRequestQueueItem> {
    return this.api.decline(offerId).pipe(map((offer) => mapOffer(offer, this.availability)));
  }
}

function mapOffer(
  offer: UrgentOfferDto,
  availability: UrgentAvailabilityStatusDto | null,
): UrgentRequestQueueItem {
  const notes = offer.notes?.trim() || 'Motif non renseigné.';
  const titleCandidate = notes.split(/[.!?\n]/, 1)[0]?.trim();
  const title = titleCandidate && titleCandidate.length <= 64 ? titleCandidate : 'Demande urgente';
  const distanceKm =
    availability?.currentLatitude !== null &&
    availability?.currentLatitude !== undefined &&
    availability.currentLongitude !== null
      ? haversineKm(
          availability.currentLatitude,
          availability.currentLongitude,
          offer.patientLatitude,
          offer.patientLongitude,
        )
      : null;

  return {
    offerId: offer.offerId,
    requestId: offer.requestId,
    status: offer.status,
    requestStatus: offer.requestStatus,
    sentAt: offer.sentAt,
    respondedAt: offer.respondedAt,
    visitPreference: offer.visitPreference,
    title,
    patientLabel: offer.patientName,
    patientMeta: null,
    birthDate: null,
    summary: notes,
    detail: notes,
    flags: [],
    history: [],
    locationLabel:
      offer.visitPreference === 'CABINET_VISIT'
        ? 'Patient attendu au cabinet'
        : 'Localisation transmise',
    distanceKm,
    etaMinutes: null,
    latitude: offer.patientLatitude,
    longitude: offer.patientLongitude,
    contact: null,
    accessNotes: null,
  };
}

function haversineKm(latA: number, lngA: number, latB: number, lngB: number): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(latB - latA);
  const longitudeDelta = radians(lngB - lngA);
  const value =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(latA)) * Math.cos(radians(latB)) * Math.sin(longitudeDelta / 2) ** 2;
  return Math.round(6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value)) * 10) / 10;
}
