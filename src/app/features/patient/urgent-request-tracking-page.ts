import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  model,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, interval } from 'rxjs';

import { ApiErrorBody } from '../../core/auth/auth.models';
import {
  RealtimeService,
  type DoctorLocationUpdateData,
  type RequestIdData,
} from '../../core/realtime/realtime.service';
import { OcButton, OcConfirmDialog } from '../../shared/ui';
import { AcceptedOfferSummaryDto, UrgentRequestDto } from './patient-api.models';
import { PatientApiService } from './patient-api.service';

const TRACKING_POLL_FAST_MS = 7_000;
const TRACKING_POLL_SAFETY_NET_MS = 120_000;
const EARTH_RADIUS_KM = 6371;

interface LiveDoctorPosition {
  readonly latitude: number;
  readonly longitude: number;
  readonly updatedAt: number;
}

@Component({
  selector: 'app-urgent-request-tracking-page',
  imports: [OcButton, OcConfirmDialog],
  templateUrl: './urgent-request-tracking-page.html',
  styleUrl: './urgent-request-tracking-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UrgentRequestTrackingPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(PatientApiService);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);
  readonly requestId = this.route.snapshot.paramMap.get('id') ?? '';
  private pollStarted = false;

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly request = signal<UrgentRequestDto | null>(null);
  readonly offers = signal<readonly AcceptedOfferSummaryDto[]>([]);
  readonly livePosition = signal<LiveDoctorPosition | null>(null);

  readonly cancelOpen = model(false);
  readonly cancelling = signal(false);
  /** Set when the backend rejects a cancel (409) - the button stays disabled. */
  readonly cancelUnavailable = signal(false);
  readonly cancelError = signal<string | null>(null);

  readonly doctorName = computed<string | null>(() => this.offers()[0]?.doctorName ?? null);
  readonly distanceKm = computed(() => this.offers()[0]?.distanceKm ?? null);
  readonly acceptedLabel = computed(() =>
    timestampLabel(this.offers()[0]?.acceptedAt ?? null),
  );
  readonly cabinetVisit = computed(() => this.request()?.visitPreference === 'CABINET_VISIT');
  readonly arrived = computed(() => this.request()?.status === 'ARRIVED');
  readonly cancellable = computed(
    () =>
      !this.cancelUnavailable() &&
      (this.request()?.status === 'PENDING' || this.request()?.status === 'MATCHED'),
  );

  private readonly expectingLiveUpdates = computed(
    () => this.request()?.status === 'MATCHED' && !this.cabinetVisit(),
  );
  private readonly health = this.realtime.health(this.expectingLiveUpdates);

  ngOnInit(): void {
    this.load();
    this.realtime.urgentEvents$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => this.onLiveEvent(event));
  }

  backToUrgent(): void {
    void this.router.navigate(['/patient'], { queryParams: { tab: 'urgent' } });
  }

  visitLabel(): string {
    switch (this.request()?.visitPreference) {
      case 'HOME_VISIT':
        return 'Visite a domicile';
      case 'CABINET_VISIT':
        return 'Consultation au cabinet';
      case 'EITHER':
        return 'Domicile ou cabinet';
      default:
        return 'Non renseignee';
    }
  }

  distanceLabel(): string {
    const live = this.liveDistanceKm();
    if (live !== null) {
      return `${live.toLocaleString('fr-FR')} km`;
    }
    const distanceKm = this.distanceKm();
    if (distanceKm === null) return 'Position du medecin en cours de mise a jour';
    return `${distanceKm.toLocaleString('fr-FR')} km`;
  }

  liveDistanceKm(): number | null {
    const position = this.livePosition();
    const request = this.request();
    if (!position || !request) return null;
    return haversineKm(
      request.patientLatitude,
      request.patientLongitude,
      position.latitude,
      position.longitude,
    );
  }

  openDirections(): void {
    const position = this.livePosition();
    if (!position) return;
    const url =
      `https://www.google.com/maps/dir/?api=1&destination=` +
      `${position.latitude},${position.longitude}`;
    globalThis.open(url, '_blank', 'noopener');
  }

  positionUpdatedAtLabel(): string {
    const position = this.livePosition();
    if (!position) return '';
    const when = new Date(position.updatedAt);
    if (Number.isNaN(when.getTime())) return '';
    return new Intl.DateTimeFormat('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(when);
  }

  matchedAtLabel(): string {
    return timestampLabel(this.request()?.matchedAt ?? null);
  }

  arrivedAtLabel(): string {
    return timestampLabel(this.request()?.arrivedAt ?? null);
  }

  openCancelDialog(): void {
    this.cancelError.set(null);
    this.cancelOpen.set(true);
  }

  confirmCancel(): void {
    if (this.cancelling()) return;
    this.cancelling.set(true);
    this.cancelError.set(null);
    this.api
      .cancelUrgentRequest(this.requestId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.cancelling.set(false);
          this.cancelOpen.set(false);
          this.request.set(updated);
        },
        error: (error: unknown) => {
          this.cancelling.set(false);
          if (error instanceof HttpErrorResponse && error.status === 409) {
            this.cancelOpen.set(false);
            this.cancelUnavailable.set(true);
            return;
          }
          this.cancelError.set(messageFrom(error, "Impossible d'annuler la demande."));
        },
      });
  }

  private onLiveEvent(event: {
    name: string;
    data: RequestIdData | DoctorLocationUpdateData | Record<string, unknown>;
  }): void {
    const data = event.data as Partial<RequestIdData & DoctorLocationUpdateData>;
    switch (event.name) {
      case 'DOCTOR_LOCATION_UPDATE': {
        if (
          data.requestId !== this.requestId ||
          typeof data.latitude !== 'number' ||
          typeof data.longitude !== 'number'
        ) {
          return;
        }
        this.livePosition.set({
          latitude: data.latitude,
          longitude: data.longitude,
          updatedAt: Date.now(),
        });
        return;
      }
      case 'REQUEST_MATCHED':
      case 'OFFER_ACCEPTED':
      case 'DOCTOR_ARRIVED':
      case 'REQUEST_EXPIRED':
      case 'REQUEST_CANCELLED': {
        if (data.requestId !== this.requestId) return;
        this.refresh();
        return;
      }
      default:
        return;
    }
  }

  private load(): void {
    this.error.set(null);
    forkJoin({
      request: this.api.urgentRequest(this.requestId),
      offers: this.api.urgentOffers(this.requestId),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ request, offers }) => {
          this.loading.set(false);
          this.request.set(request);
          this.offers.set(offers);
          this.maybeStartPolling();
        },
        error: (error) => {
          this.loading.set(false);
          this.error.set(messageFrom(error, 'Impossible de charger le suivi de la demande.'));
        },
      });
  }

  private refresh(): void {
    if (this.arrived()) return;
    forkJoin({
      request: this.api.urgentRequest(this.requestId),
      offers: this.api.urgentOffers(this.requestId),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ request, offers }) => {
          this.request.set(request);
          this.offers.set(offers);
        },
        error: () => undefined,
      });
  }

  /**
   * WebSocket events provide responsiveness; REST polling is only the safety
   * net (~2 min while the realtime link is healthy, fast again when it is
   * degraded or down).
   */
  private maybeStartPolling(): void {
    if (this.pollStarted) return;
    this.pollStarted = true;
    interval(TRACKING_POLL_SAFETY_NET_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.health() !== 'live') {
          this.refresh();
        }
      });
    interval(TRACKING_POLL_FAST_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.health() === 'down' && this.expectingLiveUpdates()) {
          this.refresh();
        }
      });
  }
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return Math.round(2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a)) * 10) / 10;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function timestampLabel(value: string | null | undefined): string {
  if (!value) return '';
  const when = new Date(value);
  if (Number.isNaN(when.getTime())) return '';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(when);
}

function messageFrom(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse) {
    const body = error.error as ApiErrorBody | null;
    return body?.message ?? fallback;
  }
  return fallback;
}
