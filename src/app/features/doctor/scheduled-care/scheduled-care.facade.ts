import { isPlatformBrowser } from '@angular/common';
import { DestroyRef, Injectable, PLATFORM_ID, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AuthTokenStore } from '../../../core/auth/auth-token.store';
import { SensitiveStateRegistry } from '../../../core/auth/sensitive-state.registry';
import { RealtimeService } from '../../../core/realtime/realtime.service';
import { ScheduledCareApiService } from './scheduled-care-api.service';
import {
  isUnknownMutationOutcome,
  requestMustRefresh,
  scheduledCareErrorMessage,
  scheduledCareProblemCode,
} from './scheduled-care-errors';
import type {
  Appointment,
  AvailabilitySlot,
  BookingRequest,
  DoctorReasonCode,
  DoctorHomeSummary,
  DoctorScheduledCareItem,
} from './scheduled-care.models';

type CommandKind = 'accept' | 'propose' | 'decline' | 'cancel-appointment';

@Injectable({ providedIn: 'root' })
export class ScheduledCareFacade {
  private readonly api = inject(ScheduledCareApiService);
  private readonly realtime = inject(RealtimeService);
  private readonly tokens = inject(AuthTokenStore);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sensitiveState = inject(SensitiveStateRegistry);
  private readonly commandKeys = new Map<string, string>();
  private homeGeneration = 0;
  private requestGeneration = 0;
  private appointmentGeneration = 0;
  private activeAppointmentOverview: DoctorScheduledCareItem | null = null;

  readonly home = signal<DoctorHomeSummary | null>(null);
  readonly homeLoading = signal(false);
  readonly homeError = signal<string | null>(null);

  readonly activeRequest = signal<BookingRequest | null>(null);
  readonly requestLoading = signal(false);
  readonly requestError = signal<string | null>(null);

  readonly activeAppointment = signal<Appointment | null>(null);
  readonly appointmentLoading = signal(false);
  readonly appointmentError = signal<string | null>(null);

  readonly commandLoading = signal(false);
  readonly commandError = signal<string | null>(null);
  readonly commandOutcomeUnknown = signal(false);

  readonly availability = signal<readonly AvailabilitySlot[]>([]);
  readonly availabilityTimezone = signal('Africa/Tunis');
  readonly availabilityLoading = signal(false);
  readonly availabilityError = signal<string | null>(null);

  /** Calendar and bounded list consumers refetch their own currently visible range. */
  readonly projectionInvalidationEpoch = signal(0);

  constructor() {
    this.sensitiveState.register(() => this.clearSensitiveState());
    this.realtime.scheduledCareEvents$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        this.loadHome(true);
        this.projectionInvalidationEpoch.update((value) => value + 1);
        if (
          event.resourceType === 'BOOKING_REQUEST' &&
          this.activeRequest()?.requestId === event.resourceId
        ) {
          this.refreshActiveRequest(true);
        }
        if (
          event.resourceType === 'APPOINTMENT' &&
          this.activeAppointment()?.appointmentId === event.resourceId
        ) {
          this.refreshActiveAppointment(true);
        }
      });

    let observedConnectionEpoch = this.realtime.connectionEpoch();
    effect(() => {
      const epoch = this.realtime.connectionEpoch();
      if (epoch === observedConnectionEpoch) return;
      observedConnectionEpoch = epoch;
      this.resyncVisibleState();
    });

    if (isPlatformBrowser(this.platformId)) {
      const onVisibility = (): void => {
        if (document.visibilityState === 'visible') this.resyncVisibleState();
      };
      document.addEventListener('visibilitychange', onVisibility);
      this.destroyRef.onDestroy(() =>
        document.removeEventListener('visibilitychange', onVisibility),
      );
    }
  }

  clearSensitiveState(): void {
    this.homeGeneration++;
    this.requestGeneration++;
    this.appointmentGeneration++;
    this.commandKeys.clear();
    this.home.set(null);
    this.homeLoading.set(false);
    this.homeError.set(null);
    this.activeRequest.set(null);
    this.requestLoading.set(false);
    this.requestError.set(null);
    this.activeAppointment.set(null);
    this.activeAppointmentOverview = null;
    this.appointmentLoading.set(false);
    this.appointmentError.set(null);
    this.commandLoading.set(false);
    this.commandError.set(null);
    this.commandOutcomeUnknown.set(false);
    this.availability.set([]);
    this.availabilityLoading.set(false);
    this.availabilityError.set(null);
    this.projectionInvalidationEpoch.set(0);
  }

  loadHome(silent = false): void {
    const generation = ++this.homeGeneration;
    if (!silent) this.homeLoading.set(true);
    this.homeError.set(null);
    this.api
      .getDoctorHomeSummary()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (summary) => {
          if (generation !== this.homeGeneration) return;
          this.home.set(summary);
          this.homeLoading.set(false);
        },
        error: () => {
          if (generation !== this.homeGeneration) return;
          this.homeLoading.set(false);
          if (!silent) this.homeError.set('Impossible de charger les rendez-vous planifiés.');
        },
      });
  }

  openRequest(requestId: string): void {
    this.activeRequest.set(null);
    this.requestError.set(null);
    this.commandError.set(null);
    this.commandOutcomeUnknown.set(false);
    this.requestLoading.set(true);
    this.loadRequest(requestId, false);
  }

  closeRequest(): void {
    this.activeRequest.set(null);
    this.requestError.set(null);
    this.availability.set([]);
    this.availabilityError.set(null);
  }

  openAppointment(
    appointmentId: string,
    overview: DoctorScheduledCareItem | null = null,
  ): void {
    this.activeAppointment.set(null);
    this.activeAppointmentOverview = overview?.appointmentId === appointmentId ? overview : null;
    this.appointmentError.set(null);
    this.commandError.set(null);
    this.commandOutcomeUnknown.set(false);
    this.appointmentLoading.set(true);
    this.loadAppointment(appointmentId, false);
  }

  closeAppointment(): void {
    this.activeAppointment.set(null);
    this.activeAppointmentOverview = null;
    this.appointmentError.set(null);
  }

  loadProposalAvailability(): void {
    const request = this.activeRequest();
    const doctorId = this.tokens.user()?.id;
    if (!request || !doctorId || this.availabilityLoading()) return;

    const now = Date.now();
    const requested = Date.parse(request.originalRequestedSlot.start);
    const fromMs = Number.isNaN(requested)
      ? now
      : Math.max(now, requested - 7 * 24 * 60 * 60 * 1_000);
    const toMs = fromMs + 21 * 24 * 60 * 60 * 1_000;
    this.availabilityLoading.set(true);
    this.availabilityError.set(null);
    this.api
      .getAvailability(
        doctorId,
        request.cabinet.practiceLocationId,
        new Date(fromMs).toISOString(),
        new Date(toMs).toISOString(),
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (this.activeRequest()?.requestId !== request.requestId) return;
          this.availability.set(response.slots);
          this.availabilityTimezone.set(response.timezone);
          this.availabilityLoading.set(false);
        },
        error: (error) => {
          this.availabilityLoading.set(false);
          this.availabilityError.set(
            scheduledCareErrorMessage(error, 'Impossible de charger les créneaux disponibles.'),
          );
        },
      });
  }

  acceptRequest(): void {
    const request = this.activeRequest();
    if (!request || !request.availableActions.includes('ACCEPT_REQUEST') || this.commandLoading()) {
      return;
    }
    const identity = this.commandIdentity('accept', request.requestId, request.version);
    const key = this.idempotencyKey(identity);
    this.beginCommand();
    this.api
      .acceptBookingRequest(request.requestId, request.version, key)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.commandKeys.delete(identity);
          this.activeRequest.set(result.request);
          this.finishSuccessfulCommand();
        },
        error: (error) => this.handleRequestCommandError(error, identity),
      });
  }

  proposeTime(slot: AvailabilitySlot): void {
    const request = this.activeRequest();
    if (
      !request ||
      !request.availableActions.includes('PROPOSE_NEW_TIME') ||
      this.commandLoading()
    ) {
      return;
    }
    const identity = this.commandIdentity(
      'propose',
      request.requestId,
      request.version,
      `${slot.start}:${slot.end}`,
    );
    const key = this.idempotencyKey(identity);
    this.beginCommand();
    this.api
      .proposeBookingTime(
        request.requestId,
        {
          expectedVersion: request.version,
          practiceLocationId: request.cabinet.practiceLocationId,
          proposedSlot: { start: slot.start, end: slot.end },
        },
        key,
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.commandKeys.delete(identity);
          this.activeRequest.set(updated);
          this.availability.set([]);
          this.finishSuccessfulCommand();
        },
        error: (error) => this.handleRequestCommandError(error, identity, true),
      });
  }

  declineRequest(reasonCode: DoctorReasonCode): void {
    const request = this.activeRequest();
    if (
      !request ||
      !request.availableActions.includes('DECLINE_REQUEST') ||
      this.commandLoading()
    ) {
      return;
    }
    const identity = this.commandIdentity(
      'decline',
      request.requestId,
      request.version,
      reasonCode,
    );
    const key = this.idempotencyKey(identity);
    this.beginCommand();
    this.api
      .declineBookingRequest(request.requestId, request.version, reasonCode, key)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.commandKeys.delete(identity);
          this.activeRequest.set(updated);
          this.finishSuccessfulCommand();
        },
        error: (error) => this.handleRequestCommandError(error, identity),
      });
  }

  cancelAppointment(reasonCode: DoctorReasonCode): void {
    const appointment = this.activeAppointment();
    if (
      !appointment ||
      appointment.version === null ||
      !appointment.availableActions.includes('CANCEL_APPOINTMENT') ||
      this.commandLoading()
    ) {
      return;
    }
    const identity = this.commandIdentity(
      'cancel-appointment',
      appointment.appointmentId,
      appointment.version,
      reasonCode,
    );
    const key = this.idempotencyKey(identity);
    this.beginCommand();
    this.api
      .cancelAppointment(
        appointment.appointmentId,
        appointment.version,
        reasonCode,
        key,
        this.activeAppointmentOverview?.appointmentId === appointment.appointmentId
          ? this.activeAppointmentOverview
          : null,
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.commandKeys.delete(identity);
          this.activeAppointment.set(updated);
          this.finishSuccessfulCommand();
        },
        error: (error) => {
          this.commandLoading.set(false);
          const unknown = isUnknownMutationOutcome(error);
          this.commandOutcomeUnknown.set(unknown);
          this.commandError.set(scheduledCareErrorMessage(error));
          if (!unknown) this.commandKeys.delete(identity);
          this.refreshActiveAppointment(true, unknown ? identity : null);
        },
      });
  }

  private beginCommand(): void {
    this.commandLoading.set(true);
    this.commandError.set(null);
    this.commandOutcomeUnknown.set(false);
  }

  private finishSuccessfulCommand(): void {
    this.commandLoading.set(false);
    this.commandError.set(null);
    this.commandOutcomeUnknown.set(false);
    this.loadHome(true);
    this.projectionInvalidationEpoch.update((value) => value + 1);
  }

  private handleRequestCommandError(
    error: unknown,
    identity: string,
    refreshAvailability = false,
  ): void {
    this.commandLoading.set(false);
    const unknown = isUnknownMutationOutcome(error);
    this.commandOutcomeUnknown.set(unknown);
    this.commandError.set(scheduledCareErrorMessage(error));
    if (!unknown) this.commandKeys.delete(identity);
    if (unknown || requestMustRefresh(error)) {
      this.refreshActiveRequest(true, unknown ? identity : null);
    }
    if (refreshAvailability && scheduledCareProblemCode(error) === 'SLOT_NO_LONGER_AVAILABLE') {
      this.loadProposalAvailability();
    }
  }

  private refreshActiveRequest(silent: boolean, uncertainIdentity: string | null = null): void {
    const id = this.activeRequest()?.requestId;
    if (id) this.loadRequest(id, silent, uncertainIdentity);
  }

  private loadRequest(
    requestId: string,
    silent: boolean,
    uncertainIdentity: string | null = null,
  ): void {
    const generation = ++this.requestGeneration;
    if (!silent) this.requestLoading.set(true);
    this.api
      .getDoctorBookingRequest(requestId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (request) => {
          if (generation !== this.requestGeneration) return;
          this.activeRequest.set(request);
          this.requestLoading.set(false);
          this.requestError.set(null);
          if (
            uncertainIdentity !== null &&
            !request.availableActions.some(
              (action) =>
                action === 'ACCEPT_REQUEST' ||
                action === 'PROPOSE_NEW_TIME' ||
                action === 'DECLINE_REQUEST',
            )
          ) {
            this.commandKeys.delete(uncertainIdentity);
            this.commandOutcomeUnknown.set(false);
            this.commandError.set(null);
            this.finishSuccessfulCommand();
          }
        },
        error: (error) => {
          if (generation !== this.requestGeneration) return;
          this.requestLoading.set(false);
          if (!silent) {
            this.requestError.set(
              scheduledCareErrorMessage(error, 'Impossible de charger cette demande.'),
            );
          }
        },
      });
  }

  private refreshActiveAppointment(silent: boolean, uncertainIdentity: string | null = null): void {
    const id = this.activeAppointment()?.appointmentId;
    if (id) this.loadAppointment(id, silent, uncertainIdentity);
  }

  private loadAppointment(
    appointmentId: string,
    silent: boolean,
    uncertainIdentity: string | null = null,
  ): void {
    const generation = ++this.appointmentGeneration;
    if (!silent) this.appointmentLoading.set(true);
    this.api
      .getAppointment(
        appointmentId,
        this.activeAppointmentOverview?.appointmentId === appointmentId
          ? this.activeAppointmentOverview
          : null,
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (appointment) => {
          if (generation !== this.appointmentGeneration) return;
          this.activeAppointment.set(appointment);
          this.appointmentLoading.set(false);
          this.appointmentError.set(null);
          if (
            uncertainIdentity !== null &&
            !appointment.availableActions.includes('CANCEL_APPOINTMENT')
          ) {
            this.commandKeys.delete(uncertainIdentity);
            this.commandOutcomeUnknown.set(false);
            this.commandError.set(null);
            this.finishSuccessfulCommand();
          }
        },
        error: (error) => {
          if (generation !== this.appointmentGeneration) return;
          this.appointmentLoading.set(false);
          if (!silent) {
            this.appointmentError.set(
              scheduledCareErrorMessage(error, 'Impossible de charger ce rendez-vous.'),
            );
          }
        },
      });
  }

  private resyncVisibleState(): void {
    this.loadHome(true);
    this.refreshActiveRequest(true);
    this.refreshActiveAppointment(true);
    this.projectionInvalidationEpoch.update((value) => value + 1);
  }

  private commandIdentity(
    kind: CommandKind,
    resourceId: string,
    version: number,
    payload = '',
  ): string {
    return `${kind}:${resourceId}:${version}:${payload}`;
  }

  private idempotencyKey(identity: string): string {
    const existing = this.commandKeys.get(identity);
    if (existing) return existing;
    const created =
      globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    this.commandKeys.set(identity, created);
    return created;
  }
}
