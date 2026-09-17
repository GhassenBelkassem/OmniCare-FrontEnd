import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { provideNzIcons } from 'ng-zorro-antd/icon';

import { OMNICARE_ICONS } from '../../app.icons';
import { RUNTIME_CONFIG } from '../../core/config/runtime-config';
import { ClinicBootstrapResponse, ClinicTaskListItem } from './clinic-api.models';
import { ClinicContextStore } from './clinic-context.store';
import { ClinicTaskListPage } from './clinic-task-list-page';
import { TaskDetailPresentationService } from './task-detail-presentation.service';

const CLINIC_ID = 'clinic-a';
const TASK_ID = 'a1b2c3d4-1111-2222-3333-444455556666';
const TASKS_URL = `/api/v1/clinics/${CLINIC_ID}/tasks`;

describe('ClinicTaskListPage', () => {
  let fixture: ComponentFixture<ClinicTaskListPage>;
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
        { provide: TaskDetailPresentationService, useValue: { usePanel: () => true } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    fixture?.destroy();
    http.verify();
    vi.restoreAllMocks();
  });

  it('loads and renders the position queue with backend fields and detail navigation', () => {
    createPage('queue');
    queueRequest('position-queue').flush(page([task()]));
    fixture.detectChanges();

    expect(text()).toContain('Position Queue');
    expect(text()).toContain('Administrative review');
    expect(text()).toContain('Awaiting acknowledgement');
    expect(text()).toContain('Critical');
    expect(text()).toContain('ACK due');
    expect(text()).toContain('Acknowledge');
    const detailLink = fixture.nativeElement.querySelector(
      'a[href*="/clinic/tasks/"]',
    ) as HTMLAnchorElement;
    expect(detailLink.getAttribute('href')).toContain(`/clinic/tasks/${TASK_ID}`);
  });

  it('uses Slice pagination for the position queue', async () => {
    createPage('queue');
    queueRequest('position-queue').flush(page([task()], true));
    fixture.detectChanges();

    fixture.componentInstance.nextPage();
    await fixture.whenStable();
    fixture.detectChanges();
    const request = queueRequest('position-queue');
    expect(request.request.params.get('page')).toBe('1');
    expect(request.request.params.get('pageSize')).toBe('20');
    request.flush(page([], false, 1));
  });

  it('shows distinct empty and safe error states', () => {
    createPage('queue');
    queueRequest('position-queue').flush(page([]));
    fixture.detectChanges();
    expect(text()).toContain('No tasks in your position queue');

    fixture.componentInstance.refresh();
    queueRequest('position-queue').flush(
      { errorCode: 'CLINIC_TASK_REQUEST_FAILED', detail: 'SQL internal trace' },
      { status: 500, statusText: 'Server Error' },
    );
    fixture.detectChanges();
    expect(text()).toContain("We couldn't load tasks");
    expect(text()).not.toContain('SQL internal trace');
  });

  it('acknowledges with expectedVersion then immediately refreshes the queue', () => {
    createPage('queue');
    queueRequest('position-queue').flush(page([task()]));
    fixture.detectChanges();

    const button = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((candidate) => candidate.textContent?.includes('Acknowledge'))!;
    button.click();
    const acknowledge = http.expectOne(`${TASKS_URL}/${TASK_ID}/acknowledge`);
    expect(acknowledge.request.body).toEqual({ expectedVersion: 7 });
    acknowledge.flush(
      detail({ status: 'ACKNOWLEDGED', version: 8, assignedMembershipId: 'membership-a' }),
    );
    queueRequest('position-queue').flush(page([]));
    fixture.detectChanges();
    expect(text()).toContain('now available in My Tasks');
  });

  it('handles a lost ACK race safely and refreshes authoritative queue state', () => {
    createPage('queue');
    queueRequest('position-queue').flush(page([task()]));
    fixture.detectChanges();
    fixture.componentInstance.acknowledge(task());

    http
      .expectOne(`${TASKS_URL}/${TASK_ID}/acknowledge`)
      .flush(
        { errorCode: 'CLINIC_TASK_VERSION_CONFLICT', detail: 'OptimisticLockException' },
        { status: 409, statusText: 'Conflict' },
      );
    queueRequest('position-queue').flush(page([]));
    fixture.detectChanges();
    expect(text()).toContain('This task has already been acknowledged by another team member.');
    expect(text()).not.toContain('OptimisticLockException');
  });

  it('loads My Tasks, maps statuses independently, paginates, and handles empty/error', async () => {
    createPage('my');
    queueRequest('my').flush(
      page(
        [
          task({ status: 'ACKNOWLEDGED', assignedMembershipId: 'membership-a' }),
          task({ taskId: 'task-b', status: 'IN_PROGRESS', assignedMembershipId: 'membership-a' }),
          task({ taskId: 'task-c', status: 'BLOCKED', assignedMembershipId: 'membership-a' }),
        ],
        true,
      ),
    );
    fixture.detectChanges();
    expect(text()).toContain('My Tasks');
    expect(text()).toContain('Ready to start');
    expect(text()).toContain('In progress');
    expect(text()).toContain('Blocked');
    expect(text()).not.toContain('Acknowledge');

    fixture.componentInstance.nextPage();
    await fixture.whenStable();
    fixture.detectChanges();
    const next = queueRequest('my');
    expect(next.request.params.get('page')).toBe('1');
    next.flush(page([], false, 1));
    fixture.detectChanges();
    expect(text()).toContain('You have no active tasks');

    fixture.componentInstance.refresh();
    queueRequest('my').flush({}, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    expect(text()).toContain("We couldn't load tasks");
  });

  it('opens a read-only preview for My Tasks without changing the canonical detail route', () => {
    createPage('my');
    queueRequest('my').flush(page([task({ assignedMembershipId: 'membership-a' })]));
    fixture.detectChanges();

    fixture.componentInstance.selectTask(task({ assignedMembershipId: 'membership-a' }));
    fixture.detectChanges();

    expect(fixture.componentInstance.selectedTask()?.taskId).toBe(TASK_ID);
    expect((document.querySelector('.cdk-overlay-container')?.textContent ?? '')).toContain('Task preview');
    expect((document.querySelector('.cdk-overlay-container')?.textContent ?? '')).toContain('Open full task');
  });

  function createPage(kind: 'queue' | 'my'): void {
    TestBed.inject(ActivatedRoute).snapshot.data['kind'] = kind;
    fixture = TestBed.createComponent(ClinicTaskListPage);
    fixture.detectChanges();
  }

  function queueRequest(kind: 'position-queue' | 'my') {
    return http.expectOne((request) => request.url === `${TASKS_URL}/${kind}`);
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }
});

function bootstrap(): ClinicBootstrapResponse {
  return {
    contractVersion: '1.0',
    clinic: { clinicId: CLINIC_ID, clinicName: 'Clinic A', clinicStatus: 'ACTIVE' },
    membership: {
      membershipId: 'membership-a',
      membershipStatus: 'ACTIVE',
      professionalRole: 'CLINIC_ASSISTANT',
      version: 1,
    },
    capabilities: ['CLINIC_TASK_READ', 'CLINIC_CASE_INTAKE_READ', 'CLINIC_CASE_INTAKE_REVIEW'],
    featureFlags: {},
    resolvedAt: '2026-08-11T10:00:00Z',
  };
}

function task(overrides: Partial<ClinicTaskListItem> = {}): ClinicTaskListItem {
  return {
    taskId: TASK_ID,
    caseId: 'case-a',
    taskType: 'ADMINISTRATIVE_REVIEW',
    responsibilityType: 'ADMISSIONS',
    status: 'ASSIGNED',
    priority: 'CRITICAL',
    blocking: true,
    acknowledgementRequired: true,
    acknowledgementDueAt: '2026-08-11T11:00:00Z',
    dueAt: '2026-08-12T10:00:00Z',
    assignedPositionId: 'position-a',
    assignedMembershipId: null,
    createdAt: '2026-08-11T10:00:00Z',
    updatedAt: '2026-08-11T10:00:00Z',
    version: 7,
    caseContext: {
      caseId: 'case-a',
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

function detail(overrides: Record<string, unknown> = {}) {
  return {
    ...task(),
    blockedReasonCode: null,
    acknowledgedAt: null,
    startedAt: null,
    completedAt: null,
    ...overrides,
  };
}

function page(items: readonly ClinicTaskListItem[], hasNext = false, pageNumber = 0) {
  return {
    contractVersion: '1.0',
    items,
    page: pageNumber,
    pageSize: 20,
    hasNext,
    generatedAt: '2026-08-11T10:00:00Z',
  };
}
