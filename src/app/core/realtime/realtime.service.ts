import { DestroyRef, Injectable, PLATFORM_ID, computed, effect, inject, signal, type Signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Subject } from 'rxjs';
import { Client, type IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { AuthTokenStore } from '../auth/auth-token.store';
import { RUNTIME_CONFIG } from '../config/runtime-config';
import {
  APPOINTMENTS_QUEUE,
  URGENT_REQUESTS_QUEUE,
  type AppointmentIdData,
  type AppointmentLiveEvent,
  type AppointmentLiveEventName,
  type BookingConfirmedData,
  type DoctorArrivedData,
  type DoctorLocationUpdateData,
  type LiveEventEnvelope,
  type NewOfferData,
  type OfferAcceptedData,
  type OfferDeclinedData,
  type RequestIdData,
  type RequestMatchedData,
  type UrgentLiveEvent,
  type UrgentLiveEventName,
} from './live-event.models';

export type RealtimeStatus = 'connecting' | 'connected' | 'disconnected';
export type RealtimeHealth = 'live' | 'stale' | 'down';

const RECONNECT_DELAY_MS = 5_000;
const STALE_AFTER_MS = 90_000;
const HEALTH_TICK_MS = 15_000;

const URGENT_EVENT_NAMES: ReadonlySet<string> = new Set<string>([
  'NEW_OFFER',
  'OFFER_ACCEPTED',
  'OFFER_DECLINED',
  'REQUEST_MATCHED',
  'REQUEST_EXPIRED',
  'REQUEST_CANCELLED',
  'DOCTOR_ARRIVED',
  'DOCTOR_LOCATION_UPDATE',
]);

const APPOINTMENT_EVENT_NAMES: ReadonlySet<string> = new Set<string>([
  'BOOKING_CONFIRMED',
  'APPOINTMENT_CANCELLED',
  'APPOINTMENT_STARTED',
  'APPOINTMENT_COMPLETED',
]);

/**
 * STOMP-over-SockJS bridge to the backend live-event broker.
 *
 * Backend contract (verified):
 * - endpoint `{apiBaseUrl}/ws`, SockJS transport;
 * - CONNECT native header exactly `Authorization: Bearer <token>`;
 * - an invalid token does NOT fail the CONNECT - the connection succeeds with
 *   no principal, so user queues silently receive nothing. Consumers must use
 *   `health()` to surface a degraded state instead of trusting silence.
 * - auth is evaluated once at CONNECT: when the access token changes we
 *   reconnect with the fresh token.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly runtimeConfig = inject(RUNTIME_CONFIG);
  private readonly tokens = inject(AuthTokenStore);
  private readonly destroyRef = inject(DestroyRef);

  private client: Client | null = null;
  private readonly urgentSubject = new Subject<UrgentLiveEvent>();
  private readonly appointmentSubject = new Subject<AppointmentLiveEvent>();

  private readonly connectedAt = signal<number | null>(null);
  /** Re-evaluation clock so `health()` recomputes without incoming events. */
  private readonly healthTick = signal(0);

  readonly status = signal<RealtimeStatus>('disconnected');
  readonly lastEventAt = signal<number | null>(null);
  readonly urgentEvents$ = this.urgentSubject.asObservable();
  readonly appointmentEvents$ = this.appointmentSubject.asObservable();

  constructor() {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    let activeToken: string | null | undefined;
    effect(() => {
      const token = this.tokens.accessToken();
      if (activeToken === undefined) {
        activeToken = token;
        if (token !== null) {
          this.startClient(token);
        }
        return;
      }
      if (token !== activeToken) {
        activeToken = token;
        this.startClient(token);
      }
    });

    const tickHandle = setInterval(() => {
      this.healthTick.update((value) => value + 1);
    }, HEALTH_TICK_MS);

    this.destroyRef.onDestroy(() => {
      clearInterval(tickHandle);
      this.stopClient();
    });
  }

  /**
   * Live-connection health for a surface that expects activity.
   * - `down`: socket not connected.
   * - `stale`: connected but no event within the staleness window while
   *   activity is expected (covers the silent-auth-failure mode).
   * - `live`: connected and fresh.
   */
  health(expectedActivity: Signal<boolean>): Signal<RealtimeHealth> {
    return computed(() => {
      this.healthTick();
      if (this.status() !== 'connected') {
        return 'down';
      }
      if (!expectedActivity()) {
        return 'live';
      }
      const reference = this.lastEventAt() ?? this.connectedAt();
      if (reference === null) {
        return 'stale';
      }
      return Date.now() - reference > STALE_AFTER_MS ? 'stale' : 'live';
    });
  }

  private startClient(token: string | null): void {
    this.stopClient();
    if (token === null) {
      return;
    }

    const url = `${this.runtimeConfig.apiBaseUrl}/ws`;
    const client = new Client({
      webSocketFactory: () => new SockJS(url) as unknown as WebSocket,
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: RECONNECT_DELAY_MS,
      onConnect: () => {
        this.connectedAt.set(Date.now());
        this.status.set('connected');
        client.subscribe(URGENT_REQUESTS_QUEUE, (message) =>
          this.onMessage(message, this.urgentSubject, URGENT_EVENT_NAMES),
        );
        client.subscribe(APPOINTMENTS_QUEUE, (message) =>
          this.onMessage(message, this.appointmentSubject, APPOINTMENT_EVENT_NAMES),
        );
      },
      onWebSocketClose: () => {
        if (this.status() === 'connected') {
          this.status.set('connecting');
        }
      },
      onStompError: () => this.status.set('disconnected'),
    });

    this.client = client;
    this.status.set('connecting');
    void client.activate();
  }

  private stopClient(): void {
    const client = this.client;
    this.client = null;
    this.status.set('disconnected');
    this.connectedAt.set(null);
    if (client !== null) {
      void client.deactivate();
    }
  }

  private onMessage<T extends object>(
    message: IMessage,
    subject: Subject<T>,
    knownEventNames: ReadonlySet<string>,
  ): void {
    let envelope: LiveEventEnvelope<Record<string, unknown>>;
    try {
      envelope = JSON.parse(message.body) as LiveEventEnvelope<Record<string, unknown>>;
    } catch {
      return;
    }
    if (
      typeof envelope.event !== 'string' ||
      envelope.data === null ||
      typeof envelope.data !== 'object'
    ) {
      return;
    }
    if (!knownEventNames.has(envelope.event)) {
      return;
    }
    this.lastEventAt.set(Date.now());
    subject.next({
      name: envelope.event,
      data: envelope.data,
      timestamp: envelope.timestamp,
    } as T);
  }
}

export type {
  AppointmentIdData,
  AppointmentLiveEvent,
  BookingConfirmedData,
  DoctorArrivedData,
  DoctorLocationUpdateData,
  NewOfferData,
  OfferAcceptedData,
  OfferDeclinedData,
  RequestIdData,
  RequestMatchedData,
  UrgentLiveEvent,
};
export type { AppointmentLiveEventName, UrgentLiveEventName };
