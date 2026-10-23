import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';

import { AuthTokenStore } from '../../core/auth/auth-token.store';
import { RealtimeService } from '../../core/realtime/realtime.service';
import type { ScheduledCareEvent } from '../../core/realtime/live-event.models';
import { ActiveConsultationApiService } from './active-consultation-api.service';
import type { ActiveConsultation } from './active-consultation.models';

const CONSULTATION_EVENTS = new Set([
  'CONSULTATION_ACTIVATED',
  'CONSULTATION_UPDATED',
  'CLINICAL_ACCESS_CHANGED',
]);
const RECENT_EVENT_LIMIT = 256;

@Injectable({ providedIn: 'root' })
export class ActiveConsultationStore {
  private readonly api = inject(ActiveConsultationApiService);
  private readonly realtime = inject(RealtimeService);
  private readonly tokens = inject(AuthTokenStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly valueState = signal<ActiveConsultation | null>(null);
  private readonly recentEventIds = new Set<string>();
  private ownerId: string | null = null;
  private generation = 0;
  private inFlight: Promise<ActiveConsultation | null> | null = null;
  private refreshPending = false;

  readonly active = this.valueState.asReadonly();
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly consultationId = computed(() => this.active()?.consultationId ?? null);

  constructor() {
    this.realtime.scheduledCareEvents$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => this.onInvalidation(event));

    let observedEpoch = this.realtime.connectionEpoch();
    effect(() => {
      const epoch = this.realtime.connectionEpoch();
      if (epoch === observedEpoch) return;
      observedEpoch = epoch;
      if (this.ownerId !== null) void this.refresh();
    });

    effect(() => {
      const user = this.tokens.user();
      const doctorId = user?.role === 'DOCTOR' ? user.id : null;
      if (doctorId === this.ownerId) return;
      this.ownerId = doctorId;
      this.clear();
      if (doctorId !== null) void this.refresh();
    });
  }

  refresh(): Promise<ActiveConsultation | null> {
    if (this.ownerId === null) {
      this.clear();
      return Promise.resolve(null);
    }
    if (this.inFlight !== null) {
      this.refreshPending = true;
      return this.inFlight;
    }

    const ownerAtStart = this.ownerId;
    const generationAtStart = this.generation;
    this.loading.set(true);
    this.error.set(null);
    const request = firstValueFrom(this.api.getActive())
      .then((active) => {
        if (this.ownerId === ownerAtStart && this.generation === generationAtStart) {
          this.valueState.set(active);
        }
        return active;
      })
      .catch(() => {
        if (this.ownerId === ownerAtStart && this.generation === generationAtStart) {
          this.error.set('Impossible de synchroniser la consultation active.');
        }
        return null;
      })
      .finally(() => {
        if (this.inFlight !== request) return;
        this.inFlight = null;
        this.loading.set(false);
        if (this.refreshPending && this.ownerId !== null) {
          this.refreshPending = false;
          void this.refresh();
        }
      });
    this.inFlight = request;
    return request;
  }

  clear(): void {
    this.generation += 1;
    this.valueState.set(null);
    this.error.set(null);
    this.loading.set(false);
    this.refreshPending = false;
    this.recentEventIds.clear();
  }

  detach(): void {
    this.ownerId = null;
    this.clear();
  }

  private onInvalidation(event: ScheduledCareEvent): void {
    if (
      this.ownerId === null ||
      event.resourceType !== 'CONSULTATION' ||
      !CONSULTATION_EVENTS.has(event.eventType) ||
      this.recentEventIds.has(event.eventId)
    ) {
      return;
    }
    this.remember(event.eventId);
    const current = this.valueState();
    if (
      current !== null &&
      current.consultationId === event.resourceId &&
      current.version >= event.version
    ) {
      return;
    }
    void this.refresh();
  }

  private remember(eventId: string): void {
    this.recentEventIds.add(eventId);
    if (this.recentEventIds.size <= RECENT_EVENT_LIMIT) return;
    const oldest = this.recentEventIds.values().next().value;
    if (typeof oldest === 'string') this.recentEventIds.delete(oldest);
  }
}
