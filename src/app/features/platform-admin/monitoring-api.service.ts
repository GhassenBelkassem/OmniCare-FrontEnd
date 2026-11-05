import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { RUNTIME_CONFIG } from '../../core/config/runtime-config';
import {
  MonitoringAlerts,
  MonitoringOperations,
  MonitoringOverview,
  MonitoringPerformance,
  PerformanceWindow,
  RequestDetail,
  RequestPage,
  RequestSearchQuery,
  RequestTechnicalDetail,
} from './monitoring.models';

/**
 * The all-absent technical detail used when the backend cannot supply one. The backend
 * resolves the detail block to `null` when it has nothing to report, and the drawer must
 * still render a neutral "not available" state rather than crash or imply a value.
 */
const ABSENT_TECHNICAL_DETAIL: RequestTechnicalDetail = Object.freeze({
  userRole: null,
  clientKind: null,
  featureArea: null,
  outcomeReason: null,
  spanCount: null,
  dbQueryCount: null,
  slowestSpanMillis: null,
  traceAvailable: false,
  logsAvailable: false,
});

/**
 * Typed client for the read-only Super Admin monitoring API.
 *
 * Every call is a `GET` against `/api/v1/admin/monitoring/**`, which the backend security
 * filter chain restricts to `ROLE_ADMIN`. The client never learns private Prometheus,
 * Alertmanager, Tempo or Elasticsearch endpoints. Request details may include browser-safe,
 * read-only Grafana/Kibana links assembled from trusted backend configuration.
 *
 * The service is deliberately thin — it owns the URL shape, the query parameters and the
 * normalisation of a nullable detail block. Filtering, sorting, pagination and every bound
 * are enforced server-side.
 */
@Injectable({ providedIn: 'root' })
export class MonitoringApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RUNTIME_CONFIG);
  private readonly baseUrl = `${this.config.apiBaseUrl}/admin/monitoring`;

  /** System health, telemetry freshness and active incidents. */
  getOverview(): Observable<MonitoringOverview> {
    return this.http.get<MonitoringOverview>(`${this.baseUrl}/overview`);
  }

  /** Request rate, 5xx rate, P95/P99, JVM and HikariCP metrics for a bounded window. */
  getPerformance(window: PerformanceWindow): Observable<MonitoringPerformance> {
    const params = new HttpParams().set('window', window);
    return this.http.get<MonitoringPerformance>(`${this.baseUrl}/performance`, { params });
  }

  /** Notification, MRS, audit and lifecycle backlogs. */
  getOperations(): Observable<MonitoringOperations> {
    return this.http.get<MonitoringOperations>(`${this.baseUrl}/operations`);
  }

  /** Current Alertmanager alert states and safe incident metadata (read-only). */
  getAlerts(): Observable<MonitoringAlerts> {
    return this.http.get<MonitoringAlerts>(`${this.baseUrl}/alerts`);
  }

  /**
   * One bounded page of request history.
   *
   * The query is passed through as validated, closed-set parameters only: the backend
   * sanitizes the free-text filters and ignores anything outside its enum. Empty filters are
   * omitted rather than sent blank so the backend applies its own default.
   */
  searchRequests(query: RequestSearchQuery): Observable<RequestPage> {
    let params = new HttpParams()
      .set('window', query.window)
      .set('outcome', query.outcome)
      .set('onlyFailed', String(query.onlyFailed))
      .set('onlySlow', String(query.onlySlow))
      .set('sort', query.sort)
      .set('direction', query.direction)
      .set('pageSize', String(query.pageSize));

    const endpoint = query.endpoint.trim();
    if (endpoint) {
      params = params.set('endpoint', endpoint);
    }
    const requestId = query.requestId.trim();
    if (requestId) {
      params = params.set('requestId', requestId);
    }
    if (query.cursor) {
      params = params.set('cursor', query.cursor);
    }

    return this.http.get<RequestPage>(`${this.baseUrl}/requests`, { params });
  }

  /** Allowlisted metadata lookup for a single request by its request ID. */
  getRequestDetail(requestId: string): Observable<RequestDetail> {
    return this.http
      .get<Omit<RequestDetail, 'detail'> & { detail: RequestTechnicalDetail | null }>(
        `${this.baseUrl}/requests/${encodeURIComponent(requestId)}`,
      )
      .pipe(
        map((response) => ({ ...response, detail: response.detail ?? ABSENT_TECHNICAL_DETAIL })),
      );
  }
}
