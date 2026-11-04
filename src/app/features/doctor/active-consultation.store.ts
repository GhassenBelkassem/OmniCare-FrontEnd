import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  DestroyRef,
  Injectable,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';

import { AuthTokenStore } from '../../core/auth/auth-token.store';
import { RealtimeService } from '../../core/realtime/realtime.service';
import type { ScheduledCareEvent } from '../../core/realtime/live-event.models';
import { ActiveConsultationApiService } from './active-consultation-api.service';
import type {
  ActiveConsultation,
  ConsultationSourceType,
  StartConsultationOutcome,
} from './active-consultation.models';

const CONSULTATION_EVENTS = new Set([
  'CONSULTATION_ACTIVATED',
  'CLINICAL_ACCESS_CHANGED',
  'CONSULTATION_UPDATED',
  'CONSULTATION_COMPLETED',
]);
const RECENT_EVENT_LIMIT = 256;

@Injectable({ providedIn: 'root' })
export class ActiveConsultationStore {
  private readonly api = inject(ActiveConsultationApiService);
  private readonly realtime = inject(RealtimeService);
  private readonly tokens = inject(AuthTokenStore);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private readonly valueState = signal<ActiveConsultation | null>(null);
  private readonly recentEventIds = new Set<string>();
  private ownerId: string | null = null;
  private generation = 0;
  private inFlight: Promise<ActiveConsultation | null> | null = null;
  private refreshPending = false;
  private readonly startKeys = new Map<string, string>();
  private startInFlight: { identity: string; request: Promise<StartConsultationOutcome> } | null = null;

  readonly active = this.valueState.asReadonly();
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly starting = signal(false);
  readonly startError = signal<string | null>(null);
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

    if (isPlatformBrowser(this.platformId)) {
      const refreshWhenVisible = (): void => {
        if (document.visibilityState === 'visible' && this.ownerId !== null) void this.refresh();
      };
      const refreshOnFocus = (): void => {
        if (this.ownerId !== null) void this.refresh();
      };
      document.addEventListener('visibilitychange', refreshWhenVisible);
      window.addEventListener('focus', refreshOnFocus);
      this.destroyRef.onDestroy(() => {
        document.removeEventListener('visibilitychange', refreshWhenVisible);
        window.removeEventListener('focus', refreshOnFocus);
      });
    }
  }

  startScheduledAppointment(
    appointmentId: string,
    expectedAppointmentVersion: number,
  ): Promise<StartConsultationOutcome> {
    return this.startSource(
      'SCHEDULED_APPOINTMENT', appointmentId, expectedAppointmentVersion,
    );
  }

  startUrgentCabinet(
    commitmentId: string,
    expectedCommitmentRevision: number,
  ): Promise<StartConsultationOutcome> {
    return this.startSource('URGENT_CABINET', commitmentId, expectedCommitmentRevision);
  }

  private startSource(
    sourceType: ConsultationSourceType,
    sourceId: string,
    expectedSourceVersion: number,
  ): Promise<StartConsultationOutcome> {
    const identity = `${sourceType}:${sourceId}:${expectedSourceVersion}`;
    if (this.startInFlight !== null) {
      return this.startInFlight.identity === identity
        ? this.startInFlight.request
        : Promise.resolve({ kind: 'FAILED', consultation: null });
    }

    const key = this.startKeys.get(identity) ?? this.newCommandKey();
    this.startKeys.set(identity, key);
    this.starting.set(true);
    this.startError.set(null);
    const ownerAtStart = this.ownerId;
    const generationAtStart = this.generation;
    const command = sourceType === 'SCHEDULED_APPOINTMENT'
      ? this.api.startScheduled(sourceId, expectedSourceVersion, key)
      : this.api.startCanonical(sourceType, sourceId, expectedSourceVersion, key);
    const request = firstValueFrom(command)
      .then((consultation): StartConsultationOutcome => {
        if (this.ownerId !== ownerAtStart || this.generation !== generationAtStart) {
          return { kind: 'FAILED', consultation: null };
        }
        this.valueState.set(consultation);
        this.startKeys.delete(identity);
        return { kind: 'STARTED', consultation };
      })
      .catch(async (failure: unknown): Promise<StartConsultationOutcome> => {
        const active = await this.refresh();
        if (this.ownerId !== ownerAtStart || this.generation !== generationAtStart) {
          return { kind: 'FAILED', consultation: null };
        }
        if (isSameSource(active, sourceType, sourceId)) {
          this.startKeys.delete(identity);
          this.startError.set(null);
          return { kind: 'RECOVERED', consultation: active };
        }
        if (active !== null) {
          this.startKeys.delete(identity);
          this.startError.set('Une consultation est déjà en cours.');
          return { kind: 'ACTIVE_CONFLICT', consultation: active };
        }
        if (!isAmbiguous(failure)) this.startKeys.delete(identity);
        this.startError.set('Impossible de démarrer la consultation. Réessayez.');
        return { kind: 'FAILED', consultation: null };
      })
      .finally(() => {
        if (this.startInFlight?.request === request) {
          this.startInFlight = null;
          this.starting.set(false);
        }
      });
    this.startInFlight = { identity, request };
    return request;
  }

  clearStartError(): void {
    this.startError.set(null);
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
    this.startInFlight = null;
    this.startKeys.clear();
    this.starting.set(false);
    this.startError.set(null);
    this.recentEventIds.clear();
  }

  private newCommandKey(): string {
    return globalThis.crypto?.randomUUID?.() ??
      `${Date.now()}-${Math.random().toString(16).slice(2)}`;
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

function isSameSource(
  consultation: ActiveConsultation | null,
  sourceType: ConsultationSourceType,
  sourceId: string,
): consultation is ActiveConsultation {
  return consultation?.sourceType === sourceType && consultation.sourceId === sourceId;
}

function isAmbiguous(error: unknown): boolean {
  return error instanceof HttpErrorResponse && (error.status === 0 || error.status >= 500);
}
