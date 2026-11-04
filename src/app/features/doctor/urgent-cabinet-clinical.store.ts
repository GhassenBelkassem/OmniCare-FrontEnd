import { isPlatformBrowser } from '@angular/common';
import { DestroyRef, Injectable, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';

import { AuthTokenStore } from '../../core/auth/auth-token.store';
import { RealtimeService } from '../../core/realtime/realtime.service';
import type { ScheduledCareEvent } from '../../core/realtime/live-event.models';
import { UrgentCabinetClinicalApiService } from './urgent-cabinet-clinical-api.service';
import type {
  UrgentCabinetClinicalCommitment,
  UrgentCabinetProtectedIntakeContext,
} from './urgent-cabinet-clinical.models';

@Injectable({ providedIn: 'root' })
export class UrgentCabinetClinicalStore {
  private readonly api = inject(UrgentCabinetClinicalApiService);
  private readonly tokens = inject(AuthTokenStore);
  private readonly realtime = inject(RealtimeService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private readonly values = signal<readonly UrgentCabinetClinicalCommitment[]>([]);
  private readonly intakeState = signal<UrgentCabinetProtectedIntakeContext | null>(null);
  private ownerId: string | null = null;
  private inFlight: Promise<void> | null = null;

  readonly commitments = this.values.asReadonly();
  readonly protectedIntake = this.intakeState.asReadonly();
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly actionable = computed(() => this.values().find((value) =>
    value.status === 'ACTIVE' &&
    value.arrivalVerifiedAt !== null &&
    value.consultationId === null &&
    value.clinicalStartReady &&
    value.allowedActions.includes('START_CONSULTATION'),
  ) ?? null);
  readonly waiting = computed(() => this.values().find((value) =>
    value.status === 'ACTIVE' &&
    value.arrivalVerifiedAt !== null &&
    value.consultationId === null &&
    !value.clinicalStartReady,
  ) ?? null);

  constructor() {
    effect(() => {
      const user = this.tokens.user();
      const nextOwner = user?.role === 'DOCTOR' ? user.id : null;
      if (nextOwner === this.ownerId) return;
      this.ownerId = nextOwner;
      this.values.set([]);
      this.intakeState.set(null);
      this.error.set(null);
      if (nextOwner !== null) void this.refresh();
    });
    this.realtime.scheduledCareEvents$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => this.onInvalidation(event));
    if (isPlatformBrowser(this.platformId)) {
      const refetch = (): void => {
        if (this.ownerId !== null && document.visibilityState === 'visible') void this.refresh();
      };
      document.addEventListener('visibilitychange', refetch);
      window.addEventListener('focus', refetch);
      this.destroyRef.onDestroy(() => {
        document.removeEventListener('visibilitychange', refetch);
        window.removeEventListener('focus', refetch);
      });
    }
  }

  refresh(): Promise<void> {
    if (this.ownerId === null) return Promise.resolve();
    if (this.inFlight !== null) return this.inFlight;
    const owner = this.ownerId;
    this.loading.set(true);
    this.error.set(null);
    const request = firstValueFrom(this.api.list())
      .then(async (values) => {
        if (this.ownerId !== owner) return;
        this.values.set(values);
        const authority = values.find((value) => value.status === 'ACTIVE') ?? null;
        if (authority === null) {
          this.intakeState.set(null);
          return;
        }
        try {
          const intake = await firstValueFrom(this.api.protectedIntake(authority.requestId));
          if (this.ownerId === owner) {
            this.intakeState.set({ ...intake, commitmentId: authority.commitmentId });
          }
        } catch {
          if (this.ownerId === owner) this.intakeState.set(null);
        }
      })
      .catch(() => {
        if (this.ownerId === owner) {
          this.error.set('Impossible de synchroniser la responsabilité urgente.');
        }
      })
      .finally(() => {
        if (this.inFlight === request) {
          this.inFlight = null;
          this.loading.set(false);
        }
      });
    this.inFlight = request;
    return request;
  }

  private onInvalidation(event: ScheduledCareEvent): void {
    if (this.ownerId !== null && event.resourceType === 'CONSULTATION') void this.refresh();
  }
}
