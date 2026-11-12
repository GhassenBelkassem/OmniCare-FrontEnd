import { HttpErrorResponse } from '@angular/common/http';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

import { RealtimeService } from '../../../core/realtime/realtime.service';
import { OcButton, OcDialog, OcEmptyState, OcIcon,
  OcPageHeader, OcTabs, type OcTab } from '../../../shared/ui';
import {
  URGENT_REQUESTS_DATA_SOURCE,
  type UrgentLocationFilter,
  type UrgentQueueTab,
  type UrgentRequestQueueItem,
} from './urgent-request-queue.models';

interface FeedbackMessage {
  readonly tone: 'success' | 'error' | 'information';
  readonly text: string;
}

type UrgentLoadState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'loaded' }
  | { readonly kind: 'error'; readonly message: string };

const TAB_OPTIONS: readonly OcTab[] = [
  { id: 'pending', label: 'À traiter' },
  { id: 'active', label: 'En cours' },
  { id: 'history', label: 'Historique' },
];

const REFUSAL_REASONS = [
  'Indisponible',
  'Trop loin',
  'Hors de mon champ de compétence',
  'Autre',
] as const;

@Component({
  selector: 'app-urgent-requests-page',
  imports: [CdkTrapFocus, OcButton, OcDialog, OcEmptyState, OcIcon, OcPageHeader, OcTabs],
  templateUrl: './urgent-requests-page.html',
  styleUrls: ['./urgent-requests-page.scss', './urgent-requests-page.responsive.scss'],
  host: {
    '(document:keydown.escape)': 'onEscape()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UrgentRequestsPage {
  private readonly source = inject(URGENT_REQUESTS_DATA_SOURCE);
  private readonly realtime = inject(RealtimeService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly drawerHeading = viewChild<ElementRef<HTMLHeadingElement>>('drawerHeading');
  private lastDetailTrigger: HTMLElement | null = null;
  private observedConnectionEpoch = this.realtime.connectionEpoch();
  private loadGeneration = 0;

  readonly demo = this.source.demo;
  readonly tabs = TAB_OPTIONS;
  readonly refusalReasons = REFUSAL_REASONS;
  readonly activeTab = signal<UrgentQueueTab>(this.initialTab());
  readonly locationFilter = signal<UrgentLocationFilter>(this.initialLocationFilter());
  readonly searchTerm = signal(this.route.snapshot.queryParamMap.get('q') ?? '');
  readonly sortOrder = signal<'recent' | 'oldest'>(this.initialSortOrder());
  readonly requests = signal<readonly UrgentRequestQueueItem[]>([]);
  private readonly loadState = signal<UrgentLoadState>({ kind: 'loading' });
  readonly loading = computed(() => this.loadState().kind === 'loading');
  readonly loadError = computed(() => {
    const state = this.loadState();
    return state.kind === 'error' ? state.message : null;
  });
  readonly selectedOfferId = signal<string | null>(null);
  readonly actionOfferId = signal<string | null>(null);
  readonly feedback = signal<FeedbackMessage | null>(null);
  readonly refusalDialogOpen = signal(false);
  readonly refusalReason = signal<(typeof REFUSAL_REASONS)[number]>('Indisponible');

  readonly selectedRequest = computed(() => {
    const offerId = this.selectedOfferId();
    return this.requests().find((request) => request.offerId === offerId) ?? null;
  });

  readonly newCount = computed(
    () => this.requests().filter((request) => request.status === 'PENDING').length,
  );
  readonly activeCount = computed(
    () => this.requests().filter((request) => request.status === 'ACCEPTED').length,
  );
  readonly todayCount = computed(() => this.newCount() + this.activeCount());

  readonly visibleRequests = computed(() => {
    const tab = this.activeTab();
    const filter = this.locationFilter();
    const query = this.searchTerm().trim().toLocaleLowerCase('fr-FR');
    const direction = this.sortOrder() === 'recent' ? -1 : 1;

    return [...this.requests()]
      .filter((request) => {
        if (tab === 'pending') return request.status === 'PENDING';
        if (tab === 'active') return request.status === 'ACCEPTED';
        return request.status === 'DECLINED' || request.status === 'EXPIRED';
      })
      .filter((request) => {
        if (filter === 'home') return request.visitPreference === 'HOME_VISIT';
        if (filter === 'cabinet') return request.visitPreference === 'CABINET_VISIT';
        return true;
      })
      .filter((request) => {
        if (!query) return true;
        return [
          request.title,
          request.patientLabel,
          request.patientMeta ?? '',
          request.summary,
          request.locationLabel,
        ].some((value) => value.toLocaleLowerCase('fr-FR').includes(query));
      })
      .sort(
        (left, right) =>
          direction * (new Date(left.sentAt).getTime() - new Date(right.sentAt).getTime()),
      );
  });

  readonly realtimeUnavailable = computed(
    () => !this.demo && this.realtime.status() === 'disconnected',
  );

  constructor() {
    this.load();
    this.realtime.urgentEvents$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.load(true));

    effect(() => {
      const epoch = this.realtime.connectionEpoch();
      if (epoch === this.observedConnectionEpoch) return;
      this.observedConnectionEpoch = epoch;
      this.load(true);
    });
  }

  setTab(id: string): void {
    if (id === 'pending' || id === 'active' || id === 'history') {
      this.activeTab.set(id);
      this.closeDetail();
      this.updateQuery({ tab: id === 'pending' ? null : id });
    }
  }

  setLocationFilter(filter: UrgentLocationFilter): void {
    this.locationFilter.set(filter);
    this.updateQuery({ mode: filter === 'all' ? null : filter });
  }

  onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchTerm.set(value);
    this.updateQuery({ q: value.trim() || null });
  }

  onSort(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    const order = value === 'oldest' ? 'oldest' : 'recent';
    this.sortOrder.set(order);
    this.updateQuery({ sort: order === 'recent' ? null : order });
  }

  openDetail(request: UrgentRequestQueueItem, event?: Event): void {
    this.lastDetailTrigger = event?.currentTarget as HTMLElement | null;
    this.selectedOfferId.set(request.offerId);
    this.updateQuery({ drawer: request.offerId });
    queueMicrotask(() => this.drawerHeading()?.nativeElement.focus());
  }

  closeDetail(): void {
    if (this.selectedOfferId() === null) return;
    this.selectedOfferId.set(null);
    this.updateQuery({ drawer: null });
    const trigger = this.lastDetailTrigger;
    this.lastDetailTrigger = null;
    queueMicrotask(() => trigger?.focus());
  }

  onEscape(): void {
    if (!this.refusalDialogOpen()) this.closeDetail();
  }

  accept(request: UrgentRequestQueueItem): void {
    if (this.actionOfferId() !== null || request.status !== 'PENDING') return;
    this.actionOfferId.set(request.offerId);
    this.feedback.set(null);
    this.source
      .accept(request.offerId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.replaceRequest(updated);
          this.actionOfferId.set(null);
          this.closeDetail();
          this.feedback.set({ tone: 'success', text: 'Demande acceptée' });
        },
        error: (error: unknown) => {
          this.actionOfferId.set(null);
          if (isUnavailableConflict(error)) {
            this.closeDetail();
            this.feedback.set({
              tone: 'information',
              text: "Cette demande n'est plus disponible.",
            });
            this.load(true);
            return;
          }
          this.feedback.set({
            tone: 'error',
            text: "La demande n'a pas pu être acceptée. Réessayez.",
          });
        },
      });
  }

  openRefusalDialog(request: UrgentRequestQueueItem): void {
    this.selectedOfferId.set(request.offerId);
    this.refusalReason.set('Indisponible');
    this.refusalDialogOpen.set(true);
  }

  cancelRefusal(): void {
    if (this.actionOfferId() !== null) return;
    this.refusalDialogOpen.set(false);
  }

  chooseRefusalReason(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (REFUSAL_REASONS.some((reason) => reason === value)) {
      this.refusalReason.set(value as (typeof REFUSAL_REASONS)[number]);
    }
  }

  confirmRefusal(): void {
    const request = this.selectedRequest();
    if (!request || this.actionOfferId() !== null) return;
    this.actionOfferId.set(request.offerId);
    this.feedback.set(null);
    this.source
      .decline(request.offerId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.replaceRequest(updated);
          this.actionOfferId.set(null);
          this.refusalDialogOpen.set(false);
          this.closeDetail();
          this.feedback.set({ tone: 'information', text: 'Demande refusée' });
        },
        error: (error: unknown) => {
          this.actionOfferId.set(null);
          if (isUnavailableConflict(error)) {
            this.refusalDialogOpen.set(false);
            this.closeDetail();
            this.feedback.set({
              tone: 'information',
              text: "Cette demande n'est plus disponible.",
            });
            this.load(true);
            return;
          }
          this.feedback.set({
            tone: 'error',
            text: 'Le refus n’a pas pu être transmis. Réessayez.',
          });
        },
      });
  }

  openDirections(request: UrgentRequestQueueItem): void {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${request.latitude},${request.longitude}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  retry(): void {
    this.load();
  }

  relativeTime(request: UrgentRequestQueueItem): string {
    if (request.relativeLabel) return request.relativeLabel;
    const minutes = Math.max(
      0,
      Math.floor((Date.now() - new Date(request.sentAt).getTime()) / 60_000),
    );
    if (minutes < 1) return 'À l’instant';
    if (minutes < 60) return `Il y a ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    return `Il y a ${hours} h`;
  }

  formatDistance(distanceKm: number): string {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(distanceKm);
  }

  formattedSentAt(request: UrgentRequestQueueItem): string {
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Africa/Tunis',
    }).format(new Date(request.sentAt));
  }

  visitLabel(request: UrgentRequestQueueItem): string {
    if (request.visitPreference === 'HOME_VISIT') return 'À DOMICILE';
    if (request.visitPreference === 'CABINET_VISIT') return 'CABINET';
    return 'DOMICILE OU CABINET';
  }

  activeStatusLabel(request: UrgentRequestQueueItem): string {
    return request.requestStatus === 'MATCHED'
      ? 'Prise en charge confirmée'
      : 'En attente du choix du patient';
  }

  emptyTitle(): string {
    if (this.searchTerm().trim() || this.locationFilter() !== 'all') return 'Aucun résultat';
    if (this.activeTab() === 'active') return 'Aucune prise en charge en cours';
    if (this.activeTab() === 'history') return 'Aucune demande récente';
    return 'Aucune demande urgente disponible';
  }

  emptyDescription(): string {
    if (this.searchTerm().trim() || this.locationFilter() !== 'all') {
      return 'Modifiez la recherche ou les filtres pour afficher les demandes.';
    }
    if (this.activeTab() === 'pending') {
      return 'Les nouvelles demandes apparaîtront ici automatiquement.';
    }
    return 'Aucune demande ne correspond à cet onglet pour le moment.';
  }

  private load(silent = false): void {
    const generation = ++this.loadGeneration;
    if (!silent) this.loadState.set({ kind: 'loading' });
    else if (this.loadState().kind === 'error') this.loadState.set({ kind: 'loaded' });
    this.source
      .load()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (requests) => {
          if (generation !== this.loadGeneration) return;
          this.requests.set(requests);
          this.loadState.set({ kind: 'loaded' });
          const requestedDrawer = this.route.snapshot.queryParamMap.get('drawer');
          if (requestedDrawer) {
            const requested = requests.find((request) => request.offerId === requestedDrawer);
            const firstPending = requests.find((request) => request.status === 'PENDING');
            const selected = requested ?? (requestedDrawer === 'open' ? firstPending : null);
            if (selected) this.selectedOfferId.set(selected.offerId);
          }
        },
        error: () => {
          if (generation !== this.loadGeneration) return;
          this.loadState.set({
            kind: 'error',
            message: 'Impossible de charger les demandes urgentes.',
          });
        },
      });
  }

  private replaceRequest(updated: UrgentRequestQueueItem): void {
    this.requests.update((items) =>
      items.map((item) => (item.offerId === updated.offerId ? updated : item)),
    );
  }

  private initialTab(): UrgentQueueTab {
    const tab = this.route.snapshot.queryParamMap.get('tab');
    return tab === 'active' || tab === 'history' ? tab : 'pending';
  }

  private initialLocationFilter(): UrgentLocationFilter {
    const mode = this.route.snapshot.queryParamMap.get('mode');
    return mode === 'home' || mode === 'cabinet' ? mode : 'all';
  }

  private initialSortOrder(): 'recent' | 'oldest' {
    return this.route.snapshot.queryParamMap.get('sort') === 'oldest' ? 'oldest' : 'recent';
  }

  private updateQuery(queryParams: Record<string, string | null>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}

function isUnavailableConflict(error: unknown): boolean {
  if (error instanceof HttpErrorResponse)
    return error.status === 404 || error.status === 409 || error.status === 410;
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as { status?: unknown }).status;
    return status === 404 || status === 409 || status === 410;
  }
  return false;
}
