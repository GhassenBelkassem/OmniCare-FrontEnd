/**
 * MON-04 monitoring view models.
 *
 * These mirror the read-only `/api/v1/admin/monitoring` contract served by the backend
 * `MonitoringAdminController`. Every value is produced server-side from Prometheus,
 * Alertmanager and Elasticsearch; the client never invents one.
 *
 * Two rules shape every model below:
 *
 *  - A missing signal is never reported as healthy. `UNKNOWN` and `NOT_INSTRUMENTED` are
 *    first-class states, exactly as they are on the backend.
 *  - Absent HTTP metadata is `null`, never `0`, `""` or a placeholder such as `unmatched`.
 *    The UI renders those as "Not available" rather than inferring a value.
 *
 * No patient, clinical, credential or body data is ever represented in these models.
 */

export type MonitoringStatus = 'HEALTHY' | 'DEGRADED' | 'CRITICAL' | 'UNKNOWN' | 'NOT_INSTRUMENTED';

export type MonitoringSection =
  'overview' | 'performance' | 'operations' | 'alerts' | 'diagnostics';

/** Closed set of bounded windows. The backend rejects anything outside it. */
export type PerformanceWindow = '15m' | '1h' | '6h' | '24h';

export type AlertState = 'FIRING' | 'PENDING' | 'SILENCED' | 'INHIBITED' | 'RESOLVED';

export type AlertSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export interface MonitoringDependency {
  readonly id: string;
  readonly label: string;
  readonly status: MonitoringStatus;
  /** Human explanation of why this state was chosen; shown as supporting text. */
  readonly detail: string;
  /** True when the optional exporter that would provide this signal is disabled. */
  readonly exporterOptional: boolean;
  /** Browser-safe Grafana Explore link supplied by the backend, when available. */
  readonly monitoringLink?: string | null;
}

export interface MonitoringOverview {
  readonly overallStatus: MonitoringStatus;
  readonly overallDetail: string;
  readonly dependencies: readonly MonitoringDependency[];
  /** Age of the last operational snapshot in seconds; `-1` when no sample was returned. */
  readonly telemetryFreshnessSeconds: number;
  /** Instant the telemetry was last refreshed; `null` when no sample was returned. */
  readonly telemetryFreshSinceIso: string | null;
  readonly snapshotCollected: boolean;
  readonly criticalAlertCount: number;
  readonly warningAlertCount: number;
  readonly incidentSummary: string;
  /** Sources that could not be reached. They are reported as Unknown, never as Healthy. */
  readonly unavailableSources: readonly string[];
}

export interface MonitoringSeriesPoint {
  /** Instant label for the axis, e.g. a time-of-day string. */
  readonly label: string;
  readonly value: number;
}

export interface MonitoringPerformanceMetric {
  readonly id: string;
  readonly label: string;
  readonly unit: string;
  readonly status: MonitoringStatus;
  /** Formatted value; empty when Prometheus returned no sample for the window. */
  readonly value: string;
  readonly supportingText: string;
  readonly series: readonly MonitoringSeriesPoint[];
}

export interface MonitoringPerformance {
  readonly window: PerformanceWindow;
  readonly collectedAtIso: string;
  readonly metrics: readonly MonitoringPerformanceMetric[];
  readonly unavailableSources: readonly string[];
}

export interface MonitoringBacklogRow {
  readonly label: string;
  /** Formatted value; empty when the counter could not be collected. */
  readonly value: string;
  readonly status: MonitoringStatus;
  /** Optional note, e.g. the "-1 = none" sentinel or a documented known gap. */
  readonly note?: string | null;
}

export interface MonitoringOperationsGroup {
  readonly id: string;
  readonly title: string;
  readonly status: MonitoringStatus;
  readonly rows: readonly MonitoringBacklogRow[];
}

export interface MonitoringOperations {
  readonly groups: readonly MonitoringOperationsGroup[];
  readonly knownGaps: readonly string[];
  readonly unavailableSources: readonly string[];
}

export interface MonitoringAlert {
  readonly id: string;
  readonly name: string;
  readonly severity: AlertSeverity;
  readonly state: AlertState;
  readonly component: string;
  readonly firstDetectedIso: string | null;
  readonly updatedIso: string | null;
  /** One-line human-readable incident summary shown by default. */
  readonly summary: string;
  /** Plain-language "what this means" line for the simple operational view. */
  readonly impact: string;
  /** Suggested read-only next step; MON-04 never acts on it. */
  readonly suggestedAction: string;
  /** Technical details, revealed only on request (progressive disclosure). */
  readonly technical: AlertTechnicalDetail;
  /** Deep link provided by the backend; `null` when no monitoring URL is configured. */
  readonly monitoringLink: string | null;
}

/**
 * Safe, aggregate-only technical detail. No raw PromQL, identifiers or credentials.
 * Values are backend-derived and may be unavailable for some rule sources; when a field
 * cannot be derived it is `null` rather than a fabricated value.
 */
export interface AlertTechnicalDetail {
  /** Coarse, human-readable description of the rule (not raw PromQL). */
  readonly expressionSummary: string;
  readonly forDuration: string;
  readonly threshold: string;
  /** Last observed value; `null` when the source does not expose a comparable value. */
  readonly observedValue: string | null;
  readonly labels: Readonly<Record<string, string>>;
  readonly runbook: string | null;
}

export interface MonitoringAlerts {
  readonly active: readonly MonitoringAlert[];
  /** MON-04 is a read-only surface; the backend always reports `true`. */
  readonly readOnly: boolean;
  readonly unavailableSources: readonly string[];
}

/* ------------------------------------------------------------------------------------------
 * Request explorer.
 *
 * The explorer is designed for backend-side filtering/sorting/pagination: the client only
 * ever receives one bounded page, addressed by an opaque cursor. A request is "slow"
 * relative to a threshold the backend echoes back (2,000 ms by default) that is deliberately
 * independent of the Prometheus alert rules, and a successful request can still be slow.
 * No request body, header, token, query string or patient data is ever part of these models.
 * ---------------------------------------------------------------------------------------- */

/**
 * Fallback used only before the first response arrives. Once a page is loaded the
 * threshold displayed is always the one echoed by the backend.
 */
export const SLOW_REQUEST_THRESHOLD_MS = 2000;

export type RequestOutcome = 'SUCCESS' | 'CLIENT_ERROR' | 'SERVER_ERROR' | 'UNKNOWN';

/**
 * Outcomes selectable as a filter.
 *
 * <p>Deliberately narrower than {@link RequestOutcome}: rows whose HTTP metadata was not
 * recorded are surfaced in the list as `UNKNOWN`, but they are not a filter option, so a query
 * can never silently be widened to "everything".
 */
export type RequestOutcomeFilter = 'ALL' | 'SUCCESS' | 'CLIENT_ERROR' | 'SERVER_ERROR';

export type RequestPriority = 'FAILED' | 'SLOW' | 'NORMAL' | 'UNKNOWN';

/** Sort fields accepted by the backend; `occurredAt` maps to the raw timestamp. */
export type RequestSortField = 'occurredAt' | 'duration' | 'status';

export interface RequestSummaryItem {
  readonly requestId: string;
  readonly occurredAtIso: string;
  /**
   * HTTP method when the telemetry supplied it; `null` when it did not. Never fabricated —
   * an absent method is shown as "Not available", not guessed.
   */
  readonly method: string | null;
  /**
   * Normalized route template, e.g. `/api/v1/admin/professionals/{userId}`. Never a raw URL.
   * `null` when the telemetry did not record a route. The literal `unmatched` is reserved for a
   * route that was genuinely recorded as unmatched — it is never a stand-in for a missing value.
   */
  readonly route: string | null;
  /** HTTP status when recorded; `null` (never `0`) when absent. Absent ⇒ `outcome === 'UNKNOWN'`. */
  readonly statusCode: number | null;
  /** `UNKNOWN` when the status was absent — a missing status is never treated as `SUCCESS`. */
  readonly outcome: RequestOutcome;
  /** Duration when recorded; `null` (never `0`) when absent. Absent ⇒ `priority === 'UNKNOWN'`. */
  readonly durationMs: number | null;
  /**
   * Only `true` when a duration was recorded and reached the threshold. A missing duration is
   * **not** slow; slowness is simply unevaluated (see `priority` and `dataComplete`).
   */
  readonly slow: boolean;
  /** `UNKNOWN` when the outcome or duration is absent and slowness cannot be judged. */
  readonly priority: RequestPriority;
  readonly traceId: string | null;
  /**
   * `true` only when method, route, status and duration were all recorded. `false` signals the
   * row is incomplete and the UI should surface missing metadata rather than imply it exists.
   */
  readonly dataComplete: boolean;
}

/**
 * Optional technical detail for a single request.
 *
 * Every field here is **optional and best-effort**: real telemetry may not supply it. In
 * particular, Hibernate/JDBC spans are not produced in this codebase (a documented MON-02
 * gap), so `dbQueryCount` and `slowestSpanMillis` are frequently absent. The UI must
 * therefore render a neutral "not available" state rather than implying the value exists.
 * Absent fields are expressed as `undefined` or `null`, never as a fabricated zero.
 */
export interface RequestTechnicalDetail {
  /** Acting role when known; absent for anonymous/unauthenticated requests. */
  readonly userRole?: string | null;
  /** Coarse client class (web / web-admin / worker); best-effort, may be absent. */
  readonly clientKind?: string | null;
  /** Coarse feature area label; best-effort, may be absent. */
  readonly featureArea?: string | null;
  /** Short human explanation when available; absent when not derived. */
  readonly outcomeReason?: string | null;
  /** Span count when tracing sampled the request; absent otherwise. */
  readonly spanCount?: number | null;
  /** DB query count when instrumented; **not produced today** (MON-02 JDBC gap). */
  readonly dbQueryCount?: number | null;
  /** Slowest span duration when tracing sampled the request; absent otherwise. */
  readonly slowestSpanMillis?: number | null;
  /** Whether a trace exists. Gate Tempo actions on this — never assume it does. */
  readonly traceAvailable: boolean;
  /** Whether correlated logs exist. Gate Kibana actions on this — never assume they do. */
  readonly logsAvailable: boolean;
}

/** Browser-safe, read-only monitoring destinations assembled by the backend. */
export interface RequestMonitoringLinks {
  readonly logsUrl: string | null;
  readonly traceUrl: string | null;
  readonly metricsUrl: string | null;
}

export interface RequestDetail extends RequestSummaryItem {
  /** Never `null` on the client: a missing backend detail is normalised to an all-absent detail. */
  readonly detail: RequestTechnicalDetail;
  /** Optional during a rolling deployment against an older backend. */
  readonly links?: RequestMonitoringLinks | null;
}

export interface RequestSearchQuery {
  readonly window: PerformanceWindow;
  readonly outcome: RequestOutcomeFilter;
  readonly onlyFailed: boolean;
  readonly onlySlow: boolean;
  /** Normalized-route substring; matched server-side against the route template only. */
  readonly endpoint: string;
  /** Exact request identifier filter. */
  readonly requestId: string;
  readonly sort: RequestSortField;
  readonly direction: 'asc' | 'desc';
  readonly pageSize: number;
  /** Opaque cursor for the page to load; `null` for the first page. */
  readonly cursor: string | null;
}

export interface RequestPage {
  readonly items: readonly RequestSummaryItem[];
  /** Always `0`: the backend paginates by cursor, not by offset. */
  readonly page: number;
  readonly pageSize: number;
  /** `-1` when the source does not track totals. */
  readonly totalElements: number;
  /** `-1` when the source does not track totals. */
  readonly totalPages: number;
  /** Opaque cursor for the next page; `null` when this is the last page. */
  readonly nextCursor: string | null;
  /** Slow threshold echoed by the backend so the client never hardcodes it. */
  readonly slowThresholdMs: number;
  /** `false` when the request-history source could not be reached. */
  readonly sourceAvailable: boolean;
}
