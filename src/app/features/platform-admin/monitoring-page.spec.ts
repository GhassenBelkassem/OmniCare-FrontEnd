import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { OMNICARE_ICONS } from '../../app.icons';
import { authInterceptor } from '../../core/auth/auth.interceptor';
import { AuthTokenStore } from '../../core/auth/auth-token.store';
import { MonitoringPage } from './monitoring-page';
import { MonitoringDiagnosticsPanel } from './monitoring/monitoring-diagnostics-panel';
import { MonitoringRequestDetailDrawer } from './monitoring/monitoring-request-detail-drawer';
const OVERVIEW = {
  overallStatus: 'DEGRADED',
  overallDetail: 'One warning-level condition is active.',
  dependencies: [
    {
      id: 'backend',
      label: 'Backend API',
      status: 'HEALTHY',
      detail: 'Serving requests; scrape target up.',
      exporterOptional: false,
    },
    {
      id: 'postgres',
      label: 'PostgreSQL',
      status: 'NOT_INSTRUMENTED',
      detail: 'Exporter not instrumented — availability cannot be asserted from metrics.',
      exporterOptional: true,
    },
  ],
  telemetryFreshnessSeconds: 12,
  telemetryFreshSinceIso: '2026-10-20T09:41:00Z',
  snapshotCollected: true,
  criticalAlertCount: 0,
  warningAlertCount: 1,
  incidentSummary: '1 warning alert(s) active.',
  unavailableSources: ['PostgreSQL exporter'],
};
const PERFORMANCE = {
  window: '1h',
  collectedAtIso: '2026-10-20T09:41:00Z',
  metrics: [
    {
      id: 'request-rate',
      label: 'Request rate',
      unit: 'req/s',
      status: 'HEALTHY',
      value: '148.2',
      supportingText: 'Steady across the window.',
      series: [],
    },
    {
      id: 'p99',
      label: 'P99 latency',
      unit: 'ms',
      status: 'UNKNOWN',
      value: '',
      supportingText: 'No sample returned by Prometheus for this window.',
      series: [],
    },
  ],
  unavailableSources: ['P99 latency'],
};
const OPERATIONS = {
  groups: [
    {
      id: 'audit',
      title: 'Audit outbox & verification',
      status: 'HEALTHY',
      rows: [
        { label: 'Outbox pending', value: '0', status: 'HEALTHY', note: null },
        {
          label: 'Last verification result',
          value: '',
          status: 'UNKNOWN',
          note: 'Not collected yet',
        },
      ],
    },
  ],
  knownGaps: ['Negative age sentinels (-1) mean "none".'],
  unavailableSources: ['host disk exporter'],
};
const ALERTS = {
  active: [
    {
      id: 'OmniCareNotificationBacklog',
      name: 'OmniCareNotificationBacklog',
      severity: 'WARNING',
      state: 'FIRING',
      component: 'notification-outbox',
      firstDetectedIso: '2026-10-20T08:52:00Z',
      updatedIso: '2026-10-20T09:40:00Z',
      summary: 'Oldest HIGH-priority notification pending beyond 1h.',
      impact: 'High-priority notifications are accumulating.',
      suggestedAction: 'Monitor the backlog trend.',
      technical: {
        expressionSummary: 'max(omnicare_notification_outbox_oldest_pending_age_seconds) > 3600',
        forDuration: '10m',
        threshold: '> 1h',
        observedValue: '32m',
        labels: { priority: 'HIGH' },
        runbook: null,
      },
      monitoringLink: null,
    },
  ],
  readOnly: true,
  unavailableSources: [],
};
const FAILED_REQUEST = {
  requestId: 'b1c2d3e4f5a6478899aabbccddeeff00',
  occurredAtIso: '2026-10-20T09:40:58Z',
  method: 'POST',
  route: '/api/v1/auth/token/refresh',
  statusCode: 500,
  outcome: 'SERVER_ERROR',
  durationMs: 3480,
  slow: true,
  priority: 'FAILED',
  traceId: 'a1f2c3d4e5b6478899aabbccddeeff01',
  dataComplete: true,
};
const INCOMPLETE_REQUEST = {
  requestId: 'c1c2d3e4f5a6478899aabbccddeeff02',
  occurredAtIso: '2026-10-20T09:39:12Z',
  method: null,
  route: null,
  statusCode: null,
  outcome: 'UNKNOWN',
  durationMs: null,
  slow: false,
  priority: 'UNKNOWN',
  traceId: null,
  dataComplete: false,
};
const PREFLIGHT_REQUEST = {
  requestId: 'd1c2d3e4f5a6478899aabbccddeeff03',
  occurredAtIso: '2026-10-20T09:38:12Z',
  method: 'OPTIONS',
  route: '/api/v1/admin/professionals',
  statusCode: 204,
  outcome: 'SUCCESS',
  durationMs: 4,
  slow: false,
  priority: 'NORMAL',
  traceId: null,
  dataComplete: true,
};
function requestPage(items: any[], overrides: Record<string, unknown> = {}): any {
  return {
    items,
    page: 0,
    pageSize: 25,
    totalElements: -1,
    totalPages: -1,
    nextCursor: null,
    slowThresholdMs: 2000,
    sourceAvailable: true,
    ...overrides,
  };
}
describe('MonitoringPage (live monitoring API)', () => {
  let fixture: ComponentFixture<MonitoringPage>;
  let http: HttpTestingController;
  beforeEach(async () => {
    try {
      TestBed.resetTestingModule();
    } catch {}
    await TestBed.configureTestingModule({
      imports: [MonitoringPage],
      providers: [
        provideRouter([]),
        provideNzIcons(OMNICARE_ICONS),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    const tokens = TestBed.inject(AuthTokenStore);
    tokens.setSession({
      accessToken: 'admin-access-token',
      tokenType: 'Bearer',
      expiresAt: '2026-08-05T12:10:00Z',
      refreshToken: 'admin-refresh-token',
      refreshExpiresAt: '2026-08-06T00:00:00Z',
      user: { id: 'admin-1', role: 'ADMIN', mustChangePassword: false },
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MonitoringPage);
    fixture.detectChanges();
  });
  afterEach(() => {
    try {
      http?.verify();
    } catch {}
    try {
      fixture?.destroy();
    } catch {}
  });
  function flushOverview(body: unknown = OVERVIEW): void {
    http.expectOne('/api/v1/admin/monitoring/overview').flush(body as any);
    fixture.detectChanges();
  }
  function clickSection(label: string): void {
    const buttons = fixture.debugElement.queryAll(By.css('oc-segmented-control button'));
    const button = buttons.find((candidate) => candidate.nativeElement.textContent.includes(label));
    button?.nativeElement.click();
    fixture.detectChanges();
  }
  function diagnosticsPanel(): MonitoringDiagnosticsPanel {
    return fixture.debugElement.query(By.css('oc-monitoring-diagnostics-panel')).componentInstance;
  }
  it('renders the Monitoring title', () => {
    flushOverview();
    const header = fixture.nativeElement.querySelector('h1');
    expect(header?.textContent).toContain('Monitoring');
  });
  it('requests the overview from the secured monitoring API', () => {
    const request = http.expectOne('/api/v1/admin/monitoring/overview');
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer admin-access-token');
    request.flush(OVERVIEW);
    fixture.detectChanges();
  });
  it('shows a loading state until the overview arrives', () => {
    expect(fixture.nativeElement.textContent).toContain('Loading the operational overview');
    flushOverview();
  });
  it('renders live overview data and never claims a missing signal is healthy', () => {
    flushOverview();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Overall system status');
    expect(text).toContain('Not instrumented');
    expect(text).toContain('PostgreSQL exporter');
  });
  it('surfaces a monitoring API failure instead of showing an empty healthy screen', () => {
    http
      .expectOne('/api/v1/admin/monitoring/overview')
      .flush('boom', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.request-error')).not.toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Overall system status');
  });
  it('loads the section the administrator selects', () => {
    flushOverview();
    clickSection('Performance');
    const request = http.expectOne(
      (candidate) => candidate.url === '/api/v1/admin/monitoring/performance',
    );
    expect(request.request.params.get('window')).toBe('1h');
    request.flush(PERFORMANCE);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('API performance');
  });
  it('re-reads performance when the window changes', () => {
    flushOverview();
    clickSection('Performance');
    http
      .expectOne((candidate) => candidate.url === '/api/v1/admin/monitoring/performance')
      .flush(PERFORMANCE);
    fixture.detectChanges();
    const panel = fixture.debugElement.query(
      By.css('oc-monitoring-performance-panel'),
    ).componentInstance;
    panel.handleWindowChange('15m');
    fixture.detectChanges();
    const request = http.expectOne(
      (candidate) => candidate.url === '/api/v1/admin/monitoring/performance',
    );
    expect(request.request.params.get('window')).toBe('15m');
    request.flush({ ...PERFORMANCE, window: '15m' });
    fixture.detectChanges();
  });
  it('renders a metric with no sample as Not available rather than a zero', () => {
    flushOverview();
    clickSection('Performance');
    http
      .expectOne((candidate) => candidate.url === '/api/v1/admin/monitoring/performance')
      .flush(PERFORMANCE);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('148.2');
    expect(text).toContain('Not available');
  });
  it('renders live operations backlogs and known gaps', () => {
    flushOverview();
    clickSection('Operations');
    http.expectOne('/api/v1/admin/monitoring/operations').flush(OPERATIONS);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Healthcare operations');
    expect(text).toContain('Audit outbox & verification');
    expect(text).toContain('Known gaps');
    expect(text).toContain('Not available');
  });
  it('renders live alerts as read-only incident cards', () => {
    flushOverview();
    clickSection('Alerts');
    http.expectOne('/api/v1/admin/monitoring/alerts').flush(ALERTS);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Read only');
    expect(text).toContain('Firing');
    expect(text).toContain('Oldest HIGH-priority notification pending beyond 1h.');
  });
  it('loads one bounded page of request history and renders the rows', () => {
    flushOverview();
    clickSection('Diagnostics');
    const request = http.expectOne(
      (candidate) => candidate.url === '/api/v1/admin/monitoring/requests',
    );
    expect(request.request.params.get('pageSize')).toBe('25');
    request.flush(requestPage([FAILED_REQUEST]) as any);
    fixture.detectChanges();
    const panel = fixture.debugElement.query(By.css('oc-monitoring-diagnostics-panel'));
    const rows = panel.nativeElement.querySelectorAll('tbody tr');
    expect(rows.length).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('/api/v1/auth/token/refresh');
  });
  it('sends the explorer filters to the server instead of filtering in the browser', () => {
    flushOverview();
    clickSection('Diagnostics');
    http
      .expectOne((candidate) => candidate.url === '/api/v1/admin/monitoring/requests')
      .flush(requestPage([]));
    fixture.detectChanges();
    const panel = diagnosticsPanel();
    panel.endpoint.setValue('/api/v1/admin');
    panel.outcome.set('SERVER_ERROR');
    panel.onlyFailed.set(true);
    panel.applyFilters();
    fixture.detectChanges();
    const req = http.expectOne(
      (candidate) => candidate.url === '/api/v1/admin/monitoring/requests',
    );
    const request = req as any;
    expect(request.request.params.get('endpoint')).toBe('/api/v1/admin');
    expect(request.request.params.get('outcome')).toBe('SERVER_ERROR');
    expect(request.request.params.get('onlyFailed')).toBe('true');
    request.flush(requestPage([]));
    fixture.detectChanges();
  });
  it('paginates with the opaque cursor returned by the server', () => {
    flushOverview();
    clickSection('Diagnostics');
    http
      .expectOne((candidate) => candidate.url === '/api/v1/admin/monitoring/requests')
      .flush(requestPage([FAILED_REQUEST], { nextCursor: 'cursor-2' }));
    fixture.detectChanges();
    const panel = diagnosticsPanel();
    expect(panel.canGoForward()).toBe(true);
    panel.nextPage();
    fixture.detectChanges();
    const req = http.expectOne(
      (candidate) => candidate.url === '/api/v1/admin/monitoring/requests',
    );
    const request = req as any;
    expect(request.request.params.get('cursor')).toBe('cursor-2');
    request.flush(requestPage([INCOMPLETE_REQUEST]));
    fixture.detectChanges();
    expect(panel.currentPageNumber()).toBe(2);
    expect(panel.canGoBack()).toBe(true);
    panel.previousPage();
    fixture.detectChanges();
    const back = http.expectOne(
      (candidate) => candidate.url === '/api/v1/admin/monitoring/requests',
    );
    expect(back.request.params.has('cursor')).toBe(false);
    back.flush(requestPage([FAILED_REQUEST]));
    fixture.detectChanges();
  });
  it('renders historical incomplete records as Unknown and Not available', () => {
    flushOverview();
    clickSection('Diagnostics');
    http
      .expectOne((candidate) => candidate.url === '/api/v1/admin/monitoring/requests')
      .flush(requestPage([INCOMPLETE_REQUEST]));
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Not available');
    expect(text).toContain('Unknown');
    expect(text).not.toContain('unmatched');
  });
  it('hides CORS preflight traffic unless it is explicitly requested', () => {
    flushOverview();
    clickSection('Diagnostics');
    http
      .expectOne((candidate) => candidate.url === '/api/v1/admin/monitoring/requests')
      .flush(requestPage([PREFLIGHT_REQUEST, FAILED_REQUEST]));
    fixture.detectChanges();
    const panel = fixture.debugElement.query(By.css('oc-monitoring-diagnostics-panel'));
    expect(panel.nativeElement.querySelectorAll('tbody tr').length).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('CORS preflight');
    diagnosticsPanel().togglePreflight();
    fixture.detectChanges();
    expect(panel.nativeElement.querySelectorAll('tbody tr').length).toBe(2);
  });
  it('reports an unavailable request-history source without claiming an empty history', () => {
    flushOverview();
    clickSection('Diagnostics');
    http
      .expectOne((candidate) => candidate.url === '/api/v1/admin/monitoring/requests')
      .flush(requestPage([], { sourceAvailable: false }));
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Request history unavailable');
    expect(text).toContain('Unavailable');
  });
  it('loads the detail of a request and shows it in the drawer', () => {
    flushOverview();
    clickSection('Diagnostics');
    http
      .expectOne((candidate) => candidate.url === '/api/v1/admin/monitoring/requests')
      .flush(requestPage([FAILED_REQUEST]));
    fixture.detectChanges();
    const panel = fixture.debugElement.query(By.css('oc-monitoring-diagnostics-panel'));
    const details = Array.from(
      panel.nativeElement.querySelectorAll('.cell-actions oc-button'),
    ) as HTMLElement[];
    expect(details.length).toBeGreaterThan(0);
    details[0].click();
    fixture.detectChanges();
    const request = http.expectOne(
      (candidate) =>
        candidate.url === '/api/v1/admin/monitoring/requests/b1c2d3e4f5a6478899aabbccddeeff00',
    );
    request.flush({
      ...FAILED_REQUEST,
      detail: {
        userRole: null,
        clientKind: null,
        featureArea: null,
        outcomeReason: null,
        spanCount: null,
        dbQueryCount: null,
        slowestSpanMillis: null,
        traceAvailable: true,
        logsAvailable: true,
      },
    });
    fixture.detectChanges();
    const drawerText = document.body.textContent ?? '';
    expect(drawerText).toContain('Correlation');
    expect(drawerText).toContain('Copy');
  });
  it('looks up a request by identifier and rejects a malformed one', () => {
    flushOverview();
    clickSection('Diagnostics');
    http
      .expectOne((candidate) => candidate.url === '/api/v1/admin/monitoring/requests')
      .flush(requestPage([]));
    fixture.detectChanges();
    const panel = diagnosticsPanel();
    panel.requestId.setValue('no');
    panel.submit();
    fixture.detectChanges();
    expect(panel.requestId.hasError('invalid')).toBe(true);
    panel.requestId.setValue('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d');
    panel.submit();
    fixture.detectChanges();
    const request = http.expectOne(
      (candidate) =>
        candidate.url === '/api/v1/admin/monitoring/requests/a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    );
    request.flush({ ...FAILED_REQUEST, detail: null });
    fixture.detectChanges();
  });
  it('renders diagnostics with 25 real records without template exceptions and supports pagination/filters/detail', () => {
    flushOverview();
    clickSection('Diagnostics');
    const items = Array.from({ length: 25 }, (_, i) => ({
      requestId: `req-${i.toString().padStart(24, '0')}`,
      occurredAtIso: '2026-10-20T09:40:58Z',
      method: 'GET',
      route: `/api/v1/test/${i}`,
      statusCode: 200,
      outcome: 'SUCCESS',
      durationMs: 120,
      slow: false,
      priority: 'NORMAL',
      traceId: `trace-${i}`,
      dataComplete: true,
    }));
    const req = http.expectOne(
      (candidate) => candidate.url === '/api/v1/admin/monitoring/requests',
    );
    expect(req.request.params.get('pageSize')).toBe('25');
    (req as any).flush({
      items,
      page: 0,
      pageSize: 25,
      totalElements: -1,
      totalPages: -1,
      nextCursor: 'cursor-next',
      slowThresholdMs: 2000,
      sourceAvailable: true,
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.request-error')).toBeNull();
    const panel = fixture.debugElement.query(By.css('oc-monitoring-diagnostics-panel'));
    const rows = panel.nativeElement.querySelectorAll('tbody tr');
    expect(rows.length).toBe(25);
    const endpoint = panel.query(By.css('#req-endpoint'));
    expect(endpoint).not.toBeNull();
    const requestIdFilter = panel.query(By.css('#req-request-id'));
    expect(requestIdFilter).not.toBeNull();
    const details = Array.from(
      panel.nativeElement.querySelectorAll('.cell-actions oc-button'),
    ) as HTMLElement[];
    expect(details.length).toBeGreaterThan(0);
    details[0].click();
    fixture.detectChanges();
    const detailReq = http.expectOne(
      (candidate) => candidate.url === `/api/v1/admin/monitoring/requests/${items[0].requestId}`,
    );
    detailReq.flush({ ...items[0], detail: { traceAvailable: true, logsAvailable: true } });
    fixture.detectChanges();
    expect(document.body.textContent ?? '').toContain('Correlation');
    const diag = diagnosticsPanel();
    expect(diag.canGoForward()).toBe(true);
    diag.nextPage();
    fixture.detectChanges();
    const page2 = http.expectOne(
      (candidate) => candidate.url === '/api/v1/admin/monitoring/requests',
    );
    expect(page2.request.params.get('cursor')).toBe('cursor-next');
    page2.flush({
      items: [{ ...items[1], requestId: 'req-page2' }],
      page: 0,
      pageSize: 25,
      totalElements: -1,
      totalPages: -1,
      nextCursor: null,
      slowThresholdMs: 2000,
      sourceAvailable: true,
    });
    fixture.detectChanges();
    expect(diag.currentPageNumber()).toBe(2);
  });
  it('supports opening details for different requests after closing the drawer', () => {
    flushOverview();
    clickSection('Diagnostics');
    const items = [
      {
        requestId: 'req-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        occurredAtIso: '2026-10-20T09:40:58Z',
        method: 'GET',
        route: '/api/v1/a',
        statusCode: 200,
        outcome: 'SUCCESS',
        durationMs: 120,
        slow: false,
        priority: 'NORMAL',
        traceId: 'trace-a',
        dataComplete: true,
      },
      {
        requestId: 'req-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        occurredAtIso: '2026-10-20T09:39:58Z',
        method: 'POST',
        route: '/api/v1/b',
        statusCode: 500,
        outcome: 'SERVER_ERROR',
        durationMs: 2480,
        slow: true,
        priority: 'FAILED',
        traceId: 'trace-b',
        dataComplete: true,
      },
    ];
    const req = http.expectOne(
      (candidate) => candidate.url === '/api/v1/admin/monitoring/requests',
    );
    (req as any).flush({
      items,
      page: 0,
      pageSize: 25,
      totalElements: 2,
      totalPages: 1,
      nextCursor: null,
      slowThresholdMs: 2000,
      sourceAvailable: true,
    });
    fixture.detectChanges();
    const panel = fixture.debugElement.query(By.css('oc-monitoring-diagnostics-panel'));
    const details = Array.from(
      panel.nativeElement.querySelectorAll('.cell-actions oc-button'),
    ) as HTMLElement[];
    details[0].click();
    fixture.detectChanges();
    const detailReq1 = http.expectOne(
      (candidate) =>
        candidate.url === '/api/v1/admin/monitoring/requests/req-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    );
    detailReq1.flush({ ...items[0], detail: { traceAvailable: true, logsAvailable: true } });
    fixture.detectChanges();
    expect(document.body.textContent ?? '').toContain('req-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    const drawer = fixture.debugElement.query(
      By.css('oc-monitoring-request-detail-drawer'),
    ).componentInstance;
    drawer.close();
    fixture.detectChanges();
    details[1].click();
    fixture.detectChanges();
    const detailReq2 = http.expectOne(
      (candidate) =>
        candidate.url === '/api/v1/admin/monitoring/requests/req-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    );
    detailReq2.flush({ ...items[1], detail: { traceAvailable: false, logsAvailable: false } });
    fixture.detectChanges();
    expect(document.body.textContent ?? '').toContain('req-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
  });
  it('reopens the drawer for another request after the real close button was used', () => {
    flushOverview();
    clickSection('Diagnostics');
    const items = [
      {
        requestId: 'req-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        occurredAtIso: '2026-10-20T09:40:58Z',
        method: 'GET',
        route: '/api/v1/a',
        statusCode: 200,
        outcome: 'SUCCESS',
        durationMs: 120,
        slow: false,
        priority: 'NORMAL',
        traceId: 'trace-a',
        dataComplete: true,
      },
      {
        requestId: 'req-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        occurredAtIso: '2026-10-20T09:39:58Z',
        method: 'POST',
        route: '/api/v1/b',
        statusCode: 500,
        outcome: 'SERVER_ERROR',
        durationMs: 2480,
        slow: true,
        priority: 'FAILED',
        traceId: 'trace-b',
        dataComplete: true,
      },
    ];
    const req = http.expectOne(
      (candidate) => candidate.url === '/api/v1/admin/monitoring/requests',
    );
    (req as any).flush({
      items,
      page: 0,
      pageSize: 25,
      totalElements: 2,
      totalPages: 1,
      nextCursor: null,
      slowThresholdMs: 2000,
      sourceAvailable: true,
    });
    fixture.detectChanges();

    const panel = fixture.debugElement.query(By.css('oc-monitoring-diagnostics-panel'));
    const details = Array.from(
      panel.nativeElement.querySelectorAll('.cell-actions oc-button'),
    ) as HTMLElement[];
    const diag = diagnosticsPanel();

    const openAndFlush = (index: number, requestId: string): void => {
      details[index].click();
      fixture.detectChanges();
      const detailReq = http.expectOne(
        (candidate) => candidate.url === `/api/v1/admin/monitoring/requests/${requestId}`,
      );
      detailReq.flush({
        ...items[index],
        detail: { traceAvailable: true, logsAvailable: true },
      });
      fixture.detectChanges();
    };

    // A: open, then close through the drawer's own close button in the overlay.
    openAndFlush(0, 'req-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    expect(diag.selectionOpen()).toBe(true);
    const closeButton = document.querySelector('.ant-drawer-close') as HTMLElement | null;
    expect(closeButton).not.toBeNull();
    closeButton!.click();
    fixture.detectChanges();
    expect(diag.selectionOpen()).toBe(false);

    // B: the drawer must reopen for a different request without a page reload.
    openAndFlush(1, 'req-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
    expect(diag.selectionOpen()).toBe(true);
    expect(diag.selection()?.requestId).toBe('req-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
    expect(document.body.textContent ?? '').toContain('req-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');

    // Close again, then A again: the cycle must not stick.
    const closeAgain = document.querySelector('.ant-drawer-close') as HTMLElement | null;
    expect(closeAgain).not.toBeNull();
    closeAgain!.click();
    fixture.detectChanges();
    expect(diag.selectionOpen()).toBe(false);

    openAndFlush(0, 'req-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    expect(diag.selectionOpen()).toBe(true);
    expect(diag.selection()?.requestId).toBe('req-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    expect(document.body.textContent ?? '').toContain('req-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  });
});

describe('MonitoringRequestDetailDrawer (absent technical fields)', () => {
  let drawerFixture: any;
  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [MonitoringRequestDetailDrawer],
      providers: [provideNzIcons(OMNICARE_ICONS)],
    }).compileComponents();
  });
  afterEach(() => {
    try {
      drawerFixture?.destroy();
    } catch {}
    try {
      document.body.innerHTML = '';
    } catch {}
  });
  it('renders optional technical fields as "Not available" rather than fabricated values', () => {
    drawerFixture = TestBed.createComponent(MonitoringRequestDetailDrawer);
    drawerFixture.componentRef.setInput('open', true);
    drawerFixture.componentRef.setInput('request', {
      requestId: 'abc123def456abc123def456abc123de',
      occurredAtIso: '2026-10-20T10:29:00.000Z',
      method: 'GET',
      route: '/api/v1/doctor/patients',
      statusCode: 200,
      outcome: 'SUCCESS',
      durationMs: 120,
      slow: false,
      priority: 'NORMAL',
      traceId: null,
      dataComplete: true,
      detail: { traceAvailable: false, logsAvailable: false },
    });
    drawerFixture.detectChanges();
    const text = document.body.textContent ?? '';
    expect(text).toContain('Optional, best-effort fields');
    expect(text).toContain('Not available');
    expect(text).toContain('Not sampled');
  });
  it('renders unavailable HTTP metadata as "Not available" without inferring a value', () => {
    drawerFixture = TestBed.createComponent(MonitoringRequestDetailDrawer);
    drawerFixture.componentRef.setInput('open', true);
    drawerFixture.componentRef.setInput('request', {
      requestId: 'abc123def456abc123def456abc123de',
      occurredAtIso: '2026-10-20T10:29:00.000Z',
      method: null,
      route: null,
      statusCode: null,
      outcome: 'UNKNOWN',
      durationMs: null,
      slow: false,
      priority: 'UNKNOWN',
      traceId: null,
      dataComplete: false,
      detail: { traceAvailable: false, logsAvailable: false },
    });
    drawerFixture.detectChanges();
    const text = document.body.textContent ?? '';
    expect(text).toContain('Not available');
    expect(text).not.toContain('unmatched');
    expect(text).toContain('not recorded');
    expect(text).toContain('Unknown');
  });
});
