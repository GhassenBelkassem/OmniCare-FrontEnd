import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { forkJoin, interval, of } from 'rxjs';
import { catchError, filter } from 'rxjs/operators';

import { AuthTokenStore } from '../../core/auth/auth-token.store';
import { RealtimeService } from '../../core/realtime/realtime.service';
import { UrgentLiveEvent } from '../../core/realtime/live-event.models';
import {
  OcAvatar,
  OcButton,
  OcIcon,
  OcPopover,
  OcSheet,
  OcSidebar,
  SidebarLabels,
  SidebarNavigationItem,
  SidebarUserProfile,
} from '../../shared/ui';
import { AppointmentApiService } from './appointment-api.service';
import { DoctorNotificationApiService } from './doctor-notification-api.service';
import { DoctorUrgentApiService } from './doctor-urgent-api.service';
import { ActiveMatchedRequestStore } from './active-matched-request.store';
import { DoctorLocationPushService } from './doctor-location-push.service';
import { PatientLookupDialog } from './patient-lookup-dialog';
import { MockPatientMatch } from './doctor-mock.models';
import { DoctorMockService } from './doctor-mock.service';
import { NotificationItemDto, UrgentOfferDto } from './appointment-api.models';
import { UrgentRequestSummaryDto } from './doctor-urgent-api.service';

import { UrgentAcceptedStore } from './urgent-accepted.store';

const DOCTOR_POLL_SAFETY_NET_MS = 120_000;
const URGENT_OFFER_TTL_SECONDS = 120;
const URGENT_LATITUDE = 36.8065;
const URGENT_LONGITUDE = 10.1815;
const URGENT_LOCATION_LABEL = 'Tunis, Tunisie - 36.8065, 10.1815';
const DOCTOR_SIDEBAR_LABELS: Partial<SidebarLabels> = {
  landmark: 'Navigation principale du médecin',
  workspace: 'Espace clinique',
  navigation: 'Espace médecin',
  noResults: 'Aucune navigation ne correspond à',
  signOut: 'Se déconnecter',
  expand: 'Développer la navigation',
  collapse: 'Réduire la navigation',
};

@Component({
  selector: 'app-doctor-shell',
  imports: [
    RouterOutlet,
    NzIconModule,
    OcAvatar,
    OcButton,
    OcIcon,
    OcPopover,
    OcSheet,
    OcSidebar,
    PatientLookupDialog,
  ],
  templateUrl: './doctor-shell.html',
  styleUrl: './doctor-shell.scss',
  host: {
    '(document:visibilitychange)': 'onVisibilityChange()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DoctorShell {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly mock = inject(DoctorMockService);
  private readonly urgentApi = inject(DoctorUrgentApiService);
  private readonly notificationApi = inject(DoctorNotificationApiService);
  private readonly tokens = inject(AuthTokenStore);
  private readonly acceptedStore = inject(UrgentAcceptedStore);
  private readonly realtime = inject(RealtimeService);
  private readonly matchedRequests = inject(ActiveMatchedRequestStore);
  private readonly locationPush = inject(DoctorLocationPushService);
  private readonly destroyRef = inject(DestroyRef);
  private offerCountdownTimer: ReturnType<typeof setInterval> | null = null;

  readonly sidebarCollapsed = signal(false);
  readonly mobileNavigationOpen = signal(false);
  readonly lookupOpen = signal(false);

  readonly urgentToggleSaving = signal(false);
  readonly urgentToggleError = signal<string | null>(null);
  readonly acceptsHomeVisits = signal(false);
  readonly acceptsCabinetVisits = signal(false);
  readonly emergencyAvailable = computed(
    () => this.acceptsHomeVisits() || this.acceptsCabinetVisits(),
  );
  readonly emergencyLocation = signal<string | null>(null);
  readonly incomingOffer = signal<UrgentOfferDto | null>(null);
  readonly incomingOfferCountdown = signal(0);
  readonly incomingOfferLoading = signal(false);
  readonly incomingOfferError = signal<string | null>(null);

  readonly notificationUnread = signal(0);
  readonly notifications = signal<readonly NotificationItemDto[]>([]);
  readonly notificationPanelOpen = signal(false);
  readonly notificationLoading = signal(false);
  readonly notificationError = signal<string | null>(null);
  readonly notificationUpdating = signal(false);
  readonly notificationPage = signal(0);
  readonly notificationTotal = signal(0);
  readonly notificationLoadingMore = signal(false);
  readonly notificationTriggerLabel = computed(() => {
    const unread = this.notificationUnread();
    return unread > 0 ? `Notifications, ${unread} non lues` : 'Notifications';
  });

  readonly activeNav = signal('command');

  /** Live connection health, shown as a chip in the topbar. */
  readonly expectsRealtimeActivity = computed(
    () => this.emergencyAvailable() || this.matchedRequests.hasActive(),
  );
  readonly realtimeHealth = this.realtime.health(this.expectsRealtimeActivity);
  readonly realtimeLabel = computed(() => {
    switch (this.realtimeHealth()) {
      case 'live':
        return 'Connexion temps réel active';
      case 'stale':
        return 'Connexion temps réel en cours de rétablissement';
      default:
        return 'Connexion temps réel indisponible';
    }
  });

  readonly navigation: readonly SidebarNavigationItem[] = [
    {
      id: 'daily-work',
      label: 'Activité clinique',
      icon: 'workspace',
      children: [
        { id: 'command', label: 'Accueil', icon: 'workspace', route: '/doctor/command' },
        { id: 'patients', label: 'Mes patients', icon: 'staff', route: '/doctor/patients' },
        { id: 'calendar', label: 'Calendrier', icon: 'calendar', route: '/doctor/calendar' },
        {
          id: 'waiting-room',
          label: 'Salle d’attente',
          icon: 'waiting',
          route: '/doctor/waiting-room',
        },
        {
          id: 'consultation',
          label: 'Consultation',
          icon: 'clinical',
          route: '/doctor/consultation/new',
        },
      ],
    },
    {
      id: 'clinical-follow-up',
      label: 'Suivi clinique',
      icon: 'tasks',
      children: [
        {
          id: 'prescriptions',
          label: 'Prescriptions',
          icon: 'prescription',
          route: '/doctor/prescriptions',
        },
        {
          id: 'results',
          label: 'Résultats et suivi',
          icon: 'results',
          route: '/doctor/results',
        },
        { id: 'requests', label: 'Demandes', icon: 'requests', route: '/doctor/requests' },
      ],
    },
    {
      id: 'urgent-readiness',
      label: 'Préparation urgences',
      icon: 'emergency',
      route: '/doctor/urgent-readiness',
    },
    {
      id: 'management',
      label: 'Pilotage',
      icon: 'settings',
      children: [
        { id: 'analytics', label: 'Analyses', icon: 'analytics', route: '/doctor/analytics' },
        { id: 'settings', label: 'Paramètres', icon: 'settings', route: '/doctor/settings' },
      ],
    },
  ];
  readonly sidebarLabels = DOCTOR_SIDEBAR_LABELS;
  readonly expandedNavigationGroups = computed(
    () =>
      new Set(
        this.navigation
          .filter((item) => item.children?.some((child) => child.id === this.activeNav()))
          .map((item) => item.id),
      ),
  );

  readonly sidebarProfile: SidebarUserProfile = {
    initials: 'BS',
    name: 'Dr Ben Salah',
    context: 'Médecine générale',
  };

  constructor() {
    this.syncActiveNavigation(this.router.url);
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => this.syncActiveNavigation(event.urlAfterRedirects));
    this.loadUrgentStatus();
    this.hydrateMatchedRequests();
    this.refreshUnreadCount();
    // The interval is an urgent-offer safety net only. Notification freshness
    // is REST-on-login plus private realtime invalidation/reconnect/tab resync.
    interval(DOCTOR_POLL_SAFETY_NET_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.pollTick());
    this.realtime.urgentEvents$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => this.onUrgentEvent(event));
    this.realtime.notificationEvents$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.refreshUnreadCount();
      if (this.notificationPanelOpen()) this.loadNotifications(true);
    });
    this.destroyRef.onDestroy(() => {
      if (this.offerCountdownTimer) clearInterval(this.offerCountdownTimer);
    });
    let observedConnectionEpoch = this.realtime.connectionEpoch();
    effect(() => {
      const epoch = this.realtime.connectionEpoch();
      if (epoch === observedConnectionEpoch) return;
      observedConnectionEpoch = epoch;
      this.refreshUnreadCount();
      if (this.notificationPanelOpen()) this.loadNotifications(true);
    });
  }

  private syncActiveNavigation(url: string): void {
    const path = url.split(/[?#]/, 1)[0];
    const segment = path.split('/').filter(Boolean)[1] ?? 'command';
    const id = segment === 'patient' ? 'patients' : segment;
    if (
      this.navigation.some(
        (item) => item.id === id || item.children?.some((child) => child.id === id),
      )
    ) {
      this.activeNav.set(id);
    }
  }

  private onUrgentEvent(event: UrgentLiveEvent): void {
    switch (event.name) {
      case 'NEW_OFFER':
      case 'OFFER_ACCEPTED':
        this.refreshIncoming();
        break;
      case 'REQUEST_MATCHED':
        this.matchedRequests.markMatched(event.data.requestId);
        break;
      case 'REQUEST_CANCELLED':
      case 'REQUEST_EXPIRED':
        this.matchedRequests.markClosed(event.data.requestId);
        break;
      default:
        break;
    }
  }

  /** REST hydration of MATCHED requests (covers events missed while offline). */
  private hydrateMatchedRequests(): void {
    const offers = this.acceptedStore.offers();
    if (!offers.length) return;
    forkJoin(
      offers.map((offer) =>
        this.urgentApi.request(offer.requestId).pipe(catchError(() => of(null))),
      ),
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((summaries) => {
        const matched = summaries
          .filter((s): s is UrgentRequestSummaryDto => s !== null && s.status === 'MATCHED')
          .map((s) => s.id);
        this.matchedRequests.reset(matched);
      });
  }

  private pollTick(): void {
    if (this.emergencyAvailable()) this.refreshIncoming();
  }

  onVisibilityChange(): void {
    if (document.visibilityState !== 'visible') return;
    this.refreshUnreadCount();
    if (this.notificationPanelOpen()) this.loadNotifications(true);
  }

  openLookup(): void {
    this.lookupOpen.set(true);
  }

  closeLookup(): void {
    this.lookupOpen.set(false);
  }

  lookupSelected(match: MockPatientMatch): void {
    this.lookupOpen.set(false);
    const consultationId = this.mock.consultationIdForPatient(match.id);
    void this.router.navigate(['/doctor', 'consultation', consultationId], {
      queryParams: { source: 'manual' },
    });
  }

  toggleEmergency(): void {
    if (this.urgentToggleSaving()) return;
    const next = !this.emergencyAvailable();
    this.urgentToggleSaving.set(true);
    this.urgentToggleError.set(null);
    this.urgentApi
      .toggle({
        acceptsHomeVisits: next,
        acceptsCabinetVisits: next,
        currentLatitude: URGENT_LATITUDE,
        currentLongitude: URGENT_LONGITUDE,
      })
      .subscribe({
        next: (status) => {
          this.urgentToggleSaving.set(false);
          this.acceptsHomeVisits.set(status.acceptsHomeVisits);
          this.acceptsCabinetVisits.set(status.acceptsCabinetVisits);
          this.emergencyLocation.set(status.availableForUrgent ? URGENT_LOCATION_LABEL : null);
          if (status.availableForUrgent) this.refreshIncoming();
        },
        error: () => {
          this.urgentToggleSaving.set(false);
          this.urgentToggleError.set('Impossible de mettre a jour votre disponibilite urgente.');
        },
      });
  }

  loadUrgentStatus(): void {
    this.urgentApi.getStatus().subscribe({
      next: (status) => {
        this.acceptsHomeVisits.set(status.acceptsHomeVisits);
        this.acceptsCabinetVisits.set(status.acceptsCabinetVisits);
        this.emergencyLocation.set(status.availableForUrgent ? URGENT_LOCATION_LABEL : null);
        if (status.availableForUrgent) this.refreshIncoming();
      },
      error: () => {},
    });
  }

  refreshIncoming(): void {
    this.incomingOfferError.set(null);
    if (!this.incomingOffer()) this.incomingOfferLoading.set(true);
    this.urgentApi.incoming().subscribe({
      next: (offers) => {
        this.incomingOfferLoading.set(false);
        const pending = offers.find((o) => o.status === 'PENDING') ?? null;
        if (pending) {
          this.incomingOffer.set(pending);
          this.startOfferCountdown(pending);
        } else {
          this.clearIncomingOffer();
        }
      },
      error: () => {
        this.incomingOfferLoading.set(false);
        this.incomingOfferError.set('Impossible de recuperer les demandes urgentes entrantes.');
      },
    });
  }

  private startOfferCountdown(offer: UrgentOfferDto): void {
    this.stopOfferCountdown();
    const deadline = new Date(offer.sentAt).getTime() + URGENT_OFFER_TTL_SECONDS * 1000;
    const update = (): void => {
      const remaining = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      this.incomingOfferCountdown.set(remaining);
      if (remaining <= 0) this.clearIncomingOffer();
    };
    update();
    this.offerCountdownTimer = setInterval(update, 1000);
  }

  private stopOfferCountdown(): void {
    if (this.offerCountdownTimer) clearInterval(this.offerCountdownTimer);
    this.offerCountdownTimer = null;
  }

  private clearIncomingOffer(): void {
    this.stopOfferCountdown();
    this.incomingOffer.set(null);
    this.incomingOfferCountdown.set(0);
  }

  acceptUrgent(): void {
    const offer = this.incomingOffer();
    if (!offer) return;
    this.urgentApi.accept(offer.offerId).subscribe({
      next: () => {
        this.acceptedStore.add(offer);
        this.clearIncomingOffer();
        this.refreshIncoming();
      },
      error: () => {
        this.incomingOfferError.set("Impossible d'accepter la demande urgente.");
      },
    });
  }

  declineUrgent(): void {
    const offer = this.incomingOffer();
    if (!offer) return;
    this.urgentApi.decline(offer.offerId).subscribe({
      next: () => {
        this.clearIncomingOffer();
        this.refreshIncoming();
      },
      error: () => {
        this.incomingOfferError.set('Impossible de refuser la demande urgente.');
      },
    });
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

  refreshUnreadCount(): void {
    this.notificationApi.unreadCount().subscribe({
      next: (response) => this.notificationUnread.set(response.unreadCount),
      error: () => {},
    });
  }

  setNotificationPanelOpen(open: boolean): void {
    if (open === this.notificationPanelOpen()) return;
    this.notificationPanelOpen.set(open);
    if (open) this.loadNotifications();
  }

  closeNotificationPanel(): void {
    this.notificationPanelOpen.set(false);
  }

  loadNotifications(silent = false): void {
    if (!silent) this.notificationLoading.set(true);
    this.notificationError.set(null);
    this.notificationApi.list(0, 20).subscribe({
      next: (response) => {
        this.notificationLoading.set(false);
        this.notifications.set(response.items);
        this.notificationUnread.set(response.unreadCount);
        this.notificationPage.set(response.page);
        this.notificationTotal.set(response.totalElements);
      },
      error: () => {
        this.notificationLoading.set(false);
        this.notificationError.set('Impossible de charger les notifications.');
      },
    });
  }

  loadMoreNotifications(): void {
    if (this.notificationLoadingMore() || this.notifications().length >= this.notificationTotal())
      return;
    this.notificationLoadingMore.set(true);
    const page = this.notificationPage() + 1;
    this.notificationApi.list(page, 20).subscribe({
      next: (response) => {
        const known = new Set(this.notifications().map((item) => item.id));
        this.notifications.update((items) => [
          ...items,
          ...response.items.filter((item) => !known.has(item.id)),
        ]);
        this.notificationPage.set(response.page);
        this.notificationTotal.set(response.totalElements);
        this.notificationUnread.set(response.unreadCount);
        this.notificationLoadingMore.set(false);
      },
      error: () => {
        this.notificationLoadingMore.set(false);
        this.notificationError.set('Impossible de charger plus de notifications.');
      },
    });
  }

  markNotificationRead(id: string): void {
    this.notificationApi.markRead(id).subscribe({
      next: () => {
        this.notifications.update((items) =>
          items.map((item) => (item.id === id ? { ...item, read: true } : item)),
        );
        this.refreshUnreadCount();
      },
      error: () => {},
    });
  }

  openNotification(item: NotificationItemDto): void {
    if (!item.read) {
      this.notifications.update((items) =>
        items.map((candidate) =>
          candidate.id === item.id ? { ...candidate, read: true } : candidate,
        ),
      );
      this.notificationUnread.update((count) => Math.max(0, count - 1));
      this.notificationApi.markRead(item.id).subscribe({
        error: () => this.refreshUnreadCount(),
      });
    }
    const target = notificationTarget(item);
    if (target === null) return;
    this.closeNotificationPanel();
    if (target.kind === 'request') {
      void this.router.navigate(['/doctor/requests'], { queryParams: { requestId: target.id } });
    } else {
      void this.router.navigate(['/doctor/calendar'], {
        queryParams: { appointmentId: target.id },
      });
    }
  }

  markAllNotificationsRead(): void {
    this.notificationUpdating.set(true);
    this.notificationApi.markAllRead().subscribe({
      next: () => {
        this.notificationUpdating.set(false);
        this.notifications.update((items) => items.map((item) => ({ ...item, read: true })));
        this.refreshUnreadCount();
      },
      error: () => {
        this.notificationUpdating.set(false);
      },
    });
  }

  formatNotificationTime(createdAt: string): string {
    const when = new Date(createdAt);
    if (Number.isNaN(when.getTime())) return '';
    const elapsed = Math.max(0, Date.now() - when.getTime());
    const minutes = Math.floor(elapsed / 60_000);
    if (minutes < 1) return "À l'instant";
    if (minutes < 60) return `Il y a ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Il y a ${hours} h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `Il y a ${days} j`;
    return when.toLocaleDateString('fr-FR');
  }
}

export type NotificationTarget = { readonly kind: 'request' | 'appointment'; readonly id: string };

export function notificationTarget(item: NotificationItemDto): NotificationTarget | null {
  const requestId = item.deepLinkPayload?.request_id;
  const appointmentId = item.deepLinkPayload?.appointment_id;
  switch (item.type) {
    case 'DOCTOR_BOOKING_PROPOSAL_ACCEPTED':
    case 'APPOINTMENT_CONFIRMED':
    case 'APPOINTMENT_CANCELLED_BY_PATIENT':
    case 'APPOINTMENT_CANCELLED_BY_PROFESSIONAL':
      return nonEmpty(appointmentId) ? { kind: 'appointment', id: appointmentId } : null;
    case 'DOCTOR_BOOKING_REQUEST_CREATED':
    case 'DOCTOR_BOOKING_TIME_PROPOSED':
    case 'DOCTOR_BOOKING_REQUEST_DECLINED':
    case 'DOCTOR_BOOKING_REQUEST_CANCELLED_BY_PATIENT':
    case 'DOCTOR_BOOKING_PROPOSAL_DECLINED':
    case 'DOCTOR_BOOKING_REQUEST_EXPIRED':
      return nonEmpty(requestId) ? { kind: 'request', id: requestId } : null;
    default:
      return null;
  }
}

function nonEmpty(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
