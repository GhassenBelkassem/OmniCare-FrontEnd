import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { BehaviorSubject } from 'rxjs';

import { OMNICARE_ICONS } from '../../app.icons';
import { RUNTIME_CONFIG } from '../../core/config/runtime-config';
import { ClinicBootstrapResponse, ClinicCaseDetail } from './clinic-api.models';
import { ClinicContextStore } from './clinic-context.store';
import { ClinicRequestDetailPage } from './clinic-request-detail-page';

const CLINIC_ID = 'clinic-a';
const CASE_ID = 'a1b2c3d4-1111-2222-3333-444455556666';
const DETAIL_URL = `/api/v1/clinics/${CLINIC_ID}/cases/${CASE_ID}`;

describe('ClinicRequestDetailPage', () => {
  let fixture: ComponentFixture<ClinicRequestDetailPage>;
  let http: HttpTestingController;

  beforeEach(() => {
    const params = new BehaviorSubject(convertToParamMap({ caseId: CASE_ID }));
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
        {
          provide: ActivatedRoute,
          useValue: { paramMap: params.asObservable(), snapshot: { paramMap: params.value } },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ClinicRequestDetailPage);
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  it('shows a stable loading state and then the normal operational detail', () => {
    expect(text()).toContain('Requests');
    expect(fixture.nativeElement.querySelector('nz-skeleton')).toBeTruthy();

    detailRequest().flush(detail());
    fixture.detectChanges();

    expect(text()).toContain('Request #A1B2C3D4');
    expect(text()).toContain('Amina Trabelsi');
    expect(text()).toContain('Urgent request');
    expect(text()).toContain('High priority');
    expect(text()).toContain('Administrative review');
    expect(text()).toContain('Request received');
    expect(text()).not.toContain('Medical history');
  });

  it('presents the information-required case as waiting without an unblock action', () => {
    detailRequest().flush(detail({
      administrativeStatus: 'INFORMATION_REQUIRED',
      informationRequest: {
        reasonCode: 'AVAILABILITY_INFORMATION',
        patientInstruction: 'Confirm an available weekday.',
        responseType: 'AVAILABILITY_WINDOWS',
        status: 'OPEN',
        responseSummary: null,
      },
    }));
    fixture.detectChanges();

    expect(text()).toContain('Waiting for patient information');
    expect(text()).toContain('Processing will resume when the response is received.');
    expect(text()).toContain('Confirm an available weekday.');
    expect(text()).not.toContain('Unblock');
  });

  it('presents terminal cases without mutation actions', () => {
    detailRequest().flush(detail({ administrativeStatus: 'DECLINED' }));
    fixture.detectChanges();

    expect(text()).toContain('Terminal state');
    expect(text()).toContain('This request is no longer active.');
    expect(text()).not.toContain('Start review');
    expect(text()).not.toContain('Ready for planning');
  });

  it('renders an anti-enumeration-safe not-found state', () => {
    detailRequest().flush(
      { errorCode: 'CLINIC_CASE_NOT_FOUND', detail: 'Case exists in another clinic.' },
      { status: 404, statusText: 'Not Found' },
    );
    fixture.detectChanges();

    expect(text()).toContain('Request not found');
    expect(text()).toContain('unavailable or you do not have access');
    expect(text()).not.toContain('another clinic');
  });

  it('maps the backend current step rather than deriving it from case status', () => {
    detailRequest().flush(detail({
      administrativeStatus: 'RECEIVED',
      currentStepKey: 'REQUEST_COORDINATION',
    }));
    fixture.detectChanges();

    expect(text()).toContain('Request coordination');
    expect(text()).toContain('New');
  });

  it('surfaces only backend-provided Phase-2 actions and sends the authoritative version', () => {
    detailRequest().flush(detail({ availableActions: ['START_REVIEW'] }));
    fixture.detectChanges();

    const start = Array.from(fixture.nativeElement.querySelectorAll('button')).find(
      (button) => (button as HTMLButtonElement).textContent?.includes('Start review'),
    ) as HTMLButtonElement;
    start.click();
    const mutation = http.expectOne(`${DETAIL_URL}/review/start`);
    expect(mutation.request.body).toEqual({ expectedVersion: 3 });
    mutation.flush(detail({ administrativeStatus: 'UNDER_ADMIN_REVIEW', availableActions: [] }));
    http.expectOne(DETAIL_URL).flush(detail({ availableActions: [] }));
    fixture.detectChanges();

    expect(text()).not.toContain('Request information');
    expect(text()).not.toContain('Decline request');
  });

  function detailRequest() {
    return http.expectOne(DETAIL_URL);
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
      professionalRole: 'CLINIC_ADMIN',
      version: 1,
    },
    capabilities: ['CLINIC_CASE_INTAKE_READ', 'CLINIC_CASE_INTAKE_REVIEW'],
    featureFlags: { CLINIC_REQUESTS_ENABLED: true },
    resolvedAt: '2026-08-11T10:00:00Z',
  };
}

function detail(overrides: Partial<ClinicCaseDetail> = {}): ClinicCaseDetail {
  return {
    clinicCaseId: CASE_ID,
    patientDisplayName: 'Amina Trabelsi',
    subjectType: 'SELF',
    relationship: null,
    situation: 'URGENT',
    administrativeStatus: 'UNDER_ADMIN_REVIEW',
    submittedAt: '2026-08-11T09:30:00Z',
    version: 3,
    priority: 'HIGH',
    currentStepKey: 'ADMINISTRATIVE_REVIEW',
    availableActions: [],
    timeline: [
      {
        eventType: 'CASE_RECEIVED',
        previousStatus: null,
        newStatus: 'RECEIVED',
        occurredAt: '2026-08-11T09:30:00Z',
      },
    ],
    informationRequest: null,
    patientSummary: { displayName: 'Amina Trabelsi', subjectType: 'SELF', relationship: null },
    openRoutingIncidents: [],
    ...overrides,
  };
}
