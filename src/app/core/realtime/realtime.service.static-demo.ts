import { Injectable, computed, inject, signal, type Signal } from '@angular/core';
import { EMPTY, type Observable } from 'rxjs';
import { SensitiveStateRegistry } from '../auth/sensitive-state.registry';

import type {
  AppointmentLiveEvent,
  NotificationInvalidation,
  ScheduledCareEvent,
  UrgentLiveEvent,
} from './live-event.models';

export type RealtimeStatus = 'connecting' | 'connected' | 'disconnected';
export type RealtimeHealth = 'live' | 'stale' | 'down';

/**
 * Compile-time static-demo replacement for RealtimeService.
 *
 * It intentionally has no STOMP or SockJS imports. This keeps the offline demo
 * from opening sockets and prevents SockJS from registering its global unload
 * listener inside embedded preview documents.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly sensitiveState = inject(SensitiveStateRegistry);
  readonly status = signal<RealtimeStatus>('connected');
  readonly connectionEpoch = signal(1);
  readonly lastEventAt = signal<number | null>(null);

  readonly urgentEvents$: Observable<UrgentLiveEvent> = EMPTY;
  readonly appointmentEvents$: Observable<AppointmentLiveEvent> = EMPTY;
  readonly scheduledCareEvents$: Observable<ScheduledCareEvent> = EMPTY;
  readonly notificationEvents$: Observable<NotificationInvalidation> = EMPTY;

  constructor() {
    this.sensitiveState.register(() => this.terminateSession(), 'CONNECTION');
  }

  health(_expectedActivity: Signal<boolean>): Signal<RealtimeHealth> {
    return computed(() => 'live');
  }

  terminateSession(): void {
    this.status.set('disconnected');
    this.lastEventAt.set(null);
  }
}

export type {
  AppointmentIdData,
  AppointmentLiveEvent,
  AppointmentLiveEventName,
  BookingConfirmedData,
  DoctorArrivedData,
  DoctorLocationUpdateData,
  NewOfferData,
  OfferAcceptedData,
  OfferDeclinedData,
  RequestIdData,
  RequestMatchedData,
  ScheduledCareEvent,
  UrgentLiveEvent,
  UrgentLiveEventName,
} from './live-event.models';
