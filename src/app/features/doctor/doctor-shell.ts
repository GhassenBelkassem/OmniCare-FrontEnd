import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { filter, forkJoin, interval, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { AuthTokenStore } from '../../core/auth/auth-token.store';
import { RealtimeService } from '../../core/realtime/realtime.service';
import { UrgentLiveEvent } from '../../core/realtime/live-event.models';
import {
  OcAvatar,
  OcButton,
  OcTabs,
  OcTab,
  OcSidebar,
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

/**
 * `Mon equipe` deliberately sits next to `Parametres` rather than beside
 * `Mes Patients`: both entries are about people, and separating them keeps the
 * new `solution` icon from reading as a second "Mes Patients".
 */
const DOCTOR_NAVIGATION: readonly SidebarNavigationItem[] = [
  { id: 'command', label: 'Accueil', icon: 'dashboard', route: '/doctor/command' },
  { id: 'patients', label: 'Mes Patients', icon: 'team', route: '/doctor/patients' },
  { id: 'calendar', label: 'Calendrier', icon: 'calendar', route: '/doctor/calendar' },
  { id: 'waiting-room', label: "Salle d'attente", icon: 'clock-circle', route: '/doctor/waiting-room' },
  { id: 'consultation', label: 'Consultation', icon: 'medicine-box', route: '/doctor/consultation/new' },
  { id: 'prescriptions', label: 'Prescriptions', icon: 'file-text', route: '/doctor/prescriptions' },
  { id: 'results', label: 'Resultats & Suivi', icon: 'check-circle', route: '/doctor/results' },
  { id: 'requests', label: 'Demandes', icon: 'notification', route: '/doctor/requests', badge: 2 },
  { id: 'communication', label: 'Communication', icon: 'message', route: '/doctor/communication' },
  { id: 'history', label: 'Historique', icon: 'history', route: '/doctor/history' },
  { id: 'billing', label: 'Facturation', icon: 'account-book', route: '/doctor/billing' },
  { id: 'analytics', label: 'Analyses', icon: 'bar-chart', route: '/doctor/analytics' },
  { id: 'team', label: 'Mon equipe', icon: 'solution', route: '/doctor/team' },
  { id: 'settings', label: 'Parametres', icon: 'setting', route: '/doctor/settings' },
];

/**
 * A secretary is delegated the agenda and nothing else. The remaining
 * destinations stay out of the shell rather than being rendered and refused,
 * and `doctor.routes.ts` independently rejects them on direct navigation.
 */
const SECRETARY_NAVIGATION: readonly SidebarNavigationItem[] = [
  { id: 'secretary-agenda', label: 'Agenda', icon: 'calendar', route: '/doctor/secretary-agenda' },
];

const DOCTOR_TABS: readonly OcTab[] = [
  { id: 'command', label: 'Accueil', icon: 'dashboard', route: '/doctor/command' },
  { id: 'patients', label: 'Mes Patients', icon: 'team', route: '/doctor/patients' },
  { id: 'calendar', label: 'Calendrier', icon: 'calendar', route: '/doctor/calendar' },
  { id: 'waiting-room', label: "Salle d'attente", icon: 'clock-circle', route: '/doctor/waiting-room' },
  { id: 'prescriptions', label: 'Prescriptions', icon: 'file-text', route: '/doctor/prescriptions' },
  { id: 'results', label: 'Resultats', icon: 'check-circle', route: '/doctor/results' },
  { id: 'requests', label: 'Demandes', icon: 'notification', route: '/doctor/requests' },
  { id: 'communication', label: 'Messages', icon: 'message', route: '/doctor/communication' },
  { id: 'history', label: 'Historique', icon: 'history', route: '/doctor/history' },
  { id: 'billing', label: 'Facturation', icon: 'account-book', route: '/doctor/billing' },
  { id: 'analytics', label: 'Analyses', icon: 'bar-chart', route: '/doctor/analytics' },
  { id: 'team', label: 'Mon equipe', icon: 'solution', route: '/doctor/team' },
  { id: 'settings', label: 'Parametres', icon: 'setting', route: '/doctor/settings' },
];

const SECRETARY_TABS: readonly OcTab[] = [
  { id: 'secretary-agenda', label: 'Agenda', icon: 'calendar', route: '/doctor/secretary-agenda' },
];

/** URL segments whose navigation id differs from the path segment. */
const NAV_SEGMENT_ALIASES: Readonly<Record<string, string>> = {
  patient: 'patients',
  consultation: 'consultation',
};

@Component({
  selector: 'app-doctor-shell',
  imports: [RouterOutlet, NzIconModule, OcAvatar, OcButton, OcTabs, OcSidebar, PatientLookupDialog],
  templateUrl: './doctor-shell.html',
  styleUrl: './doctor-shell.scss',
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
  readonly lookupOpen = signal(false);

  readonly urgentToggleSaving = signal(false);
  readonly urgentToggleError = signal<string | null>(null);
  readonly acceptsHomeVisits = signal(false);
  readonly acceptsCabinetVisits = signal(false);
  readonly emergencyAvailable = computed(() => this.acceptsHomeVisits() || this.acceptsCabinetVisits());
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

  readonly activeNav = signal('command');
  readonly activeTabId = signal('command');

  /**
   * A SECRETARY is a delegated, non-clinical collaborator in this workspace.
   * Several shell affordances (patient lookup, urgent-care availability,
   * doctor notifications) are backed by doctor-only endpoints, so they are
   * gated rather than left to fail with a 403.
   */
  readonly isSecretary = computed(() => this.tokens.user()?.role === 'SECRETARY');

  readonly navigation: readonly SidebarNavigationItem[] = this.isSecretary()
    ? SECRETARY_NAVIGATION
    : DOCTOR_NAVIGATION;

  readonly tabs: readonly OcTab[] = this.isSecretary() ? SECRETARY_TABS : DOCTOR_TABS;

  /**
   * The doctor workspace is seeded with placeholder identity data. A secretary
   * must not be shown the doctor's name, so fall back to their actual role.
   */
  readonly sidebarProfile = computed<SidebarUserProfile>(() =>
    this.isSecretary()
      ? { initials: 'SC', name: 'Secretaire', context: 'Agenda du cabinet' }
      : { initials: 'BS', name: 'Dr Ben Salah', context: 'Medecine generale' },
  );

  readonly displayName = computed(() => this.sidebarProfile().name);

  /** Live connection health, shown as a chip in the topbar. */
  readonly expectsRealtimeActivity = computed(
    () => this.emergencyAvailable() || this.matchedRequests.hasActive(),
  );
  readonly realtimeHealth = this.realtime.health(this.expectsRealtimeActivity);
  readonly realtimeLabel = computed(() => {
    switch (this.realtimeHealth()) {
      case 'live': return 'Temps reel actif';
      case 'stale': return 'Reconnexion...';
      default: return 'MAJ indisponibles';
    }
  });

  constructor() {
    if (!this.isSecretary()) {
      this.loadUrgentStatus();
      this.hydrateMatchedRequests();
      this.refreshUnreadCount();
      // WebSocket events drive responsiveness; the interval is only a safety
      // net (~2 min while realtime is healthy).
      interval(DOCTOR_POLL_SAFETY_NET_MS)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => this.pollTick());
      this.realtime.urgentEvents$
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((event) => this.onUrgentEvent(event));
    }
    this.destroyRef.onDestroy(() => {
      if (this.offerCountdownTimer) clearInterval(this.offerCountdownTimer);
    });
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.syncActiveNav());
    this.syncActiveNav();
  }

  /** Keeps the sidebar highlight in step with the URL. */
  private syncActiveNav(): void {
    const segments = this.router.url.split(/[?#]/)[0].split('/');
    const segment = segments[2] ?? '';
    const id = segment === '' ? (this.navigation[0]?.id ?? '') : NAV_SEGMENT_ALIASES[segment] ?? segment;
    this.activeNav.set(id);
    this.activeTabId.set(id);
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
    this.refreshUnreadCount();
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
    this.urgentApi.toggle({
      acceptsHomeVisits: next,
      acceptsCabinetVisits: next,
      currentLatitude: URGENT_LATITUDE,
      currentLongitude: URGENT_LONGITUDE,
    }).subscribe({
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
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(URGENT_LATITUDE)) * Math.cos(toRad(offer.patientLatitude)) * Math.sin(dLng / 2) ** 2;
    const km = 2 * earthRadiusKm * Math.asin(Math.sqrt(a));
    return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
  }

  incomingLocation(offer: UrgentOfferDto): string {
    switch (offer.visitPreference) {
      case 'HOME_VISIT': return 'A domicile';
      case 'CABINET_VISIT': return 'Au cabinet';
      case 'EITHER': return 'Domicile ou cabinet';
      default: return 'Position patient';
    }
  }

  refreshUnreadCount(): void {
    this.notificationApi.unreadCount().subscribe({
      next: (response) => this.notificationUnread.set(response.unreadCount),
      error: () => {},
    });
  }

  toggleNotificationPanel(): void {
    const open = !this.notificationPanelOpen();
    this.notificationPanelOpen.set(open);
    if (open) this.loadNotifications();
  }

  closeNotificationPanel(): void {
    this.notificationPanelOpen.set(false);
  }

  loadNotifications(): void {
    this.notificationLoading.set(true);
    this.notificationError.set(null);
    this.notificationApi.list().subscribe({
      next: (response) => {
        this.notificationLoading.set(false);
        this.notifications.set(response.items);
        this.notificationUnread.set(response.unreadCount);
      },
      error: () => {
        this.notificationLoading.set(false);
        this.notificationError.set('Impossible de charger les notifications.');
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
    return when.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
