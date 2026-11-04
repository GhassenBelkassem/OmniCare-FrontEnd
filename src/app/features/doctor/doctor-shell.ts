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
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { filter } from 'rxjs/operators';

import { AuthTokenStore } from '../../core/auth/auth-token.store';
import { APP_MODE } from '../../core/config/app-mode';
import { RealtimeService } from '../../core/realtime/realtime.service';
import { AuthService } from '../../core/auth/auth.service';
import {
  OcAvatar,
  OcIcon,
  OcPopover,
  OcSheet,
  OcSidebar,
  SidebarLabels,
  SidebarNavigationItem,
  SidebarUserProfile,
} from '../../shared/ui';
import { DoctorNotificationApiService } from './doctor-notification-api.service';
import { PatientLookupDialog } from './patient-lookup-dialog';
import { MockPatientMatch } from './doctor-mock.models';
import { DoctorMockService } from './doctor-mock.service';
import { NotificationItemDto } from './appointment-api.models';

import { UrgentAcceptedStore } from './urgent-accepted.store';
import { ActiveConsultationStore } from './active-consultation.store';

const DOCTOR_SIDEBAR_LABELS: Partial<SidebarLabels> = {
  landmark: 'Navigation principale du médecin',
  workspace: 'Espace médecin',
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
  private readonly mock = inject(DoctorMockService);
  private readonly notificationApi = inject(DoctorNotificationApiService);
  private readonly acceptedStore = inject(UrgentAcceptedStore);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService);
  private readonly tokens = inject(AuthTokenStore);
  readonly activeConsultation = inject(ActiveConsultationStore);

  readonly sidebarCollapsed = signal(false);
  readonly mobileNavigationOpen = signal(false);
  readonly lookupOpen = signal(false);

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
  readonly expectsRealtimeActivity = signal(false);
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

  readonly isSecretary = computed(() => this.tokens.user()?.role === 'SECRETARY');

  readonly navigation = computed<readonly SidebarNavigationItem[]>(() => {
    if (this.isSecretary()) {
      return [
        {
          id: 'secretary-agenda',
          label: 'Agenda',
          icon: 'calendar',
          route: '/doctor/secretary-agenda',
        },
      ];
    }

    return [
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
            route: this.activeConsultation.consultationId()
              ? `/doctor/consultation/${this.activeConsultation.consultationId()}`
              : '/doctor/command',
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
          ...(APP_MODE.staticDemo
            ? [
                {
                  id: 'documents',
                  label: 'Documents',
                  icon: 'requests',
                  route: '/doctor/documents',
                },
              ]
            : []),
          {
            id: 'results',
            label: 'Résultats et suivi',
            icon: 'results',
            route: '/doctor/results',
          },
          { id: 'requests', label: 'Demandes', icon: 'requests', route: '/doctor/requests' },
          {
            id: 'urgent-requests',
            label: 'Demandes urgentes',
            icon: 'emergency',
            route: '/doctor/urgent-requests',
            badge: APP_MODE.staticDemo ? 3 : undefined,
          },
          {
            id: 'history',
            label: 'Consultations terminées',
            icon: 'history',
            route: '/doctor/history',
          },
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
  });
  readonly sidebarLabels = DOCTOR_SIDEBAR_LABELS;
  readonly expandedNavigationGroups = computed(
    () =>
      new Set(
        this.navigation()
          .filter((item) => item.children?.some((child) => child.id === this.activeNav()))
          .map((item) => item.id),
      ),
  );

  readonly sidebarProfile = computed<SidebarUserProfile>(() =>
    this.isSecretary()
      ? { initials: 'SC', name: 'Secrétaire', context: 'Agenda du cabinet' }
      : { initials: 'BS', name: 'Dr Ben Salah', context: 'Médecine générale' },
  );

  constructor() {
    this.syncActiveNavigation(this.router.url);
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => this.syncActiveNavigation(event.urlAfterRedirects));
    if (!this.isSecretary()) {
      this.acceptedStore.purgeLegacyCache();
      this.refreshUnreadCount();
      this.realtime.notificationEvents$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
        this.refreshUnreadCount();
        if (this.notificationPanelOpen()) this.loadNotifications(true);
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
  }

  private syncActiveNavigation(url: string): void {
    const path = url.split(/[?#]/, 1)[0];
    const segment = path.split('/').filter(Boolean)[1] ?? 'command';
    const id = segment === 'patient' ? 'patients' : segment;
    const matchesNavigation = this.navigation().some(
      (item) => item.id === id || item.children?.some((child) => child.id === id),
    );
    this.activeNav.set(matchesNavigation ? id : '');
  }

  onVisibilityChange(): void {
    if (document.visibilityState !== 'visible' || this.isSecretary()) return;
    this.refreshUnreadCount();
    if (this.notificationPanelOpen()) this.loadNotifications(true);
    void this.activeConsultation.refresh();
  }

  logout(): void {
    this.activeConsultation.detach();
    this.auth.logout();
  }

  openLookup(): void {
    if (this.isSecretary()) return;
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
