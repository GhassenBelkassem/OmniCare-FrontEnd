import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';

/** Resolves only on interaction, avoiding SSR viewport reads and hydration branching. */
@Injectable({ providedIn: 'root' })
export class TaskDetailPresentationService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly document = inject(DOCUMENT);
  usePanel(): boolean {
    return !isPlatformBrowser(this.platformId) || !this.document.defaultView?.matchMedia('(max-width: 767px)').matches;
  }
}
