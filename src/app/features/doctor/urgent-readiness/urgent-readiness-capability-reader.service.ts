import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map } from 'rxjs';

import { PracticeLocationApiService } from '../settings/practice-location-api.service';
import { CareCapabilityApiService } from '../settings/professional-services-api.service';
import { UrgentPermanentCapabilityProjection } from './urgent-readiness.models';

/**
 * Read-only adapter over the existing settings authorities. This feature never
 * mutates capabilities or practice locations and therefore cannot become a
 * competing source of truth.
 */
@Injectable({ providedIn: 'root' })
export class UrgentReadinessCapabilityReader {
  private readonly capabilitiesApi = inject(CareCapabilityApiService);
  private readonly locationsApi = inject(PracticeLocationApiService);

  load(): Observable<UrgentPermanentCapabilityProjection> {
    return forkJoin({
      capabilities: this.capabilitiesApi.get(),
      locations: this.locationsApi.list(),
    }).pipe(
      map(({ capabilities, locations }) => ({
        revision: capabilities.revision,
        urgentHomeEnabled: capabilities.capabilities.includes('URGENT_HOME'),
        urgentCabinetEnabled: capabilities.capabilities.includes('URGENT_CABINET'),
        activePracticeLocations: locations
          .filter((location) => location.active)
          .map((location) => ({
            id: location.id,
            label: location.name.trim() || null,
          })),
      })),
    );
  }
}
