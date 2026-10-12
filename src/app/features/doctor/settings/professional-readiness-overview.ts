import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs/operators';

import { OcButton, OcIcon, OcSkeleton, OcStatusBadge } from '../../../shared/ui';
import {
  ProfessionalReadinessFailure,
  ProfessionalReadinessApiService,
  mapProfessionalReadinessFailure,
} from './professional-readiness-api.service';
import {
  DoctorEligibilityReason,
  ProfessionalReadinessResponse,
} from './professional-readiness-api.models';
import {
  ReadinessReasonPresentation,
  ReadinessSettingsTab,
  readinessReasonPresentation,
} from './readiness-reason-presentation';

interface PresentedReason {
  readonly code: DoctorEligibilityReason;
  readonly presentation: ReadinessReasonPresentation;
}

@Component({
  selector: 'app-professional-readiness-overview',
  imports: [OcButton, OcIcon, OcSkeleton, OcStatusBadge],
  templateUrl: './professional-readiness-overview.html',
  styleUrl: './professional-readiness-overview.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfessionalReadinessOverview {
  private readonly api = inject(ProfessionalReadinessApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly navigateTo = output<ReadinessSettingsTab>();
  readonly readiness = signal<ProfessionalReadinessResponse | null>(null);
  readonly loading = signal(true);
  readonly failure = signal<ProfessionalReadinessFailure | null>(null);

  readonly blockingReasons = computed<readonly PresentedReason[]>(() => {
    const readiness = this.readiness();
    if (!readiness) return [];

    const reasons = [
      ...readiness.publicDirectory.blockingReasons,
      ...readiness.cabinet.blockingReasons,
    ];
    return [...new Set(reasons)].map((code) => ({
      code,
      presentation: readinessReasonPresentation(code),
    }));
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.failure.set(null);

    this.api
      .get()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (readiness) => this.readiness.set(readiness),
        error: (error: unknown) => {
          this.readiness.set(null);
          this.failure.set(mapProfessionalReadinessFailure(error));
        },
      });
  }

  activeCabinetLabel(count: number): string {
    return `${count} cabinet${count === 1 ? '' : 's'} actif${count === 1 ? '' : 's'}`;
  }

  verifiedAtLabel(value: string | null): string | null {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(date);
  }
}
