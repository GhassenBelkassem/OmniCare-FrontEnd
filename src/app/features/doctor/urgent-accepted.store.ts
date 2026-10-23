import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';

const STORAGE_KEY = 'omnicare_accepted_offers';

@Injectable({ providedIn: 'root' })
export class UrgentAcceptedStore {
  private readonly platformId = inject(PLATFORM_ID);

  purgeLegacyCache(): void {
    if (!isPlatformBrowser(this.platformId) || typeof localStorage === 'undefined') return;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage can be unavailable in hardened browser contexts.
    }
  }
}
