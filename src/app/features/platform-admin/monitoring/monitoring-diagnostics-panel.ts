import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  OcButton,
  OcCard,
  OcDataTableShell,
  OcEmptyState,
  OcField,
  OcSegmentedControl,
  OcSegmentOption,
  OcStatusBadge,
} from '../../../shared/ui';
import { apiMessage } from '../admin-page-utils';
import { MonitoringApiService } from '../monitoring-api.service';
import {
  PerformanceWindow,
  RequestDetail,
  RequestOutcomeFilter,
  RequestPage,
  RequestSearchQuery,
  RequestSortField,
  RequestSummaryItem,
  SLOW_REQUEST_THRESHOLD_MS,
} from '../monitoring.models';
import { formatOptional, formatTimestamp, requestOutcomeBadge, requestOutcomeLabel, requestPriorityLabel } from '../monitoring-status.util';
import { MonitoringRequestDetailDrawer } from './monitoring-request-detail-drawer';

type RequestViewState = 'loading' | 'default' | 'empty' | 'error';

/** Bounded page size. The backend clamps this to its own maximum. */
const PAGE_SIZE = 25;

/** CORS preflight traffic is recorded in the same access log but is not a user-facing call. */
function isPreflight(item: RequestSummaryItem): boolean {
  return (item.method ?? '').trim().toUpperCase() === 'OPTIONS';
}

@Component({
  selector: 'oc-monitoring-diagnostics-panel',
  imports: [
    ReactiveFormsModule,
    OcButton,
    OcCard,
    OcDataTableShell,
    OcEmptyState,
    OcField,
    OcSegmentedControl,
    OcStatusBadge,
    MonitoringRequestDetailDrawer,
  ],
  templateUrl: './monitoring-diagnostics-panel.html',
  styleUrl: './monitoring-panels.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MonitoringDiagnosticsPanel {
  readonly showRequestExplorer = input(true);

  private readonly api = inject(MonitoringApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly format = formatTimestamp;
  readonly outcomeBadge = requestOutcomeBadge;
  readonly outcomeLabel = requestOutcomeLabel;
  readonly priorityLabel = requestPriorityLabel;
  readonly formatOptional = formatOptional;

  readonly windowOptions: readonly OcSegmentOption[] = [
    { value: '15m', label: '15m' },
    { value: '1h', label: '1h' },
    { value: '6h', label: '6h' },
    { value: '24h', label: '24h' },
  ];
  readonly outcomeOptions: readonly OcSegmentOption[] = [
    { value: 'ALL', label: 'All' },
    { value: 'SUCCESS', label: 'Success' },
    { value: 'CLIENT_ERROR', label: '4xx' },
    { value: 'SERVER_ERROR', label: '5xx' },
  ];

  // Explorer state — one bounded page is ever held client-side.
  readonly page = signal<RequestPage | null>(null);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly window = signal<PerformanceWindow>('24h');
  readonly outcome = signal<RequestOutcomeFilter>('ALL');
  readonly onlyFailed = signal(false);
  readonly onlySlow = signal(false);
  readonly endpoint = new FormControl('', { nonNullable: true });
  readonly requestIdFilter = new FormControl('', { nonNullable: true });
  readonly sort = signal<RequestSortField>('occurredAt');
  readonly direction = signal<'asc' | 'desc'>('desc');
  /** Preflight (OPTIONS) traffic is hidden from the user-facing list unless asked for. */
  readonly showPreflight = signal(false);

  /**
   * Cursor history. Index 0 is the first page (no cursor); each following entry is the
   * opaque cursor that produced it. The backend paginates with `search_after`, so the
   * client can only move forward and then back through the stack it recorded.
   */
  private readonly cursorStack = signal<readonly (string | null)[]>([null]);
  private readonly nextCursor = signal<string | null>(null);

  readonly selection = signal<RequestDetail | null>(null);
  readonly selectionOpen = signal(false);
  readonly selectionLoading = signal(false);
  readonly selectionError = signal<string | null>(null);

  // Identifier lookup.
  readonly requestId = new FormControl('', { nonNullable: true, validators: [Validators.required] });

  private readonly requestIdPattern = /^[a-fA-F0-9\-._]{8,128}$/;

  /** True while the explorer is doing work; drives the page-level refresh indicator. */
  readonly busy = computed(() => this.loading() || this.selectionLoading());

  readonly visibleItems = computed<readonly RequestSummaryItem[]>(() => {
    const items = this.page()?.items ?? [];
    return this.showPreflight() ? items : items.filter((item) => !isPreflight(item));
  });

  /** Preflight entries present in the loaded page but hidden from the user-facing list. */
  readonly hiddenPreflightCount = computed(() => {
    if (this.showPreflight()) return 0;
    return (this.page()?.items ?? []).filter((item) => isPreflight(item)).length;
  });

  readonly sourceUnavailable = computed(() => this.page()?.sourceAvailable === false);

  /** The slow threshold is echoed by the backend; the constant is only a pre-response fallback. */
  readonly slowThresholdMs = computed(() => this.page()?.slowThresholdMs ?? SLOW_REQUEST_THRESHOLD_MS);

  readonly tableState = computed<RequestViewState>(() => {
    if (this.loading()) return 'loading';
    if (this.errorMessage() && !this.page()) return 'error';
    return this.visibleItems().length ? 'default' : 'empty';
  });

  readonly currentPageNumber = computed(() => this.cursorStack().length);
  readonly canGoBack = computed(() => this.cursorStack().length > 1);
  readonly canGoForward = computed(() => this.nextCursor() !== null);

  readonly resultSummary = computed(() => {
    const result = this.page();
    if (!result) return '';
    if (result.totalElements >= 0) {
      return `${result.totalElements} ${result.totalElements === 1 ? 'request' : 'requests'}`;
    }
    const shown = this.visibleItems().length;
    return `${shown} ${shown === 1 ? 'request' : 'requests'} in this page`;
  });

  readonly emptyStateTitle = computed(() => {
    if (this.sourceUnavailable()) return 'Request history unavailable';
    if (this.hiddenPreflightCount() > 0) return 'No user-facing requests in this page';
    return 'No requests match';
  });

  readonly emptyStateDescription = computed(() => {
    if (this.sourceUnavailable()) {
      return 'The request-history source could not be reached, so no request could be listed. The rest of the monitoring data is unaffected.';
    }
    if (this.hiddenPreflightCount() > 0) {
      return 'This page contains only CORS preflight traffic. Adjust the window or filters, or show preflight requests.';
    }
    return 'Adjust the window or filters. The explorer never loads the entire history.';
  });

  constructor() {
    this.load(null);
  }

  /** Reloads the current page, used by the page-level refresh control. */
  reload(): void {
    this.load(this.cursorStack()[this.cursorStack().length - 1] ?? null);
  }

  private load(cursor: string | null): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    const query: RequestSearchQuery = {
      window: this.window(),
      outcome: this.outcome(),
      onlyFailed: this.onlyFailed(),
      onlySlow: this.onlySlow(),
      endpoint: this.endpoint.value,
      requestId: this.requestIdFilter.value,
      sort: this.sort(),
      direction: this.direction(),
      pageSize: PAGE_SIZE,
      cursor,
    };
    this.api
      .searchRequests(query)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.page.set(result);
          this.nextCursor.set(result.nextCursor);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.errorMessage.set(apiMessage(error));
          this.page.set(null);
          this.nextCursor.set(null);
          this.loading.set(false);
        },
      });
  }

  /** Any filter change restarts from the first page: the old cursor no longer applies. */
  applyFilters(): void {
    this.cursorStack.set([null]);
    this.load(null);
  }

  clearFilters(): void {
    this.endpoint.setValue('');
    this.requestIdFilter.setValue('');
    this.outcome.set('ALL');
    this.onlyFailed.set(false);
    this.onlySlow.set(false);
    this.applyFilters();
  }

  setWindow(value: string): void {
    if (value === '15m' || value === '1h' || value === '6h' || value === '24h') {
      this.window.set(value);
      this.applyFilters();
    }
  }

  setOutcome(value: string): void {
    if (value === 'ALL' || value === 'SUCCESS' || value === 'CLIENT_ERROR' || value === 'SERVER_ERROR') {
      this.outcome.set(value);
      this.applyFilters();
    }
  }

  toggleOnlyFailed(): void {
    this.onlyFailed.update((value) => !value);
    this.applyFilters();
  }

  toggleOnlySlow(): void {
    this.onlySlow.update((value) => !value);
    this.applyFilters();
  }

  togglePreflight(): void {
    this.showPreflight.update((value) => !value);
  }

  setSort(field: RequestSortField): void {
    if (this.sort() === field) {
      this.direction.update((direction) => (direction === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sort.set(field);
      this.direction.set('desc');
    }
    this.applyFilters();
  }

  nextPage(): void {
    const cursor = this.nextCursor();
    if (!cursor) return;
    this.cursorStack.update((stack) => [...stack, cursor]);
    this.load(cursor);
  }

  previousPage(): void {
    if (!this.canGoBack()) return;
    const stack = this.cursorStack().slice(0, -1);
    this.cursorStack.set(stack);
    this.load(stack[stack.length - 1] ?? null);
  }

  /** Opens the technical detail level for a single request. */
  openDetail(item: RequestSummaryItem): void {
    this.openRequest(item.requestId);
  }

  /** Looks up one request by its identifier and shows it in the detail drawer. */
  submit(): void {
    this.requestId.markAsTouched();
    if (this.requestId.invalid) return;
    const requestId = this.requestId.value.trim();
    if (!this.requestIdPattern.test(requestId)) {
      this.requestId.setErrors({ invalid: true });
      return;
    }
    this.openRequest(requestId);
  }

  /**
   * Validation message for the request-id lookup. The form state is read here rather than in
   * the template so the rule lives in one place and the template stays declarative.
   */
  requestIdError(): string | null {
    const control = this.requestId;
    if (!control || !control.touched) return null;
    if (control.hasError('required')) return 'Request ID is required.';
    if (control.hasError('invalid')) return 'Enter a valid request ID format.';
    return null;
  }

  /** True once a touched request-id field holds a value the format rule rejects. */
  requestIdInvalid(): boolean {
    const control = this.requestId;
    return !!control && control.touched && control.invalid;
  }

  private openRequest(requestId: string): void {
    this.selectionError.set(null);
    this.selection.set(null);
    this.selectionLoading.set(true);
    this.selectionOpen.set(true);
    this.api
      .getRequestDetail(requestId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detail) => {
          this.selection.set(detail);
          this.selectionLoading.set(false);
        },
        error: (error: unknown) => {
          this.selectionError.set(apiMessage(error));
          this.selectionLoading.set(false);
        },
      });
  }

  trackRequestId(_index: number, item: RequestSummaryItem): string {
    return item.requestId;
  }
}
