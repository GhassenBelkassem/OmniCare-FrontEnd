import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { RUNTIME_CONFIG } from '../../core/config/runtime-config';
import { ClinicApiService } from './clinic-api.service';

const CLINIC_ID = 'clinic-a';
const TASK_ID = 'task-a';
const TASKS_URL = `/api/v1/clinics/${CLINIC_ID}/tasks`;

describe('ClinicApiService task contract', () => {
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

  it('uses the backend position queue and My Tasks Slice endpoints with paging', () => {
    api.listPositionQueue(CLINIC_ID, { page: 2, pageSize: 50, status: 'ASSIGNED' }).subscribe();
    const queue = http.expectOne((request) => request.url === `${TASKS_URL}/position-queue`);
    expect(queue.request.params.get('page')).toBe('2');
    expect(queue.request.params.get('pageSize')).toBe('50');
    expect(queue.request.params.get('status')).toBe('ASSIGNED');
    queue.flush(taskPage());

    api.listMyTasks(CLINIC_ID, { page: 1, pageSize: 20 }).subscribe();
    const my = http.expectOne((request) => request.url === `${TASKS_URL}/my`);
    expect(my.request.method).toBe('GET');
    expect(my.request.params.get('page')).toBe('1');
    my.flush(taskPage());
  });

  it('sends authoritative expectedVersion to acknowledge and start', () => {
    api.acknowledgeTask(CLINIC_ID, TASK_ID, { expectedVersion: 7 }).subscribe();
    const acknowledge = http.expectOne(`${TASKS_URL}/${TASK_ID}/acknowledge`);
    expect(acknowledge.request.method).toBe('POST');
    expect(acknowledge.request.body).toEqual({ expectedVersion: 7 });
    acknowledge.flush(taskDetail());

    api.startTask(CLINIC_ID, TASK_ID, { expectedVersion: 8 }).subscribe();
    const start = http.expectOne(`${TASKS_URL}/${TASK_ID}/start`);
    expect(start.request.body).toEqual({ expectedVersion: 8 });
    start.flush(taskDetail({ status: 'IN_PROGRESS', version: 9 }));
  });

  it('uses the production generic block, unblock, and completion command contracts', () => {
    api
      .blockTask(CLINIC_ID, TASK_ID, {
        reasonCode: 'WAITING_FOR_INTERNAL_COORDINATION',
        expectedVersion: 9,
      })
      .subscribe();
    const block = http.expectOne(`${TASKS_URL}/${TASK_ID}/block`);
    expect(block.request.method).toBe('POST');
    expect(block.request.body).toEqual({
      reasonCode: 'WAITING_FOR_INTERNAL_COORDINATION',
      expectedVersion: 9,
    });
    block.flush(taskDetail({ status: 'BLOCKED', version: 10 }));

    api.unblockTask(CLINIC_ID, TASK_ID, { expectedVersion: 10 }).subscribe();
    const unblock = http.expectOne(`${TASKS_URL}/${TASK_ID}/unblock`);
    expect(unblock.request.body).toEqual({ expectedVersion: 10 });
    unblock.flush(taskDetail({ status: 'IN_PROGRESS', version: 11 }));

    api.completeTask(CLINIC_ID, TASK_ID, { expectedVersion: 11 }).subscribe();
    const complete = http.expectOne(`${TASKS_URL}/${TASK_ID}/complete`);
    expect(complete.request.body).toEqual({ expectedVersion: 11 });
    complete.flush(taskDetail({ status: 'COMPLETED', version: 12 }));
  });

  it('reassigns only to a position and loads active position candidates', () => {
    api
      .reassignTask(CLINIC_ID, TASK_ID, {
        targetPositionId: 'position-b',
        expectedVersion: 9,
      })
      .subscribe();
    const reassign = http.expectOne(`${TASKS_URL}/${TASK_ID}/reassign`);
    expect(reassign.request.body).toEqual({ targetPositionId: 'position-b', expectedVersion: 9 });
    expect(reassign.request.body).not.toHaveProperty('membershipId');
    reassign.flush(taskDetail());

    api.listActivePositions(CLINIC_ID).subscribe();
    const positions = http.expectOne((request) => request.url.endsWith('/positions'));
    expect(positions.request.params.get('active')).toBe('true');
    expect(positions.request.params.get('pageSize')).toBe('100');
    positions.flush({
      contractVersion: '1.0',
      items: [],
      page: 0,
      pageSize: 100,
      hasNext: false,
      generatedAt: '2026-08-11T10:00:00Z',
    });
  });

  it('uses Clinic-scoped detail and preserves safe not-found errors', () => {
    let status = 0;
    api.getTask(CLINIC_ID, TASK_ID).subscribe({
      error: (error) => {
        status = error.status;
      },
    });
    const request = http.expectOne(`${TASKS_URL}/${TASK_ID}`);
    request.flush({ errorCode: 'CLINIC_TASK_NOT_FOUND' }, { status: 404, statusText: 'Not Found' });
    expect(status).toBe(404);
  });

  it('uses the paged, server-filtered routing incident contract and retry command', () => {
    api.listRoutingIncidents(CLINIC_ID, {
      status: 'RESOLVED', type: 'TASK_COMPLETION_OVERDUE', page: 2, size: 20,
    }).subscribe();
    const list = http.expectOne((request) => request.url === `/api/v1/clinics/${CLINIC_ID}/routing-incidents`);
    expect(list.request.params.get('status')).toBe('RESOLVED');
    expect(list.request.params.get('type')).toBe('TASK_COMPLETION_OVERDUE');
    expect(list.request.params.get('page')).toBe('2');
    expect(list.request.params.get('size')).toBe('20');
    list.flush({ items: [], page: 2, pageSize: 20, hasNext: false, generatedAt: '2026-08-12T10:00:00Z' });

    api.retryRoutingIncident(CLINIC_ID, 'incident-a').subscribe();
    const retry = http.expectOne(`/api/v1/clinics/${CLINIC_ID}/routing-incidents/incident-a/retry`);
    expect(retry.request.method).toBe('POST');
    retry.flush(incident());
  });

  it('uses task-scoped candidates and sends only the certified handover initiation body', () => {
    api.listHandoverTargets(CLINIC_ID, TASK_ID, 1, 20).subscribe();
    const targets = http.expectOne(`${TASKS_URL}/${TASK_ID}/handover-targets?page=1&size=20`);
    targets.flush({ items: [], page: 1, pageSize: 20, hasNext: false, generatedAt: '2026-08-12T10:00:00Z' });

    api.initiateHandover(CLINIC_ID, TASK_ID, {
      toMembershipId: 'member-b', reasonCode: 'SHIFT_CHANGE', expectedTaskVersion: 7,
    }).subscribe();
    const initiate = http.expectOne(`${TASKS_URL}/${TASK_ID}/handovers`);
    expect(initiate.request.body).toEqual({ toMembershipId: 'member-b', reasonCode: 'SHIFT_CHANGE', expectedTaskVersion: 7 });
    initiate.flush(handover());
  });

  it('uses Slice paging and explicit handover lifecycle commands', () => {
    api.listIncomingHandovers(CLINIC_ID, 3, 10).subscribe();
    const incoming = http.expectOne(`/api/v1/clinics/${CLINIC_ID}/task-handovers/incoming?page=3&pageSize=10`);
    incoming.flush({ items: [], page: 3, pageSize: 10, hasNext: false, generatedAt: '2026-08-12T10:00:00Z' });
    api.acceptHandover(CLINIC_ID, 'handover-a').subscribe();
    const accept = http.expectOne(`/api/v1/clinics/${CLINIC_ID}/task-handovers/handover-a/accept`);
    expect(accept.request.body).toEqual({}); accept.flush(handover({ status: 'ACCEPTED' }));
  });

  it('uses versioned position, assignment, and responsibility configuration contracts', () => {
    api.createPosition(CLINIC_ID, { displayName: 'Admissions', requiredProfessionalRole: 'CLINIC_ASSISTANT', scopeType: 'CLINIC' }).subscribe();
    const position = http.expectOne(`/api/v1/clinics/${CLINIC_ID}/positions`);
    expect(position.request.body).toEqual({ displayName: 'Admissions', requiredProfessionalRole: 'CLINIC_ASSISTANT', scopeType: 'CLINIC' }); position.flush({});
    api.createPositionAssignment(CLINIC_ID, { positionId: 'position-a', membershipId: 'member-a' }).subscribe();
    const assignment = http.expectOne(`/api/v1/clinics/${CLINIC_ID}/position-assignments`); expect(assignment.request.body).toEqual({ positionId: 'position-a', membershipId: 'member-a' }); assignment.flush({});
    api.updateResponsibility(CLINIC_ID, 'responsibility-a', { primaryPositionId: 'position-a', backupPositionId: 'position-b', escalationPositionId: 'position-c', expectedVersion: 3 }).subscribe();
    const responsibility = http.expectOne(`/api/v1/clinics/${CLINIC_ID}/responsibilities/responsibility-a`); expect(responsibility.request.method).toBe('PUT'); expect(responsibility.request.body.expectedVersion).toBe(3); responsibility.flush({});
  });
});

function incident() { return { id: 'incident-a', taskId: TASK_ID, caseId: 'case-a', incidentType: 'MISSING_ACTIVE_RESPONSIBILITY', status: 'OPEN', openedAt: '2026-08-12T10:00:00Z', lastObservedAt: '2026-08-12T10:00:00Z', resolvedAt: null, resolutionCode: null, version: 1 }; }
function handover(overrides: Record<string, unknown> = {}) { return { handoverId: 'handover-a', taskId: TASK_ID, status: 'PENDING', reasonCode: 'SHIFT_CHANGE', fromMembershipId: 'member-a', toMembershipId: 'member-b', taskType: 'ADMINISTRATIVE_REVIEW', priority: 'NORMAL', initiatedAt: '2026-08-12T10:00:00Z', acceptedAt: null, declinedAt: null, cancelledAt: null, invalidatedAt: null, invalidationReason: null, ...overrides }; }

function taskPage() {
  return {
    contractVersion: '1.0',
    items: [],
    page: 0,
    pageSize: 20,
    hasNext: false,
    generatedAt: '2026-08-11T10:00:00Z',
  };
}

function taskDetail(overrides: Record<string, unknown> = {}) {
  return {
    taskId: TASK_ID,
    caseId: 'case-a',
    taskType: 'ADMINISTRATIVE_REVIEW',
    responsibilityType: 'ADMISSIONS',
    status: 'ACKNOWLEDGED',
    priority: 'NORMAL',
    blocking: true,
    acknowledgementRequired: true,
    acknowledgementDueAt: '2026-08-11T11:00:00Z',
    dueAt: '2026-08-12T10:00:00Z',
    assignedPositionId: 'position-a',
    assignedMembershipId: 'membership-a',
    createdAt: '2026-08-11T10:00:00Z',
    updatedAt: '2026-08-11T10:00:00Z',
    version: 8,
    blockedReasonCode: null,
    acknowledgedAt: '2026-08-11T10:10:00Z',
    startedAt: null,
    completedAt: null,
    caseContext: {
      caseId: 'case-a',
      sourceRequestId: 'request-a',
      intakeStatus: 'RECEIVED',
      situation: 'APPOINTMENT',
      priority: 'NORMAL',
      currentStepKey: 'ADMINISTRATIVE_REVIEW',
      submittedAt: '2026-08-11T09:00:00Z',
      hasOpenRoutingIncident: false,
    },
    ...overrides,
  };
}
