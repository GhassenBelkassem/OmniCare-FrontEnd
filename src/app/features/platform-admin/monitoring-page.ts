import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  WritableSignal,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { timer } from 'rxjs';

import { OcButton, OcPageHeader, OcSegmentedControl, OcSegmentOption } from '../../shared/ui';
import { apiMessage } from './admin-page-utils';
import { MonitoringApiService } from './monitoring-api.service';
import {
  MonitoringAlerts,
  MonitoringOperations,
  MonitoringOverview,
  MonitoringPerformance,
  MonitoringSection,
  PerformanceWindow,
} from './monitoring.models';
import { formatTimestamp } from './monitoring-status.util';
import { MonitoringOverviewPanel } from './monitoring/monitoring-overview-panel';
import { MonitoringPerformancePanel } from './monitoring/monitoring-performance-panel';
import { MonitoringOperationsPanel } from './monitoring/monitoring-operations-panel';
import { MonitoringAlertsPanel } from './monitoring/monitoring-alerts-panel';
import { MonitoringDiagnosticsPanel } from './monitoring/monitoring-diagnostics-panel';

/**
 * Bounded automatic refresh.
 *
 * The interval is deliberately long: the backend caches every monitoring response, and the
 * page must not turn into a polling loop against Prometheus/Alertmanager. Refreshes are
 * skipped while the tab is hidden and never overlap an in-flight request.
 */
export const MONITORING_REFRESH_INTERVAL_MS = 30_000;

/** Loading/error/data triplet for one monitoring section. */
interface SectionState<T> {
  readonly data: WritableSignal<T | null>;
  readonly loading: WritableSignal<boolean>;
  readonly error: WritableSignal<string | null>;
}

function sectionState<T>(): SectionState<T> {
  return {
    data: signal<T | null>(null),
    loading: signal(true),
    error: signal<string | null>(null),
  };
}

@Component({
  selector: 'app-monitoring-page',
  imports: [
    OcButton,
    OcPageHeader,
    OcSegmentedControl,
    MonitoringOverviewPanel,
    MonitoringPerformancePanel,
    MonitoringOperationsPanel,
    MonitoringAlertsPanel,
    MonitoringDiagnosticsPanel,
  ],
  templateUrl: './monitoring-page.html',
  styleUrl: './monitoring-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MonitoringPage {
  private readonly api = inject(MonitoringApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly section = signal<MonitoringSection>('overview');
  readonly window = signal<PerformanceWindow>('1h');

  readonly overview = sectionState<MonitoringOverview>();
  readonly performance = sectionState<MonitoringPerformance>();
  readonly operations = sectionState<MonitoringOperations>();
  readonly alerts = sectionState<MonitoringAlerts>();

  /** Timestamp of the most recent successful load, whatever section produced it. */
  readonly lastUpdated = signal<string | null>(null);

  /** The request explorer owns its own state, so the page asks it to reload directly. */
  private readonly diagnosticsPanel = viewChild(MonitoringDiagnosticsPanel);

  /** True while a page-driven refresh is running. */
  private readonly refreshPending = signal(false);

  readonly refreshing = computed(
    () => this.refreshPending() || (this.diagnosticsPanel()?.busy() ?? false),
  );

  readonly sectionOptions: readonly OcSegmentOption[] = [
    { value: 'overview', label: 'Overview' },
    { value: 'performance', label: 'Performance' },
    { value: 'operations', label: 'Operations' },
    { value: 'alerts', label: 'Alerts' },
    { value: 'diagnostics', label: 'Diagnostics' },
  ];

  readonly format = formatTimestamp;

  /** Sections whose request is currently in flight, so refreshes never overlap. */
  private readonly inFlight = new Set<MonitoringSection>();

  constructor() {
    this.loadSection(this.section());
    timer(MONITORING_REFRESH_INTERVAL_MS, MONITORING_REFRESH_INTERVAL_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.refresh());
  }

  handleSectionChange(value: string): void {
    if (
      value === 'overview' ||
      value === 'performance' ||
      value === 'operations' ||
      value === 'alerts' ||
      value === 'diagnostics'
    ) {
      this.section.set(value);
      this.loadSection(value);
    }
  }

  /** Changing the window re-reads the performance section for the new bounded range. */
  handleWindowChange(value: PerformanceWindow): void {
    this.window.set(value);
    this.loadPerformance();
  }

  /** Manual refresh of the visible section. */
  refresh(): void {
    if (this.section() === 'diagnostics') {
      this.diagnosticsPanel()?.reload();
      return;
    }
    this.refreshPending.set(true);
    this.loadSection(this.section(), true);
  }

  /**
   * Loads one section. A silent load keeps the previous data on screen and only surfaces a
   * failure as a banner, so an automatic refresh never blanks a working screen.
   */
  private loadSection(section: MonitoringSection, silent = false): void {
    switch (section) {
      case 'overview':
        this.loadOverview(silent);
        break;
      case 'performance':
        this.loadPerformance(silent);
        break;
      case 'operations':
        this.loadOperations(silent);
        break;
      case 'alerts':
        this.loadAlerts(silent);
        break;
      case 'diagnostics':
        // The request explorer owns its own loading, filtering and pagination state.
        break;
    }
  }

  private loadOverview(silent = false): void {
    const state = this.overview;
    if (!this.beginLoad('overview')) return;
    if (!silent) state.loading.set(true);
    state.error.set(null);
    this.api
      .getOverview()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          state.data.set(data);
          state.loading.set(false);
          this.lastUpdated.set(new Date().toISOString());
          this.endLoad('overview');
        },
        error: (error: unknown) => {
          state.error.set(apiMessage(error));
          state.loading.set(false);
          this.endLoad('overview');
        },
      });
  }

  private loadPerformance(silent = false): void {
    const state = this.performance;
    if (!this.beginLoad('performance')) return;
    if (!silent) state.loading.set(true);
    state.error.set(null);
    this.api
      .getPerformance(this.window())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          state.data.set(data);
          state.loading.set(false);
          this.lastUpdated.set(new Date().toISOString());
          this.endLoad('performance');
        },
        error: (error: unknown) => {
          state.error.set(apiMessage(error));
          state.loading.set(false);
          this.endLoad('performance');
        },
      });
  }

  private loadOperations(silent = false): void {
    const state = this.operations;
    if (!this.beginLoad('operations')) return;
    if (!silent) state.loading.set(true);
    state.error.set(null);
    this.api
      .getOperations()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          state.data.set(data);
          state.loading.set(false);
          this.lastUpdated.set(new Date().toISOString());
          this.endLoad('operations');
        },
        error: (error: unknown) => {
          state.error.set(apiMessage(error));
          state.loading.set(false);
          this.endLoad('operations');
        },
      });
  }

  private loadAlerts(silent = false): void {
    const state = this.alerts;
    if (!this.beginLoad('alerts')) return;
    if (!silent) state.loading.set(true);
    state.error.set(null);
    this.api
      .getAlerts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          state.data.set(data);
          state.loading.set(false);
          this.lastUpdated.set(new Date().toISOString());
          this.endLoad('alerts');
        },
        error: (error: unknown) => {
          state.error.set(apiMessage(error));
          state.loading.set(false);
          this.endLoad('alerts');
        },
      });
  }

  /**
   * Guards against overlapping requests for the same section. A refresh that arrives while a
   * request is still running is skipped rather than queued, and the pending flag is cleared
   * so the spinner cannot get stuck.
   */
  private beginLoad(section: MonitoringSection): boolean {
    if (this.inFlight.has(section)) {
      this.refreshPending.set(false);
      return false;
    }
    this.inFlight.add(section);
    return true;
  }

  private endLoad(section: MonitoringSection): void {
    this.inFlight.delete(section);
    this.refreshPending.set(false);
  }
}
