import { Injectable } from '@angular/core';

export interface PracticeCoordinates {
  readonly latitude: number;
  readonly longitude: number;
}

const LOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10_000,
  maximumAge: 30_000,
};

/** One-shot geolocation helper (browser GPS). Resolves null when unavailable/denied. */
@Injectable({ providedIn: 'root' })
export class PracticeLocationService {
  getCurrentPosition(): Promise<PracticeCoordinates | null> {
    if (
      typeof navigator === 'undefined' ||
      !('geolocation' in navigator) ||
      (navigator as { geolocation?: Geolocation | null }).geolocation == null
    ) {
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) =>
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          }),
        () => resolve(null),
        LOCATION_OPTIONS,
      );
    });
  }
}
