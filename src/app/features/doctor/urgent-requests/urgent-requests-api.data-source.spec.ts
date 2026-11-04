import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { vi } from 'vitest';

import type { UrgentAvailabilityStatusDto, UrgentOfferDto } from '../appointment-api.models';
import { DoctorUrgentApiService } from '../doctor-urgent-api.service';
import { UrgentRequestsApiDataSource } from './urgent-requests-api.data-source';

const pendingOffer: UrgentOfferDto = {
  offerId: 'offer-1',
  requestId: 'request-1',
  doctorId: 'doctor-1',
  status: 'PENDING',
  sentAt: '2026-10-31T14:24:00+01:00',
  respondedAt: null,
  patientName: 'Patient autorisé',
  patientLatitude: 36.8467,
  patientLongitude: 10.2732,
  visitPreference: 'HOME_VISIT',
  notes: 'Douleur thoracique depuis une heure.',
  requestStatus: 'PENDING',
};

const availability: UrgentAvailabilityStatusDto = {
  doctorId: 'doctor-1',
  acceptsHomeVisits: true,
  acceptsCabinetVisits: true,
  availableForUrgent: true,
  currentLatitude: 36.8065,
  currentLongitude: 10.1815,
  locationUpdatedAt: '2026-10-31T14:20:00+01:00',
};

describe('UrgentRequestsApiDataSource', () => {
  const api = {
    incoming: vi.fn(() => of([pendingOffer])),
    getStatus: vi.fn(() => of(availability)),
    accept: vi.fn((offerId: string) =>
      of({ ...pendingOffer, offerId, status: 'ACCEPTED' as const }),
    ),
    decline: vi.fn((offerId: string) =>
      of({ ...pendingOffer, offerId, status: 'DECLINED' as const }),
    ),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [UrgentRequestsApiDataSource, { provide: DoctorUrgentApiService, useValue: api }],
    });
  });

  it('maps only fields exposed by the authoritative incoming-offers contract', async () => {
    const source = TestBed.inject(UrgentRequestsApiDataSource);
    const items = await firstValueFrom(source.load());

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      offerId: 'offer-1',
      status: 'PENDING',
      title: 'Douleur thoracique depuis une heure',
      patientLabel: 'Patient autorisé',
      patientMeta: null,
      flags: [],
      history: [],
      locationLabel: 'Localisation transmise',
    });
    expect(items[0]?.distanceKm).toBeGreaterThan(0);
  });

  it('uses the real accept and decline operations and maps their confirmed status', async () => {
    const source = TestBed.inject(UrgentRequestsApiDataSource);

    const accepted = await firstValueFrom(source.accept('offer-1'));
    const declined = await firstValueFrom(source.decline('offer-1'));

    expect(api.accept).toHaveBeenCalledWith('offer-1');
    expect(api.decline).toHaveBeenCalledWith('offer-1');
    expect(accepted.status).toBe('ACCEPTED');
    expect(declined.status).toBe('DECLINED');
  });
});
