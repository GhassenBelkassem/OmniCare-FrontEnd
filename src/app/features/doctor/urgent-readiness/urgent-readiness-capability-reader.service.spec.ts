import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';

import { PracticeLocationResponse } from '../settings/practice-location-api.models';
import { PracticeLocationApiService } from '../settings/practice-location-api.service';
import { CareCapabilityApiService } from '../settings/professional-services-api.service';
import { UrgentReadinessCapabilityReader } from './urgent-readiness-capability-reader.service';

describe('UrgentReadinessCapabilityReader', () => {
  it('reads the existing capability authority and exposes only safe active-location fields', async () => {
    const capabilitiesApi = {
      get: vi.fn(() =>
        of({ revision: 7, capabilities: ['URGENT_HOME', 'URGENT_CABINET'] as const }),
      ),
    };
    const locationsApi = {
      list: vi.fn(() => of([practiceLocation('cab-1', 'Cabinet Démo', true)])),
    };
    TestBed.configureTestingModule({
      providers: [
        UrgentReadinessCapabilityReader,
        { provide: CareCapabilityApiService, useValue: capabilitiesApi },
        { provide: PracticeLocationApiService, useValue: locationsApi },
      ],
    });

    const projection = await firstValueFrom(TestBed.inject(UrgentReadinessCapabilityReader).load());

    expect(projection).toEqual({
      revision: 7,
      urgentHomeEnabled: true,
      urgentCabinetEnabled: true,
      activePracticeLocations: [{ id: 'cab-1', label: 'Cabinet Démo' }],
    });
    expect(JSON.stringify(projection)).not.toContain('Rue privée');
    expect(JSON.stringify(projection)).not.toContain('+216');
  });

  it('omits inactive practice locations', async () => {
    TestBed.configureTestingModule({
      providers: [
        UrgentReadinessCapabilityReader,
        {
          provide: CareCapabilityApiService,
          useValue: { get: () => of({ revision: 3, capabilities: [] }) },
        },
        {
          provide: PracticeLocationApiService,
          useValue: { list: () => of([practiceLocation('cab-off', 'Cabinet fermé', false)]) },
        },
      ],
    });

    const projection = await firstValueFrom(TestBed.inject(UrgentReadinessCapabilityReader).load());
    expect(projection.activePracticeLocations).toEqual([]);
  });

  it('preserves the source-provided practice name and reports a missing name truthfully', async () => {
    TestBed.configureTestingModule({
      providers: [
        UrgentReadinessCapabilityReader,
        {
          provide: CareCapabilityApiService,
          useValue: { get: () => of({ revision: 3, capabilities: ['URGENT_CABINET'] }) },
        },
        {
          provide: PracticeLocationApiService,
          useValue: {
            list: () =>
              of([
                practiceLocation('cab-source', '  rouge  ', true),
                practiceLocation('cab-unnamed', '   ', true),
              ]),
          },
        },
      ],
    });

    const projection = await firstValueFrom(TestBed.inject(UrgentReadinessCapabilityReader).load());

    expect(projection.activePracticeLocations).toEqual([
      { id: 'cab-source', label: 'rouge' },
      { id: 'cab-unnamed', label: null },
    ]);
  });
});

function practiceLocation(id: string, name: string, active: boolean): PracticeLocationResponse {
  return {
    id,
    type: 'CABINET',
    name,
    governorate: 'Tunis',
    city: 'Tunis',
    address: 'Rue privée',
    latitude: 36.8,
    longitude: 10.1,
    publicPhone: '+216 00 000 000',
    wheelchairAccessible: true,
    patientInstructions: null,
    primary: true,
    active,
    revision: 1,
    createdAt: '2026-10-10T08:00:00Z',
    updatedAt: '2026-10-10T08:00:00Z',
    gallery: [],
  };
}
