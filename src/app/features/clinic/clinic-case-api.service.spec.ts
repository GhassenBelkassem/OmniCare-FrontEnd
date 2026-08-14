import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { RUNTIME_CONFIG } from '../../core/config/runtime-config';
import { ClinicApiService } from './clinic-api.service';

const CLINIC_ID = 'clinic-a';
const CASE_ID = 'case-1';
const CASES_URL = `/api/v1/clinics/${CLINIC_ID}/cases`;

describe('ClinicApiService case contract', () => {
  let api: ClinicApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: '/api/v1' } },
      ],
    });
    api = TestBed.inject(ClinicApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('serializes queue paging and multi-status filters for the active clinic id', () => {
    api.listCases(CLINIC_ID, {
      statuses: ['RECEIVED', 'INFORMATION_REQUIRED'],
      page: 2,
      pageSize: 50,
    }).subscribe();

    const request = http.expectOne((candidate) => candidate.url === CASES_URL);
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('statuses')).toBe('RECEIVED,INFORMATION_REQUIRED');
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('pageSize')).toBe('50');
    request.flush(queueResponse());
  });

  it('uses the case detail endpoint', () => {
    api.getCase(CLINIC_ID, CASE_ID).subscribe();

    const request = http.expectOne(`${CASES_URL}/${CASE_ID}`);
    expect(request.request.method).toBe('GET');
    request.flush(caseDetail());
  });

  it('sends expectedVersion to transition endpoints', () => {
    api.startReview(CLINIC_ID, CASE_ID, { expectedVersion: 3 }).subscribe();
    const start = http.expectOne(`${CASES_URL}/${CASE_ID}/review/start`);
    expect(start.request.method).toBe('POST');
    expect(start.request.body).toEqual({ expectedVersion: 3 });
    start.flush(caseDetail({ administrativeStatus: 'UNDER_ADMIN_REVIEW', version: 4 }));

    api.requestInformation(CLINIC_ID, CASE_ID, {
      expectedVersion: 4,
      reasonCode: 'AVAILABILITY_INFORMATION',
      patientInstruction: 'Please confirm which weekday you are available.',
    }).subscribe();
    const information = http.expectOne(`${CASES_URL}/${CASE_ID}/information-required`);
    expect(information.request.body).toEqual({
      expectedVersion: 4,
      reasonCode: 'AVAILABILITY_INFORMATION',
      patientInstruction: 'Please confirm which weekday you are available.',
    });
    information.flush(caseDetail({ administrativeStatus: 'INFORMATION_REQUIRED', version: 5 }));

    api.readyForPlanning(CLINIC_ID, CASE_ID, { expectedVersion: 5 }).subscribe();
    const ready = http.expectOne(`${CASES_URL}/${CASE_ID}/ready-for-planning`);
    expect(ready.request.body).toEqual({ expectedVersion: 5 });
    ready.flush(caseDetail({ administrativeStatus: 'READY_FOR_PLANNING', version: 6 }));
  });

  it('sends controlled decline reason with expectedVersion and propagates typed errors', () => {
    let failed = false;
    api.declineCase(CLINIC_ID, CASE_ID, {
      expectedVersion: 6,
      declineReasonCode: 'NO_CAPACITY',
    }).subscribe({ error: () => { failed = true; } });

    const request = http.expectOne(`${CASES_URL}/${CASE_ID}/decline`);
    expect(request.request.body).toEqual({
      expectedVersion: 6,
      declineReasonCode: 'NO_CAPACITY',
    });
    request.flush({ errorCode: 'CLINIC_CASE_VERSION_CONFLICT' }, { status: 409, statusText: 'Conflict' });
    expect(failed).toBe(true);
  });
});

function queueResponse() {
  return {
    contractVersion: '1.0',
    items: [caseListItem()],
    page: 0,
    pageSize: 20,
    hasNext: false,
    generatedAt: '2026-08-08T10:00:00Z',
  };
}

function caseListItem(overrides = {}) {
  return {
    clinicCaseId: CASE_ID,
    patientDisplayName: 'Amina Trabelsi',
    subjectType: 'SELF',
    relationship: null,
    situation: 'URGENT',
    administrativeStatus: 'RECEIVED',
    submittedAt: '2026-08-08T09:00:00Z',
    version: 3,
    priority: 'NORMAL',
    currentStepKey: 'ADMINISTRATIVE_REVIEW',
    availableActions: ['START_REVIEW'],
    hasOpenRoutingIncident: false,
    ...overrides,
  };
}

function caseDetail(overrides = {}) {
  return {
    ...caseListItem(),
    timeline: [
      {
        eventType: 'CASE_RECEIVED',
        previousStatus: null,
        newStatus: 'RECEIVED',
        occurredAt: '2026-08-08T09:00:00Z',
      },
    ],
    informationRequest: null,
    patientSummary: {
      displayName: 'Amina Trabelsi',
      subjectType: 'SELF',
      relationship: null,
    },
    openRoutingIncidents: [],
    ...overrides,
  };
}
