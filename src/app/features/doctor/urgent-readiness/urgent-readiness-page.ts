import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { OcButton, OcIcon, OcPageHeader } from '../../../shared/ui';

@Component({
  selector: 'app-urgent-readiness-page',
  imports: [OcButton, OcIcon, OcPageHeader],
  templateUrl: './urgent-readiness-page.html',
  styleUrl: './urgent-readiness-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UrgentReadinessPage {
  private readonly router = inject(Router);

  openSettings(): void {
    void this.router.navigate(['/doctor/settings'], { queryParams: { tab: 'services' } });
  }
}
