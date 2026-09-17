import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { of } from 'rxjs';

import { OMNICARE_ICONS } from '../../app.icons';
import { RUNTIME_CONFIG } from '../../core/config/runtime-config';
import { ClinicBootstrapResponse, ClinicCaseDetail, ClinicTaskDetail } from './clinic-api.models';
import { ClinicContextStore } from './clinic-context.store';
import { ClinicTaskDetailPage } from './clinic-task-detail-page';

const CLINIC_ID = 'clinic-a';
const TASK_ID = 'task-a';
const CASE_ID = 'case-a';
const TASK_URL = `/api/v1/clinics/${CLINIC_ID}/tasks/${TASK_ID}`;
const CASE_URL = `/api/v1/clinics/${CLINIC_ID}/cases/${CASE_ID}`;

describe('ClinicTaskDetailPage', () => {
  let fixture: ComponentFixture<ClinicTaskDetailPage>;
  let http: HttpTestingController;

  afterEach(() => {
    fixture?.destroy();
    http.verify();
    vi.restoreAllMocks();
  });

  it.each([
    ['ACKNOWLEDGED', 'Ready to start'],
    ['IN_PROGRESS', 'In progress'],
    ['BLOCKED', 'Blocked'],
    ['COMPLETED', 'Completed'],
  ] as const)('renders the %s task state independently from case status', (status, label) => {
    setup(assistantBootstrap());
    createPage();
    taskRequest().flush(
      task({
        status,
        blockedReasonCode: status === 'BLOCKED' ? 'WAITING_FOR_PATIENT_INFORMATION' : null,
        completedAt: status === 'COMPLETED' ? '2026-08-11T12:00:00Z' : null,
      }),
    );
    caseRequest().flush(caseDetail());
    fixture.detectChanges();
    expect(text()).toContain(label);
    expect(text()).toContain('New');
    if (status === 'BLOCKED') {
      expect(text()).toContain('Waiting for patient information');
      expect(text()).toContain('patient-response flow');
      expect(text()).not.toContain('Unblock task');
    }
  });

  it('renders backend deadlines, ownership, safe case context, and incident summary', () => {
    setup(assistantBootstrap());
    createPage();
    taskRequest().flush(
      task({
        status: 'IN_PROGRESS',
        acknowledgementDueAt: '2020-08-11T11:00:00Z',
        dueAt: '2020-08-12T10:00:00Z',
        startedAt: '2026-08-11T10:20:00Z',
        caseContext: { ...task().caseContext, hasOpenRoutingIncident: true },
      }),
    );
    caseRequest().flush(caseDetail());
    fixture.detectChanges();

    expect(text()).toContain('ACK due');
    expect(text()).toContain('Task due');
    expect(text()).toContain('Overdue');
    expect(text()).toContain('You');
    expect(text()).toContain('Urgent request');
    expect(text()).toContain('Open routing incident requires attention');
    expect(text()).not.toContain('medical record');
  });

  it('resolves the current position through the scoped position read without displaying its raw ID', () => {
    setup(positionReadBootstrap());
    createPage();
    taskRequest().flush(task({ assignedPositionId: 'd9851f12-2226-430d-8912-f5d9c2337cc6' }));
    caseRequest().flush(caseDetail());
    fixture.detectChanges();
    http.expectOne(`/api/v1/clinics/${CLINIC_ID}/positions/d9851f12-2226-430d-8912-f5d9c2337cc6`).flush({
      id: 'd9851f12-2226-430d-8912-f5d9c2337cc6', displayName: 'Admissions', requiredProfessionalRole: 'CLINIC_ASSISTANT', scopeType: 'CLINIC', active: true, version: 1, createdAt: '2026-08-01T00:00:00Z', updatedAt: '2026-08-01T00:00:00Z',
    });
    fixture.detectChanges();

    expect(text()).toContain('Admissions');
    expect(text()).not.toContain('d9851f12-2226-430d-8912-f5d9c2337cc6');
  });

  it('uses a safe position fallback when the scoped position read is unavailable', () => {
    setup(positionReadBootstrap());
    createPage();
    taskRequest().flush(task({ assignedPositionId: 'd9851f12-2226-430d-8912-f5d9c2337cc6' }));
    caseRequest().flush(caseDetail());
    fixture.detectChanges();
    http.expectOne(`/api/v1/clinics/${CLINIC_ID}/positions/d9851f12-2226-430d-8912-f5d9c2337cc6`).flush({}, { status: 404, statusText: 'Not found' });
    fixture.detectChanges();

    expect(text()).toContain('Position unavailable');
    expect(text()).not.toContain('d9851f12-2226-430d-8912-f5d9c2337cc6');
  });

  it('starts or resumes with expectedVersion and refetches authoritative task detail', () => {
    setup(assistantBootstrap());
    createPage();
    const acknowledged = task({ status: 'ACKNOWLEDGED', startedAt: '2026-08-10T08:00:00Z' });
    taskRequest().flush(acknowledged);
    caseRequest().flush(caseDetail());
    fixture.detectChanges();
    expect(text()).toContain('Resume task');

    fixture.componentInstance.start(acknowledged);
    const start = http.expectOne(`${TASK_URL}/start`);
    expect(start.request.body).toEqual({ expectedVersion: 7 });
    start.flush(task({ status: 'IN_PROGRESS', version: 8, startedAt: acknowledged.startedAt }));
    taskRequest().flush(
      task({ status: 'IN_PROGRESS', version: 8, startedAt: acknowledged.startedAt }),
    );
    caseRequest().flush(caseDetail());
    fixture.detectChanges();
    expect(text()).toContain('Task resumed.');
  });

  it('uses the case-atomic information command to block and then refetches task state', () => {
    setup(assistantBootstrap());
    createPage();
    taskRequest().flush(task({ status: 'IN_PROGRESS', startedAt: '2026-08-11T10:20:00Z' }));
    caseRequest().flush(
      caseDetail({ availableActions: ['REQUEST_INFORMATION', 'READY_FOR_PLANNING'] }),
    );
    fixture.detectChanges();
    expect(text()).toContain('Request information');

    fixture.componentInstance.confirmBlock('CONTACT_INFORMATION');
    const block = http.expectOne(`${CASE_URL}/information-required`);
    expect(block.request.body).toEqual({
      expectedVersion: 3,
      reasonCode: 'CONTACT_INFORMATION',
      patientInstruction: undefined,
    });
    block.flush(
      caseDetail({
        administrativeStatus: 'INFORMATION_REQUIRED',
        version: 4,
        availableActions: [],
      }),
    );
    taskRequest().flush(
      task({ status: 'BLOCKED', version: 8, blockedReasonCode: 'WAITING_FOR_PATIENT_INFORMATION' }),
    );
    caseRequest().flush(
      caseDetail({
        administrativeStatus: 'INFORMATION_REQUIRED',
        version: 4,
        availableActions: [],
      }),
    );
    fixture.detectChanges();
    expect(text()).toContain('Task blocked while waiting for patient information.');
    expect(text()).toContain('Waiting for patient information');
  });

  it('completes administrative review through the atomic case command and refetches', () => {
    setup(assistantBootstrap());
    createPage();
    const inProgress = task({ status: 'IN_PROGRESS', startedAt: '2026-08-11T10:20:00Z' });
    taskRequest().flush(inProgress);
    caseRequest().flush(caseDetail({ availableActions: ['READY_FOR_PLANNING'] }));
    fixture.detectChanges();

    fixture.componentInstance.complete(inProgress);
    const completion = http.expectOne(`${CASE_URL}/ready-for-planning`);
    expect(completion.request.body).toEqual({ expectedVersion: 3 });
    completion.flush(
      caseDetail({ administrativeStatus: 'READY_FOR_PLANNING', version: 4, availableActions: [] }),
    );
    taskRequest().flush(
      task({ status: 'COMPLETED', version: 8, completedAt: '2026-08-11T12:00:00Z' }),
    );
    caseRequest().flush(
      caseDetail({ administrativeStatus: 'READY_FOR_PLANNING', version: 4, availableActions: [] }),
    );
    fixture.detectChanges();
    expect(text()).toContain('backend advanced the workflow');
    expect(text()).toContain('Completed');
  });

  it('blocks an owned in-progress task with a controlled generic reason and refetches detail', () => {
    setup(assistantBootstrap());
    createPage();
    const inProgress = task({ status: 'IN_PROGRESS', startedAt: '2026-08-11T10:20:00Z' });
    taskRequest().flush(inProgress);
    caseRequest().flush(caseDetail());
    fixture.detectChanges();

    expect(text()).toContain('Block task');
    fixture.componentInstance.openGenericBlock();
    fixture.detectChanges();
    const reasonSelect = fixture.nativeElement.querySelector(
      '#clinic-generic-block-reason',
    ) as HTMLSelectElement | null;
    expect(reasonSelect).not.toBeNull();
    expect(reasonSelect?.labels?.[0]?.textContent).toContain('Block reason');
    expect(reasonSelect ? Array.from(reasonSelect.options).map((option) => option.textContent?.trim()) : []).toEqual([
      'Select a reason',
      'Waiting for internal coordination',
      'Waiting for an external non-patient response',
      'Waiting for resource availability',
    ]);
    expect(text()).not.toContain('Waiting for patient information');
    const confirmBlock = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((button) => button.textContent?.includes('Confirm block'));
    expect(confirmBlock?.disabled).toBe(true);
    fixture.componentInstance.genericBlockReasonControl.setValue(
      'WAITING_FOR_INTERNAL_COORDINATION',
    );
    fixture.detectChanges();
    expect(confirmBlock?.disabled).toBe(false);
    fixture.componentInstance.block(inProgress);

    const block = http.expectOne(`${TASK_URL}/block`);
    expect(block.request.body).toEqual({
      reasonCode: 'WAITING_FOR_INTERNAL_COORDINATION',
      expectedVersion: 7,
    });
    block.flush(
      task({
        status: 'BLOCKED',
        version: 8,
        startedAt: inProgress.startedAt,
        dueAt: inProgress.dueAt,
        blockedReasonCode: 'WAITING_FOR_INTERNAL_COORDINATION',
      }),
    );
    taskRequest().flush(
      task({
        status: 'BLOCKED',
        version: 8,
        startedAt: inProgress.startedAt,
        dueAt: inProgress.dueAt,
        blockedReasonCode: 'WAITING_FOR_INTERNAL_COORDINATION',
      }),
    );
    caseRequest().flush(caseDetail());
    fixture.detectChanges();

    expect(text()).toContain('Waiting for internal coordination');
    expect(text()).toContain('Task blocked. The backend preserved its ownership and deadlines.');
  });

  it('offers generic unblock only for an owned generic blocked reason', () => {
    setup(assistantBootstrap());
    createPage();
    const blocked = task({
      status: 'BLOCKED',
      startedAt: '2026-08-11T10:20:00Z',
      blockedReasonCode: 'WAITING_FOR_RESOURCE_AVAILABILITY',
    });
    taskRequest().flush(blocked);
    caseRequest().flush(caseDetail());
    fixture.detectChanges();
    expect(text()).toContain('Unblock task');

    fixture.componentInstance.unblock(blocked);
    const unblock = http.expectOne(`${TASK_URL}/unblock`);
    expect(unblock.request.body).toEqual({ expectedVersion: 7 });
    unblock.flush(task({ status: 'IN_PROGRESS', version: 8, startedAt: blocked.startedAt }));
    taskRequest().flush(task({ status: 'IN_PROGRESS', version: 8, startedAt: blocked.startedAt }));
    caseRequest().flush(caseDetail());
    fixture.detectChanges();
    expect(text()).toContain('Task unblocked and returned to in progress.');
    expect(text()).toContain('In progress');
  });

  it('never exposes generic unblock for the patient-information blocked reason', () => {
    setup(assistantBootstrap());
    createPage();
    taskRequest().flush(
      task({
        status: 'BLOCKED',
        blockedReasonCode: 'WAITING_FOR_PATIENT_INFORMATION',
      }),
    );
    caseRequest().flush(caseDetail());
    fixture.detectChanges();
    expect(text()).not.toContain('Unblock task');
    expect(text()).toContain('patient-response flow');
  });

  it('handles a stale generic block safely and refetches the authoritative task', () => {
    setup(assistantBootstrap());
    createPage();
    const inProgress = task({ status: 'IN_PROGRESS', startedAt: '2026-08-11T10:20:00Z' });
    taskRequest().flush(inProgress);
    caseRequest().flush(caseDetail());
    fixture.componentInstance.genericBlockReasonControl.setValue(
      'WAITING_FOR_EXTERNAL_NON_PATIENT_RESPONSE',
    );
    fixture.componentInstance.block(inProgress);
    http
      .expectOne(`${TASK_URL}/block`)
      .flush(
        { errorCode: 'CLINIC_TASK_VERSION_CONFLICT', detail: 'OptimisticLockException' },
        { status: 409, statusText: 'Conflict' },
      );
    taskRequest().flush(task({ status: 'BLOCKED', version: 8 }));
    caseRequest().flush(caseDetail());
    fixture.detectChanges();
    expect(text()).toContain(
      'This task changed while you were viewing it. The latest information has been loaded.',
    );
    expect(text()).not.toContain('OptimisticLockException');
  });

  it('completes owned Request Coordination without changing the case client-side', () => {
    setup(assistantBootstrap());
    createPage();
    const coordination = task({
      taskType: 'REQUEST_COORDINATION',
      responsibilityType: 'REQUEST_COORDINATION',
      status: 'IN_PROGRESS',
      startedAt: '2026-08-11T10:20:00Z',
    });
    taskRequest().flush(coordination);
    caseRequest().flush(caseDetail({ currentStepKey: 'REQUEST_COORDINATION' }));
    fixture.detectChanges();
    expect(text()).toContain('Complete task');
    expect(text()).not.toContain('Ready for planning');

    fixture.componentInstance.completeGeneric(coordination);
    const complete = http.expectOne(`${TASK_URL}/complete`);
    expect(complete.request.body).toEqual({ expectedVersion: 7 });
    complete.flush(
      task({
        taskType: 'REQUEST_COORDINATION',
        responsibilityType: 'REQUEST_COORDINATION',
        status: 'COMPLETED',
        version: 8,
        completedAt: '2026-08-11T12:00:00Z',
      }),
    );
    taskRequest().flush(
      task({
        taskType: 'REQUEST_COORDINATION',
        responsibilityType: 'REQUEST_COORDINATION',
        status: 'COMPLETED',
        version: 8,
        completedAt: '2026-08-11T12:00:00Z',
      }),
    );
    caseRequest().flush(caseDetail({ currentStepKey: 'REQUEST_COORDINATION' }));
    fixture.detectChanges();
    expect(text()).toContain('Task completed.');
    expect(text()).toContain('Completed');
  });

  it('does not offer generic completion for Administrative Review', () => {
    setup(assistantBootstrap());
    createPage();
    taskRequest().flush(task({ status: 'IN_PROGRESS', startedAt: '2026-08-11T10:20:00Z' }));
    caseRequest().flush(caseDetail({ availableActions: [] }));
    fixture.detectChanges();
    expect(text()).not.toContain('Complete task');
  });

  it('shows reassignment only with CLINIC_TASK_REASSIGN and sends a target position', () => {
    setup(adminBootstrap());
    createPage();
    taskRequest().flush(task({ status: 'IN_PROGRESS', assignedMembershipId: 'membership-worker' }));
    caseRequest().flush(caseDetail());
    positionsRequest().flush(positionPage());
    fixture.detectChanges();
    expect(text()).toContain('Reassign position queue');

    fixture.componentInstance.positionControl.setValue('position-b');
    fixture.componentInstance.reassign(fixture.componentInstance.store.detail()!);
    const reassign = http.expectOne(`${TASK_URL}/reassign`);
    expect(reassign.request.body).toEqual({ targetPositionId: 'position-b', expectedVersion: 7 });
    reassign.flush(
      task({
        status: 'ASSIGNED',
        version: 8,
        assignedPositionId: 'position-b',
        assignedMembershipId: null,
      }),
    );
    taskRequest().flush(
      task({
        status: 'ASSIGNED',
        version: 8,
        assignedPositionId: 'position-b',
        assignedMembershipId: null,
      }),
    );
    caseRequest().flush(caseDetail());
    fixture.detectChanges();
    expect(text()).toContain('Task reassigned to the selected position queue.');
    expect(text()).toContain('Admissions Backup');
  });

  it('does not infer mutation controls from read capability alone', () => {
    setup(readOnlyBootstrap());
    createPage();
    taskRequest().flush(task({ status: 'IN_PROGRESS', assignedMembershipId: 'someone-else' }));
    fixture.detectChanges();
    expect(text()).not.toContain('Start task');
    expect(text()).not.toContain('Block task');
    expect(text()).not.toContain('Complete task');
    expect(text()).not.toContain('Reassign position queue');
  });

  it('discovers task-scoped handover candidates and submits the authoritative task version', () => {
    setup(handoverBootstrap());
    createPage();
    const acknowledged = task({ status: 'ACKNOWLEDGED' });
    taskRequest().flush(acknowledged);
    caseRequest().flush(caseDetail());
    fixture.detectChanges();
    expect(text()).toContain('Hand over task');

    fixture.componentInstance.openHandover(acknowledged);
    const targets = http.expectOne(`${TASK_URL}/handover-targets?page=0&size=20`);
    targets.flush({ items: [{ membershipId: 'membership-b', displayName: 'Nora', positionId: 'position-a', positionName: 'Admissions' }], page: 0, pageSize: 20, hasNext: false, generatedAt: '2026-08-12T10:00:00Z' });
    fixture.componentInstance.handoverTargetControl.setValue('membership-b');
    fixture.componentInstance.handoverReasonControl.setValue('SHIFT_CHANGE');
    fixture.componentInstance.initiateHandover(acknowledged);
    const initiate = http.expectOne(`${TASK_URL}/handovers`);
    expect(initiate.request.body).toEqual({ toMembershipId: 'membership-b', reasonCode: 'SHIFT_CHANGE', expectedTaskVersion: 7 });
    initiate.flush({ handoverId: 'handover-a' });
    http.expectOne(`/api/v1/clinics/${CLINIC_ID}/task-handovers/outgoing?page=0&pageSize=20`).flush({ items: [], page: 0, pageSize: 20, hasNext: false, generatedAt: '2026-08-12T10:00:00Z' });
    taskRequest().flush(acknowledged);
    caseRequest().flush(caseDetail());
    fixture.detectChanges();
    expect(text()).toContain('You remain the task owner while it is pending.');
    expect(text()).toContain('Start task');
  });

  it('centralizes version conflict copy and reloads latest detail', () => {
    setup(assistantBootstrap());
    createPage();
    const acknowledged = task({ status: 'ACKNOWLEDGED' });
    taskRequest().flush(acknowledged);
    caseRequest().flush(caseDetail());
    fixture.componentInstance.start(acknowledged);
    http.expectOne(`${TASK_URL}/start`).flush(
      {
        errorCode: 'CLINIC_TASK_VERSION_CONFLICT',
        detail: 'ObjectOptimisticLockingFailureException',
      },
      { status: 409, statusText: 'Conflict' },
    );
    taskRequest().flush(task({ status: 'IN_PROGRESS', version: 8 }));
    caseRequest().flush(caseDetail());
    fixture.detectChanges();
    expect(text()).toContain(
      'This task changed while you were viewing it. The latest information has been loaded.',
    );
    expect(text()).not.toContain('ObjectOptimisticLockingFailureException');
  });

  it('maps cross-Clinic/not-found detail to a safe unavailable state', () => {
    setup(assistantBootstrap());
    createPage();
    taskRequest().flush(
      { errorCode: 'CLINIC_TASK_NOT_FOUND', detail: 'Internal repository detail' },
      { status: 404, statusText: 'Not Found' },
    );
    fixture.detectChanges();
    expect(text()).toContain('Task not found');
    expect(text()).toContain('unavailable or you do not have access');
    expect(text()).not.toContain('Internal repository detail');
  });

  function setup(bootstrap: ClinicBootstrapResponse): void {
    const params = convertToParamMap({ taskId: TASK_ID });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideNzIcons(OMNICARE_ICONS),
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: '/api/v1' } },
        {
          provide: ClinicContextStore,
          useValue: {
            initialize: vi.fn(),
            selectedClinicId: signal<string | null>(CLINIC_ID),
            bootstrap: signal(bootstrap),
          },
        },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: params }, paramMap: of(params) },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  }

  function createPage(): void {
    fixture = TestBed.createComponent(ClinicTaskDetailPage);
    fixture.detectChanges();
  }

  function taskRequest() {
    return http.expectOne(TASK_URL);
  }
  function caseRequest() {
    return http.expectOne(CASE_URL);
  }
  function positionsRequest() {
    return http.expectOne((request) => request.url === `/api/v1/clinics/${CLINIC_ID}/positions`);
  }
  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }
});

function assistantBootstrap(): ClinicBootstrapResponse {
  return bootstrap(
    ['CLINIC_TASK_READ', 'CLINIC_CASE_INTAKE_READ', 'CLINIC_CASE_INTAKE_REVIEW'],
    'CLINIC_ASSISTANT',
  );
}
function handoverBootstrap(): ClinicBootstrapResponse {
  return bootstrap(
    ['CLINIC_TASK_READ', 'CLINIC_CASE_INTAKE_READ', 'CLINIC_CASE_INTAKE_REVIEW', 'CLINIC_TASK_HANDOVER'],
    'CLINIC_ASSISTANT',
  );
}
function positionReadBootstrap(): ClinicBootstrapResponse {
  return bootstrap(
    ['CLINIC_TASK_READ', 'CLINIC_CASE_INTAKE_READ', 'CLINIC_POSITION_READ'],
    'CLINIC_ASSISTANT',
  );
}
function adminBootstrap(): ClinicBootstrapResponse {
  return bootstrap(
    [
      'CLINIC_TASK_READ',
      'CLINIC_CASE_INTAKE_READ',
      'CLINIC_CASE_INTAKE_REVIEW',
      'CLINIC_TASK_REASSIGN',
      'CLINIC_POSITION_READ',
    ],
    'CLINIC_ADMIN',
  );
}
function readOnlyBootstrap(): ClinicBootstrapResponse {
  return bootstrap(['CLINIC_TASK_READ'], 'CLINIC_MEDECIN');
}
function bootstrap(
  capabilities: ClinicBootstrapResponse['capabilities'],
  role: string,
): ClinicBootstrapResponse {
  return {
    contractVersion: '1.0',
    clinic: { clinicId: CLINIC_ID, clinicName: 'Clinic A', clinicStatus: 'ACTIVE' },
    membership: {
      membershipId: 'membership-a',
      membershipStatus: 'ACTIVE',
      professionalRole: role,
      version: 1,
    },
    capabilities,
    featureFlags: {},
    resolvedAt: '2026-08-11T10:00:00Z',
  };
}

function task(overrides: Partial<ClinicTaskDetail> = {}): ClinicTaskDetail {
  return {
    taskId: TASK_ID,
    caseId: CASE_ID,
    taskType: 'ADMINISTRATIVE_REVIEW',
    responsibilityType: 'ADMISSIONS',
    status: 'ACKNOWLEDGED',
    priority: 'HIGH',
    blocking: true,
    acknowledgementRequired: true,
    acknowledgementDueAt: '2026-08-11T11:00:00Z',
    dueAt: '2026-08-12T10:00:00Z',
    assignedPositionId: 'position-a',
    assignedMembershipId: 'membership-a',
    createdAt: '2026-08-11T10:00:00Z',
    updatedAt: '2026-08-11T10:00:00Z',
    version: 7,
    blockedReasonCode: null,
    acknowledgedAt: '2026-08-11T10:10:00Z',
    startedAt: null,
    completedAt: null,
    caseContext: {
      caseId: CASE_ID,
      sourceRequestId: 'request-a',
      intakeStatus: 'RECEIVED',
      situation: 'URGENT',
      priority: 'NORMAL',
      currentStepKey: 'ADMINISTRATIVE_REVIEW',
      submittedAt: '2026-08-11T09:00:00Z',
      hasOpenRoutingIncident: false,
    },
    ...overrides,
  };
}

function caseDetail(overrides: Partial<ClinicCaseDetail> = {}): ClinicCaseDetail {
  return {
    clinicCaseId: CASE_ID,
    patientDisplayName: 'Amina',
    subjectType: 'SELF',
    relationship: null,
    situation: 'URGENT',
    administrativeStatus: 'UNDER_ADMIN_REVIEW',
    submittedAt: '2026-08-11T09:00:00Z',
    version: 3,
    priority: 'NORMAL',
    currentStepKey: 'ADMINISTRATIVE_REVIEW',
    availableActions: [],
    timeline: [],
    informationRequest: null,
    patientSummary: { displayName: 'Amina', subjectType: 'SELF', relationship: null },
    openRoutingIncidents: [],
    ...overrides,
  };
}

function positionPage() {
  return {
    contractVersion: '1.0',
    items: [
      {
        id: 'position-a',
        displayName: 'Admissions Primary',
        requiredProfessionalRole: 'CLINIC_ASSISTANT',
        scopeType: 'CLINIC',
        active: true,
        version: 1,
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z',
      },
      {
        id: 'position-b',
        displayName: 'Admissions Backup',
        requiredProfessionalRole: 'CLINIC_ASSISTANT',
        scopeType: 'CLINIC',
        active: true,
        version: 1,
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z',
      },
    ],
    page: 0,
    pageSize: 100,
    hasNext: false,
    generatedAt: '2026-08-11T10:00:00Z',
  };
}
