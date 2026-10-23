import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AuthService } from '../../../core/auth/auth.service';
import { OcButton, OcIcon, OcSkeleton, OcStatus, OcStatusBadge } from '../../../shared/ui';
import {
  UrgentCareReadinessResponse,
  UrgentModeReadinessResponse,
  UrgentReadinessBlockingReason,
} from './urgent-care-configuration-api.models';
import { UrgentCareConfigurationApiService } from './urgent-care-configuration-api.service';
import {
  UrgentReadinessReasonPresentation,
  urgentReadinessReasonPresentation,
} from './urgent-care-readiness-presentation';

export type UrgentReadinessFailure = 'session-expired' | 'access-denied' | 'unavailable';

@Component({
  selector: 'app-urgent-care-readiness-settings',
  imports: [OcButton, OcIcon, OcSkeleton, OcStatusBadge],
  templateUrl: './urgent-care-readiness-settings.html',
  styleUrl: './urgent-care-readiness-settings.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UrgentCareReadinessSettings {
  private readonly api = inject(UrgentCareConfigurationApiService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private requestSequence = 0;

  readonly readiness = signal<UrgentCareReadinessResponse | null>(null);
  readonly loading = signal(false);
  readonly stale = signal(false);
  readonly failure = signal<UrgentReadinessFailure | null>(null);
  readonly professionalLabel = computed(() =>
    this.readiness()?.professionalEligible ? 'Profil éligible' : 'Profil non éligible',
  );

  constructor() {
    this.refresh();
  }

  refresh(): void {
    const requestId = ++this.requestSequence;
    this.loading.set(true);
    this.failure.set(null);
    if (this.readiness() !== null) this.stale.set(true);

    this.api
      .readiness()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (readiness) => {
          if (requestId !== this.requestSequence) return;
          this.readiness.set(readiness);
          this.stale.set(false);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          if (requestId !== this.requestSequence) return;
          const failure = classifyFailure(error);
          this.failure.set(failure);
          this.loading.set(false);
          if (failure === 'session-expired' || failure === 'access-denied') {
            this.readiness.set(null);
            this.stale.set(false);
          } else {
            this.stale.set(this.readiness() !== null);
          }
        },
      });
  }

  reAuthenticate(): void {
    this.auth.logout();
  }

  presentation(reason: UrgentReadinessBlockingReason): UrgentReadinessReasonPresentation {
    return urgentReadinessReasonPresentation(reason);
  }

  status(value: boolean): OcStatus {
    return value ? 'confirmed' : 'requires-attention';
  }

  capabilityLabel(mode: UrgentModeReadinessResponse): string {
    return mode.capabilityEnabled ? 'Capacité activée' : 'Capacité désactivée';
  }

  configurationLabel(mode: UrgentModeReadinessResponse): string {
    return mode.configurationReady ? 'Configuration complète' : 'Configuration incomplète';
  }

  runtimeLabel(mode: UrgentModeReadinessResponse): string {
    return mode.runtimeAvailabilityIntent
      ? 'Intention opérationnelle active'
      : 'Disponibilité opérationnelle inactive';
  }

  eligibilityLabel(mode: UrgentModeReadinessResponse, complete: boolean): string {
    if (!complete) return 'Vérification complète non effectuée';
    return mode.effectiveCurrentEligibility
      ? 'Éligibilité actuelle confirmée'
      : 'Non éligible actuellement';
  }

  eligibilityStatus(mode: UrgentModeReadinessResponse, complete: boolean): OcStatus {
    return complete && mode.effectiveCurrentEligibility ? 'confirmed' : 'requires-attention';
  }

  evaluatedAtLabel(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'heure indisponible';
    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Africa/Tunis',
    }).format(date);
  }
}

function classifyFailure(error: unknown): UrgentReadinessFailure {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 401) return 'session-expired';
    if (error.status === 403) return 'access-denied';
  }
  return 'unavailable';
}
