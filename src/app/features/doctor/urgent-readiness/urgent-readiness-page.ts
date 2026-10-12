import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';

import {
  OcButton,
  OcCard,
  OcIcon,
  OcPageHeader,
  OcSkeleton,
  OcStatusBadge,
} from '../../../shared/ui';
import {
  URGENT_READINESS_STATIC_FIXTURE,
  URGENT_RUNTIME_FIXTURES,
} from './urgent-readiness.fixtures';
import {
  UrgentPermanentCapabilityProjection,
  UrgentRuntimeEligibilityDto,
  UrgentRuntimePresentation,
} from './urgent-readiness.models';
import { UrgentReadinessCapabilityReader } from './urgent-readiness-capability-reader.service';
import { presentUrgentOperation, presentUrgentRuntime } from './urgent-readiness.presentation';

@Component({
  selector: 'app-urgent-readiness-page',
  imports: [OcButton, OcCard, OcIcon, OcPageHeader, OcSkeleton, OcStatusBadge],
  templateUrl: './urgent-readiness-page.html',
  styleUrl: './urgent-readiness-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UrgentReadinessPage {
  private readonly reader = inject(UrgentReadinessCapabilityReader);
  private readonly fixture = inject(URGENT_READINESS_STATIC_FIXTURE);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly capabilities = signal<UrgentPermanentCapabilityProjection | null>(null);
  readonly operation = signal(this.fixture.operation);
  readonly operationView = computed(() => presentUrgentOperation(this.operation()));
  readonly homeRuntime = computed(() => this.buildHomeRuntime());
  readonly homeRuntimeView = computed(() => presentUrgentRuntime(this.homeRuntime()));
  readonly cabinetRuntimes = computed(() => this.buildCabinetRuntimes());

  constructor() {
    this.load();
  }

  load(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set(null);
    this.reader
      .load()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (capabilities) => this.capabilities.set(capabilities),
        error: () => {
          this.capabilities.set(null);
          this.error.set(
            'Impossible de charger les capacités urgentes et les cabinets actifs. Aucun statut permanent ne peut être confirmé.',
          );
        },
      });
  }

  openCapabilitySettings(): void {
    void this.router.navigate(['/doctor/settings'], { queryParams: { tab: 'services' } });
  }

  runtimeView(runtime: UrgentRuntimeEligibilityDto): UrgentRuntimePresentation {
    return presentUrgentRuntime(runtime);
  }

  private buildHomeRuntime(): UrgentRuntimeEligibilityDto {
    if (this.capabilities()?.urgentHomeEnabled === false) {
      return URGENT_RUNTIME_FIXTURES.missingHomeEligibility;
    }
    return this.fixture.runtimeHome;
  }

  private buildCabinetRuntimes(): readonly UrgentRuntimeEligibilityDto[] {
    const capabilities = this.capabilities();
    if (!capabilities) return [this.fixture.runtimeCabinetFallback];

    if (capabilities.activePracticeLocations.length === 0) {
      return [];
    }

    return capabilities.activePracticeLocations.map((location) => ({
      ...this.fixture.runtimeCabinetFallback,
      practiceLocationId: location.id,
      practiceLocationLabel: location.label,
      declaredAvailability: 'UNKNOWN',
      effectiveEligibility: capabilities.urgentCabinetEnabled ? 'UNKNOWN' : 'INELIGIBLE',
      operationalHealth: 'NOT_CONNECTED',
      reasonCode: capabilities.urgentCabinetEnabled
        ? 'RUNTIME_PROJECTION_NOT_CONNECTED'
        : 'CAPABILITY_DISABLED',
    }));
  }
}
