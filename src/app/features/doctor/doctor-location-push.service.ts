import { DestroyRef, Injectable, PLATFORM_ID, effect, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { DoctorUrgentApiService } from './doctor-urgent-api.service';
import { ActiveMatchedRequestStore } from './active-matched-request.store';

const PUSH_INTERVAL_MS = 5_000;

/**
 * Pushes the doctor's GPS position to the backend while they hold at least
 * one MATCHED urgent request. Client-side throttled to one call every 5s to
 * stay clear of the server's 1-per-3s rate limit; geolocation fixes arriving
 * between pushes only refresh the last known position.
 */
@Injectable({ providedIn: 'root' })
export class DoctorLocationPushService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private readonly activeRequests = inject(ActiveMatchedRequestStore);
  private readonly urgentApi = inject(DoctorUrgentApiService);

  readonly pushing = signal(false);

  private watchHandle: number | null = null;
  private latestLatitude: number | null = null;
  private latestLongitude: number | null = null;
  private lastSentAt = 0;

  constructor() {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    if (typeof navigator === 'undefined' || navigator.geolocation === undefined) {
      return;
    }

    effect(() => {
      const shouldPush = this.activeRequests.hasActive();
      if (shouldPush) {
        this.startWatching();
      } else {
        this.stopWatching();
      }
    });

    this.destroyRef.onDestroy(() => this.stopWatching());
  }

  private startWatching(): void {
    if (this.watchHandle !== null) {
      return;
    }
    this.pushing.set(true);
    this.watchHandle = navigator.geolocation.watchPosition(
      (position) => {
        this.latestLatitude = position.coords.latitude;
        this.latestLongitude = position.coords.longitude;
        this.flush();
      },
      () => {
        // Position unavailable or permission denied - keep the watcher but
        // stop attempting pushes until a fix arrives.
        this.latestLatitude = null;
        this.latestLongitude = null;
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 5_000 },
    );
  }

  private stopWatching(): void {
    if (this.watchHandle !== null) {
      navigator.geolocation.clearWatch(this.watchHandle);
      this.watchHandle = null;
    }
    this.pushing.set(false);
    this.latestLatitude = null;
    this.latestLongitude = null;
    this.lastSentAt = 0;
  }

  private flush(): void {
    const latitude = this.latestLatitude;
    const longitude = this.latestLongitude;
    if (latitude === null || longitude === null) {
      return;
    }
    const now = Date.now();
    if (now - this.lastSentAt < PUSH_INTERVAL_MS) {
      return;
    }
    this.lastSentAt = now;
    for (const requestId of this.activeRequests.requestIds()) {
      this.urgentApi.pushLocation(requestId, latitude, longitude).subscribe({
        error: () => {
          // Server-side rate limit (429) or transient failure - the next
          // throttled tick retries naturally.
        },
      });
    }
  }
}
