import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideNzIcons } from 'ng-zorro-antd/icon';

import { OMNICARE_ICONS } from '../../app.icons';
import { RUNTIME_CONFIG } from '../../core/config/runtime-config';
import {
  ClinicBootstrapResponse,
  ClinicCaseListItem,
  ClinicCaseQueueResponse,
} from './clinic-api.models';
import { ClinicContextStore } from './clinic-context.store';
import { ClinicIntakePage } from './clinic-intake-page';

const CLINIC_ID = 'clinic-a';
const CASE_ID = 'a1b2c3d4-1111-2222-3333-444455556666';
const CASES_URL = `/api/v1/clinics/${CLINIC_ID}/cases`;

describe('ClinicIntakePage', () => {
  let fixture: ComponentFixture<ClinicIntakePage>;
  let http: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    const context = {
      initialize: vi.fn(),
      selectedClinicId: signal<string | null>(CLINIC_ID),
      bootstrap: signal<ClinicBootstrapResponse | null>(bootstrap()),
    };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideNzIcons(OMNICARE_ICONS),
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: '/api/v1' } },
        { provide: ClinicContextStore, useValue: context },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  it('keeps page chrome visible while the real request queue is loading', () => {
    createPage();

    expect(text()).toContain('Requests');
    expect(text()).toContain('Manage incoming OmniCare requests for this clinic.');
    expect(fixture.nativeElement.querySelector('nz-skeleton')).toBeTruthy();

    queueRequest().flush(queue());
  });

  it('renders the backend status, priority, situation and current step independently', () => {
    createPage();
    queueRequest().flush(queue([caseItem()]));
    fixture.detectChanges();

    expect(text()).toContain('#A1B2C3D4');
    expect(text()).toContain('Amina Trabelsi');
    expect(text()).toContain('Urgent request');
    expect(text()).toContain('New');
    expect(text()).toContain('Critical');
    expect(text()).toContain('Administrative review');
    const viewLink = fixture.nativeElement.querySelector('.requests-table__action a') as HTMLAnchorElement;
    expect(viewLink.getAttribute('href')).toContain(`/clinic/requests/${CASE_ID}`);
  });

  it('uses URL query state to issue a server-side status filter', async () => {
    createPage();
    queueRequest().flush(queue([caseItem()]));

    await router.navigateByUrl('/?status=INFORMATION_REQUIRED');
    fixture.detectChanges();
    const request = queueRequest();
    expect(request.request.params.get('statuses')).toBe('INFORMATION_REQUIRED');
    expect(request.request.params.get('page')).toBe('0');
    request.flush(queue([], false));
  });

  it('uses the server Slice contract for next-page navigation', async () => {
    createPage();
    queueRequest().flush(queue([caseItem()], true));
    fixture.detectChanges();

    fixture.componentInstance.nextPage();
    await fixture.whenStable();
    fixture.detectChanges();
    const request = queueRequest();
    expect(request.request.params.get('page')).toBe('1');
    expect(request.request.params.get('pageSize')).toBe('20');
    request.flush(queue([], false, 1));
  });

  it('distinguishes an empty queue from a filtered empty result', async () => {
    createPage();
    queueRequest().flush(queue([]));
    fixture.detectChanges();
    expect(text()).toContain('No requests yet');

    await router.navigateByUrl('/?status=DECLINED');
    fixture.detectChanges();
    queueRequest().flush(queue([]));
    fixture.detectChanges();
    expect(text()).toContain('No requests match these filters');
    expect(text()).toContain('Clear filters');
  });

  it('shows a safe recoverable API error without raw ProblemDetail content', () => {
    createPage();
    queueRequest().flush(
      {
        errorCode: 'CLINIC_CONTEXT_UNAVAILABLE',
        detail: 'SQL and internal URL must never be rendered',
        requestId: 'internal-request-id',
      },
      { status: 500, statusText: 'Server Error' },
    );
    fixture.detectChanges();

    expect(text()).toContain("We couldn't load the request list");
    expect(text()).toContain('Try again');
    expect(text()).not.toContain('SQL and internal URL');
    expect(text()).not.toContain('internal-request-id');
  });

  function createPage(): void {
    fixture = TestBed.createComponent(ClinicIntakePage);
    fixture.detectChanges();
  }

  function queueRequest() {
    return http.expectOne((request) => request.url === CASES_URL);
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }
});

function bootstrap(): ClinicBootstrapResponse {
  return {
    contractVersion: '1.0',
    clinic: { clinicId: CLINIC_ID, clinicName: 'Clinique Les Oliviers', clinicStatus: 'ACTIVE' },
    membership: {
      membershipId: 'membership-a',
      membershipStatus: 'ACTIVE',
      professionalRole: 'CLINIC_ASSISTANT',
      version: 1,
    },
    capabilities: ['CLINIC_CASE_INTAKE_READ'],
    featureFlags: { CLINIC_REQUESTS_ENABLED: true },
    resolvedAt: '2026-08-11T10:00:00Z',
  };
}

function caseItem(overrides: Partial<ClinicCaseListItem> = {}): ClinicCaseListItem {
  return {
    clinicCaseId: CASE_ID,
    patientDisplayName: 'Amina Trabelsi',
    subjectType: 'SELF',
    relationship: null,
    situation: 'URGENT',
    administrativeStatus: 'RECEIVED',
    submittedAt: '2026-08-11T09:30:00Z',
    version: 3,
    priority: 'CRITICAL',
    currentStepKey: 'ADMINISTRATIVE_REVIEW',
    availableActions: [],
    hasOpenRoutingIncident: false,
    ...overrides,
  };
}

function queue(
  items: readonly ClinicCaseListItem[] = [],
  hasNext = false,
  page = 0,
): ClinicCaseQueueResponse {
  return {
    contractVersion: '1.0',
    items,
    page,
    pageSize: 20,
    hasNext,
    generatedAt: '2026-08-11T10:00:00Z',
  };
}
