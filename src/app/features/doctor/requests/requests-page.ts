import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { interval, switchMap, catchError, of } from 'rxjs';

import { ApiErrorBody } from '../../../core/auth/auth.models';

import {
  OcButton,
  OcCard,
  OcAvatar,
  OcTabs,
  OcEmptyState,
  OcStatusBadge,
  OcPageHeader,
  OcTab,
} from '../../../shared/ui';
import { DoctorUrgentApiService } from '../doctor-urgent-api.service';
import { UrgentOfferDto } from '../appointment-api.models';
import { RealtimeService } from '../../../core/realtime/realtime.service';
import { UrgentRequestDetailPanel } from '../shared/urgent-request-detail-panel';
import { PatientSummaryPanel } from '../shared/patient-summary-panel';
import { UrgentAcceptedStore } from '../urgent-accepted.store';
import { BookingRequestDetailPanel } from '../scheduled-care/booking-request-detail-panel';
import { ScheduledCareApiService } from '../scheduled-care/scheduled-care-api.service';
import { ScheduledCareFacade } from '../scheduled-care/scheduled-care.facade';
import type { DoctorScheduledCareItem } from '../scheduled-care/scheduled-care.models';
import { formatScheduledInstant } from '../scheduled-care/scheduled-care-time';

const URGENT_POLL_SAFETY_NET_MS = 120_000;
const URGENT_LATITUDE = 36.8065;
const URGENT_LONGITUDE = 10.1815;

type RequestTab = 'appointments' | 'urgent';

@Component({
  selector: 'app-requests-page',
  imports: [
    OcPageHeader, OcTabs, OcButton, OcAvatar, OcCard, OcEmptyState,
    OcStatusBadge, BookingRequestDetailPanel, UrgentRequestDetailPanel,
    PatientSummaryPanel,
  ],
  templateUrl: './requests-page.html',
  styleUrl: './requests-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestsPage {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute, { optional: true });
  private readonly scheduledCareApi = inject(ScheduledCareApiService);
  private readonly scheduledCare = inject(ScheduledCareFacade);
  private readonly urgentApi = inject(DoctorUrgentApiService);
  private readonly acceptedStore = inject(UrgentAcceptedStore);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);

  readonly requestPanel = viewChild.required<BookingRequestDetailPanel>('requestPanel');
  readonly urgentPanel = viewChild.required<UrgentRequestDetailPanel>('urgentPanel');
  readonly patientPanel = viewChild.required<PatientSummaryPanel>('patientPanel');

  readonly activeTab = signal<RequestTab>('appointments');

  readonly tabs: readonly OcTab[] = [
    { id: 'appointments', label: 'Demandes de rendez-vous' },
    { id: 'urgent', label: 'Demandes urgentes' },
  ];

  readonly appointmentRequests = signal<readonly DoctorScheduledCareItem[]>([]);
  readonly appointmentsLoading = signal(false);
  readonly appointmentsError = signal<string | null>(null);

  readonly pendingAppointments = computed(() =>
    this.appointmentRequests().filter((r) => r.status === 'PENDING_DOCTOR').length,
  );

  readonly urgentOffers = signal<readonly UrgentOfferDto[]>([]);
  readonly urgentLoading = signal(true);
  readonly urgentPolling = signal(true);
  readonly urgentError = signal<string | null>(null);
  readonly arrivingId = signal<string | null>(null);
  readonly arrivedIds = signal<Set<string>>(new Set());

  readonly pendingUrgentOffers = computed(() =>
    this.urgentOffers().filter((o) => o.status === 'PENDING'),
  );

  readonly acceptedUrgentOffers = computed(() =>
    this.urgentOffers().filter((o) => o.status === 'ACCEPTED'),
  );

  readonly pendingUrgentCount = computed(() => this.pendingUrgentOffers().length);

  constructor() {
    this.loadAppointments();
    this.startUrgentPolling();

    // WebSocket events provide responsiveness; the interval is only a safety
    // net (~2 min while realtime is healthy).
    this.realtime.urgentEvents$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.refreshUrgentOffers());
    let observedProjectionEpoch = this.scheduledCare.projectionInvalidationEpoch();
    effect(() => {
      const epoch = this.scheduledCare.projectionInvalidationEpoch();
      if (epoch === observedProjectionEpoch) return;
      observedProjectionEpoch = epoch;
      this.loadAppointments(true);
    });
    afterNextRender(() => {
      const requestId = this.route?.snapshot.queryParamMap.get('requestId');
      if (requestId) this.requestPanel().openWith(requestId);
    });
  }

  onTabChange(tabId: string): void {
    this.activeTab.set(tabId as RequestTab);
  }

  openRequestDetail(request: DoctorScheduledCareItem): void {
    if (request.requestId) this.requestPanel().openWith(request.requestId);
  }

  openUrgentDetail(offer: UrgentOfferDto): void {
    this.urgentPanel().openWith(offer);
  }

  onUrgentAccepted(offer: UrgentOfferDto): void {
    this.acceptedStore.add(offer);
    this.urgentOffers.update((offers) =>
      offers.map((o) =>
        o.offerId === offer.offerId ? { ...o, status: 'ACCEPTED' as const } : o,
      ),
    );
  }

  openPatientDetail(patientId: string): void {
    this.patientPanel().openWith(patientId);
  }

  startConsultation(isUrgent = false): void {
    if (isUrgent) {
      this.acceptedStore.offers().forEach((o) => this.acceptedStore.remove(o.offerId));
      void this.router.navigate(['/doctor', 'consultation', 'new'], {
        queryParams: { source: 'urgent' },
      });
    } else {
      void this.router.navigate(['/doctor', 'consultation', 'new']);
    }
  }

  loadAppointments(silent = false): void {
    if (!silent) this.appointmentsLoading.set(true);
    this.appointmentsError.set(null);
    const today = new Date();
    const from = new Date(today);
    from.setDate(from.getDate() - 1);
    const to = new Date(today);
    to.setDate(to.getDate() + 60);
    const fromStr = from.toISOString();
    const toStr = to.toISOString();

    this.scheduledCareApi.getDoctorScheduledCare(fromStr, toStr).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (agenda) => {
        this.appointmentRequests.set(
          agenda.items.filter((item) => item.resourceType === 'BOOKING_REQUEST'),
        );
        this.appointmentsLoading.set(false);
      },
      error: () => {
        this.appointmentsLoading.set(false);
        this.appointmentsError.set('Impossible de charger les demandes de rendez-vous.');
      },
    });
  }

  retryAppointments(): void {
    this.loadAppointments();
  }

  acceptUrgent(offer: UrgentOfferDto): void {
    this.urgentApi.accept(offer.offerId).subscribe({
      next: () => {
        this.acceptedStore.add(offer);
        this.urgentOffers.update((offers) =>
          offers.map((o) =>
            o.offerId === offer.offerId ? { ...o, status: 'ACCEPTED' as const } : o,
          ),
        );
      },
      error: () => {
        this.urgentError.set("Impossible d'accepter l'offre urgente.");
      },
    });
  }

  declineUrgent(offer: UrgentOfferDto): void {
    this.urgentApi.decline(offer.offerId).subscribe({
      next: () => {
        this.urgentOffers.update((offers) =>
          offers.map((o) =>
            o.offerId === offer.offerId ? { ...o, status: 'DECLINED' as const } : o,
          ),
        );
      },
      error: () => {
        this.urgentError.set('Impossible de refuser l\'offre urgente.');
      },
    });
  }

  arriveUrgent(offer: UrgentOfferDto): void {
    this.arrivingId.set(offer.requestId);
    this.urgentApi.arrive(offer.requestId).subscribe({
      next: () => {
        this.arrivingId.set(null);
        this.arrivedIds.update((ids) => new Set(ids).add(offer.offerId));
      },
      error: (error) => {
        this.arrivingId.set(null);
        this.urgentError.set(
          messageFrom(error, "Impossible de signaler l'arrivee. La demande n'est peut-etre pas encore confirmee par le patient."),
        );
      },
    });
  }

  hasArrived(offerId: string): boolean {
    return this.arrivedIds().has(offerId);
  }

  showDirections(offer: UrgentOfferDto): boolean {
    return offer.visitPreference === 'HOME_VISIT' || offer.visitPreference === 'EITHER';
  }

  openDirections(offer: UrgentOfferDto): void {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${offer.patientLatitude},${offer.patientLongitude}`;
    window.open(url, '_blank', 'noopener');
  }

  viewPatient(patientId: string): void {
    void this.router.navigate(['/doctor/patient', patientId]);
  }

  appointmentStatusLabel(status: string): string {
    switch (status) {
      case 'PENDING_DOCTOR': return 'Réponse attendue';
      case 'PENDING_PATIENT_TIME_CONFIRMATION': return 'Réponse patient attendue';
      case 'FULFILLED': return 'Confirmée';
      case 'CANCELLED_BY_PATIENT': return 'Annulée par le patient';
      case 'CANCELLED_BY_DOCTOR': return 'Refusée';
      case 'EXPIRED': return 'Expirée';
      default: return status;
    }
  }

  appointmentStatusOc(
    status: string,
  ): 'pending' | 'confirmed' | 'cancelled' | 'expired' {
    switch (status) {
      case 'FULFILLED': return 'confirmed';
      case 'EXPIRED': return 'expired';
      case 'CANCELLED_BY_PATIENT':
      case 'CANCELLED_BY_DOCTOR': return 'cancelled';
      default: return 'pending';
    }
  }

  offerStatusLabel(status: UrgentOfferDto['status']): string {
    if (status === 'PENDING') return 'En attente';
    if (status === 'ACCEPTED') return 'Acceptee';
    if (status === 'DECLINED') return 'Refusee';
    return 'Expiree';
  }

  offerStatusOc(status: UrgentOfferDto['status']): 'pending' | 'confirmed' | 'cancelled' | 'expired' {
    if (status === 'PENDING') return 'pending';
    if (status === 'ACCEPTED') return 'confirmed';
    if (status === 'DECLINED') return 'cancelled';
    return 'expired';
  }

  incomingDistance(offer: UrgentOfferDto): string {
    const earthRadiusKm = 6371;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(offer.patientLatitude - URGENT_LATITUDE);
    const dLng = toRad(offer.patientLongitude - URGENT_LONGITUDE);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(URGENT_LATITUDE)) *
        Math.cos(toRad(offer.patientLatitude)) *
        Math.sin(dLng / 2) ** 2;
    const km = 2 * earthRadiusKm * Math.asin(Math.sqrt(a));
    return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
  }

  incomingLocation(offer: UrgentOfferDto): string {
    switch (offer.visitPreference) {
      case 'HOME_VISIT':
        return 'A domicile';
      case 'CABINET_VISIT':
        return 'Au cabinet';
      case 'EITHER':
        return 'Domicile ou cabinet';
      default:
        return 'Position patient';
    }
  }

  trackByAppointmentId(_index: number, request: DoctorScheduledCareItem): string {
    return request.requestId ?? `${request.resourceType}:${request.sortAt}`;
  }

  scheduledTime(request: DoctorScheduledCareItem): string {
    return formatScheduledInstant(request.start, request.timezone, { year: undefined });
  }

  trackByOfferId(_index: number, offer: UrgentOfferDto): string {
    return offer.offerId;
  }

  retryUrgent(): void {
    this.urgentError.set(null);
    this.refreshUrgentOffers();
  }

  private startUrgentPolling(): void {
    this.urgentLoading.set(true);
    interval(URGENT_POLL_SAFETY_NET_MS)
      .pipe(
        switchMap(() =>
          this.urgentApi.incoming().pipe(catchError(() => of([] as readonly UrgentOfferDto[]))),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((offers) => {
        this.mergeIncomingOffers(offers);
        this.urgentLoading.set(false);
        this.urgentPolling.set(true);
      });

    this.refreshUrgentOffers();
  }

  private refreshUrgentOffers(): void {
    this.urgentApi.incoming().subscribe({
      next: (offers) => {
        this.mergeIncomingOffers(offers);
        this.urgentLoading.set(false);
      },
      error: () => {
        this.urgentLoading.set(false);
        this.urgentError.set('Impossible de recuperer les demandes urgentes.');
      },
    });
  }

  private mergeIncomingOffers(incoming: readonly UrgentOfferDto[]): void {
    this.urgentOffers.update((current) => {
      const freshAccepted = incoming.filter((o) => o.status === 'ACCEPTED');
      const optimisticAccepted = current.filter(
        (o) =>
          o.status === 'ACCEPTED' &&
          !freshAccepted.some((a) => a.offerId === o.offerId),
      );
      const pending = incoming.filter((o) => o.status === 'PENDING');
      return [...freshAccepted, ...optimisticAccepted, ...pending];
    });
  }
}

function messageFrom(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse) {
    const body = error.error as ApiErrorBody | null;
    return body?.message ?? fallback;
  }
  return fallback;
}
