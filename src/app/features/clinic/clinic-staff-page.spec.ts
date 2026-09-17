import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideNzIcons } from 'ng-zorro-antd/icon';

import { OMNICARE_ICONS } from '../../app.icons';
import { AuthTokenStore } from '../../core/auth/auth-token.store';
import { RUNTIME_CONFIG } from '../../core/config/runtime-config';
import { ClinicStaffMember, ClinicStaffPage } from './clinic-api.models';
import { ClinicContextStore } from './clinic-context.store';
import { ClinicShell } from './clinic-shell';
import { ClinicStaffPage as ClinicStaffPageComponent } from './clinic-staff-page';

const RESOLVED_AT = '2026-08-07T09:00:00Z';
const CLINIC_ID = 'clinic-a';
const STAFF_URL = `/api/v1/clinics/${CLINIC_ID}/staff`;

const ADMIN_CAPABILITIES = [
  'CLINIC_OVERVIEW_READ',
  'CLINIC_CASE_INTAKE_READ',
  'CLINIC_TASK_READ',
  'CLINIC_STAFF_READ',
  'CLINIC_STAFF_INVITE',
  'CLINIC_STAFF_SUSPEND',
  'CLINIC_STAFF_REACTIVATE',
  'CLINIC_STAFF_END',
];

function member(overrides: Partial<ClinicStaffMember> = {}): ClinicStaffMember {
  return {
    membershipId: 'membership-1',
    displayName: 'nadia@example.test',
    professionalRole: 'CLINIC_MEDECIN',
    membershipStatus: 'ACTIVE',
    joinedAt: '2026-01-05T08:00:00Z',
    suspendedAt: null,
    endedAt: null,
    version: 4,
    ...overrides,
  };
}

function staffPage(items: readonly ClinicStaffMember[], hasNext = false): ClinicStaffPage {
  return {
    contractVersion: '1.0',
    items,
    page: 0,
    pageSize: 20,
    hasNext,
    generatedAt: RESOLVED_AT,
  };
}

describe('Clinic staff (Phase 1.5)', () => {
  let http: HttpTestingController;

  function bootstrapClinic(capabilities: readonly string[]): void {
    const store = TestBed.inject(ClinicContextStore);
    store.initialize({ route: false });
    http
      .expectOne('/api/v1/me/access')
      .flush({ contractVersion: '1.0', accessFamily: 'CLINIC', resolvedAt: RESOLVED_AT });
    http.expectOne('/api/v1/me/clinics').flush({
      contractVersion: '1.0',
      activeMemberships: [
        {
          clinicId: CLINIC_ID,
          clinicName: 'Clinique Jasmin',
          membershipId: 'membership-self',
          professionalRole: 'CLINIC_ADMIN',
          membershipStatus: 'ACTIVE',
          clinicStatus: 'ACTIVE',
          version: 1,
        },
      ],
      unavailableMemberships: [],
      resolvedAt: RESOLVED_AT,
    });
    http.expectOne(`/api/v1/clinics/${CLINIC_ID}/bootstrap`).flush({
      contractVersion: '1.0',
      clinic: { clinicId: CLINIC_ID, clinicName: 'Clinique Jasmin', clinicStatus: 'ACTIVE' },
      membership: {
        membershipId: 'membership-self',
        membershipStatus: 'ACTIVE',
        professionalRole: 'CLINIC_ADMIN',
        version: 1,
      },
      capabilities,
      featureFlags: {},
      resolvedAt: RESOLVED_AT,
    });
  }

  function createStaffPage(
    capabilities: readonly string[],
    items: readonly ClinicStaffMember[] = [member()],
  ): ComponentFixture<ClinicStaffPageComponent> {
    bootstrapClinic(capabilities);
    const fixture = TestBed.createComponent(ClinicStaffPageComponent);
    fixture.detectChanges();
    http.expectOne((request) => request.url === STAFF_URL).flush(staffPage(items));
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideNzIcons(OMNICARE_ICONS),
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: '/api/v1' } },
      ],
    });
    TestBed.inject(AuthTokenStore).setSession({
      accessToken: 'clinic-access-token',
      tokenType: 'Bearer',
      expiresAt: '2026-08-07T12:00:00Z',
      refreshToken: 'clinic-refresh-token',
      refreshExpiresAt: '2026-08-08T00:00:00Z',
      user: { id: 'clinic-user-1', role: 'CLINIC_ADMIN', mustChangePassword: false },
    });
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('exposes Requests and Staff for an administrator with staff capability', () => {
    bootstrapClinic(ADMIN_CAPABILITIES);
    const fixture = TestBed.createComponent(ClinicShell);
    fixture.detectChanges();

    expect(fixture.componentInstance.navigation().map((item) => item.id)).toEqual(['requests', 'tasks', 'staff']);
    expect(fixture.componentInstance.navigation().find((item) => item.id === 'tasks')?.children?.map((item) => item.label)).toEqual([
      'Position Queue',
      'My Tasks',
    ]);
  });

  it('keeps Staff out of Assistant navigation', () => {
    bootstrapClinic(['CLINIC_CASE_INTAKE_READ', 'CLINIC_TASK_READ']);
    const fixture = TestBed.createComponent(ClinicShell);
    fixture.detectChanges();

    expect(fixture.componentInstance.navigation().map((item) => item.id)).toEqual(['requests', 'tasks']);
  });

  it('does not expose placeholder Overview navigation during P3-13A', () => {
    bootstrapClinic(['CLINIC_OVERVIEW_READ']);
    const fixture = TestBed.createComponent(ClinicShell);
    fixture.detectChanges();

    expect(fixture.componentInstance.navigation().map((item) => item.id)).toEqual([]);
  });

  it('queries staff for the clinic selected by the clinic context store', () => {
    bootstrapClinic(ADMIN_CAPABILITIES);
    const fixture = TestBed.createComponent(ClinicStaffPageComponent);
    fixture.detectChanges();

    const request = http.expectOne((candidate) => candidate.url === STAFF_URL);
    expect(request.request.url).toBe(STAFF_URL);
    request.flush(staffPage([member()]));
  });

  it('sends pagination and filter parameters to the backend instead of filtering locally', () => {
    const fixture = createStaffPage(ADMIN_CAPABILITIES, [member()]);

    fixture.componentInstance.store.setStatus('SUSPENDED');
    const filtered = http.expectOne((candidate) => candidate.url === STAFF_URL);
    expect(filtered.request.params.get('status')).toBe('SUSPENDED');
    expect(filtered.request.params.get('page')).toBe('0');
    expect(filtered.request.params.get('pageSize')).toBe('20');
    filtered.flush(staffPage([member({ membershipStatus: 'SUSPENDED' })], true));
    fixture.detectChanges();

    fixture.componentInstance.store.nextPage();
    const nextPage = http.expectOne((candidate) => candidate.url === STAFF_URL);
    expect(nextPage.request.params.get('page')).toBe('1');
    expect(nextPage.request.params.get('status')).toBe('SUSPENDED');
    nextPage.flush(staffPage([]));
  });

  it('never offers Clinic Administrator as an attach target', () => {
    const fixture = createStaffPage(ADMIN_CAPABILITIES);
    fixture.componentInstance.openAddDialog();
    fixture.detectChanges();

    const values = fixture.componentInstance.roleOptions.map((option) => option.value);
    expect(values).toEqual([
      'CLINIC_ASSISTANT',
      'CLINIC_MEDECIN',
      'CLINIC_INFIRMIERE',
      'CLINIC_KINE',
    ]);
    const rendered = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll(
        'app-clinic-staff-dialog select option',
      ),
    ).map((option) => option.getAttribute('value'));
    expect(rendered).not.toContain('CLINIC_ADMIN');
    expect(rendered).toContain('CLINIC_MEDECIN');
  });

  it('attaches an existing professional and reloads the authoritative list', () => {
    const fixture = createStaffPage(ADMIN_CAPABILITIES, []);
    fixture.componentInstance.openAddDialog();
    fixture.componentInstance.addForm.setValue({
      email: 'nadia@example.test',
      professionalRole: 'CLINIC_MEDECIN',
    });
    fixture.componentInstance.submitAdd();

    const invitation = http.expectOne(`${STAFF_URL}/invitations`);
    expect(invitation.request.method).toBe('POST');
    expect(invitation.request.body).toEqual({
      email: 'nadia@example.test',
      professionalRole: 'CLINIC_MEDECIN',
    });
    invitation.flush(member(), { status: 201, statusText: 'Created' });

    http.expectOne((candidate) => candidate.url === STAFF_URL).flush(staffPage([member()]));
    fixture.detectChanges();
    expect(fixture.componentInstance.addDialogOpen()).toBe(false);
    expect(fixture.componentInstance.store.notice()?.tone).toBe('success');
  });

  it('shows a generic message for an ineligible professional without leaking backend detail', () => {
    const fixture = createStaffPage(ADMIN_CAPABILITIES, []);
    fixture.componentInstance.openAddDialog();
    fixture.componentInstance.addForm.setValue({
      email: 'unknown@example.test',
      professionalRole: 'CLINIC_KINE',
    });
    fixture.componentInstance.submitAdd();

    http.expectOne(`${STAFF_URL}/invitations`).flush(
      {
        errorCode: 'CLINIC_PROFESSIONAL_NOT_ELIGIBLE',
        detail: 'user 8f2 has no verified professional profile row',
        requestId: 'req-123',
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    fixture.detectChanges();

    const notice = fixture.componentInstance.store.notice();
    expect(notice?.tone).toBe('error');
    expect(notice?.message).toBe('This professional cannot be added to the clinic.');
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).not.toContain('req-123');
    expect(text).not.toContain('verified professional profile row');
  });

  it('sends expectedVersion when suspending with a bounded reason code', () => {
    const fixture = createStaffPage(ADMIN_CAPABILITIES, [member({ version: 7 })]);
    fixture.componentInstance.requestSuspend(member({ version: 7 }));
    fixture.componentInstance.suspendForm.setValue({
      reasonCode: 'LEAVE_OF_ABSENCE',
      note: 'Away until March',
    });
    fixture.componentInstance.confirmAction();

    const request = http.expectOne(`${STAFF_URL}/membership-1/suspend`);
    expect(request.request.body).toEqual({
      expectedVersion: 7,
      reasonCode: 'LEAVE_OF_ABSENCE',
      note: 'Away until March',
    });
    request.flush(member({ membershipStatus: 'SUSPENDED', version: 8 }));
    http
      .expectOne((candidate) => candidate.url === STAFF_URL)
      .flush(staffPage([member({ membershipStatus: 'SUSPENDED', version: 8 })]));
  });

  it('sends expectedVersion when reactivating', () => {
    const suspended = member({ membershipStatus: 'SUSPENDED', version: 9 });
    const fixture = createStaffPage(ADMIN_CAPABILITIES, [suspended]);
    fixture.componentInstance.reactivate(suspended);

    const request = http.expectOne(`${STAFF_URL}/membership-1/reactivate`);
    expect(request.request.body).toEqual({ expectedVersion: 9 });
    request.flush(member({ version: 10 }));
    http.expectOne((candidate) => candidate.url === STAFF_URL).flush(staffPage([member()]));
  });

  it('sends expectedVersion when ending a membership', () => {
    const fixture = createStaffPage(ADMIN_CAPABILITIES, [member({ version: 3 })]);
    fixture.componentInstance.requestEnd(member({ version: 3 }));
    fixture.componentInstance.confirmAction();

    const request = http.expectOne(`${STAFF_URL}/membership-1/end`);
    expect(request.request.body).toEqual({ expectedVersion: 3 });
    request.flush(member({ membershipStatus: 'ENDED', version: 4 }));
    http
      .expectOne((candidate) => candidate.url === STAFF_URL)
      .flush(staffPage([member({ membershipStatus: 'ENDED', version: 4 })]));
  });

  it('reloads authoritative data on a version conflict without retrying the mutation', () => {
    const fixture = createStaffPage(ADMIN_CAPABILITIES, [member({ version: 2 })]);
    fixture.componentInstance.requestEnd(member({ version: 2 }));
    fixture.componentInstance.confirmAction();

    http
      .expectOne(`${STAFF_URL}/membership-1/end`)
      .flush(
        { errorCode: 'CLINIC_MEMBERSHIP_VERSION_CONFLICT' },
        { status: 409, statusText: 'Conflict' },
      );

    // Exactly one reload, and no automatic retry of the dangerous mutation.
    http.expectNone(`${STAFF_URL}/membership-1/end`);
    http
      .expectOne((candidate) => candidate.url === STAFF_URL)
      .flush(staffPage([member({ version: 5 })]));
    fixture.detectChanges();

    expect(fixture.componentInstance.store.notice()?.message).toBe(
      'This staff membership changed elsewhere. The latest information has been reloaded.',
    );
  });

  it('omits mutation actions when the capabilities are not granted', () => {
    const fixture = createStaffPage(['CLINIC_OVERVIEW_READ', 'CLINIC_STAFF_READ'], [member()]);
    const host = fixture.nativeElement as HTMLElement;
    const actions = Array.from(host.querySelectorAll('.staff-table__actions button')).map(
      (button) => button.textContent?.trim() ?? '',
    );

    expect(actions).toEqual([]);
    expect(host.textContent).not.toContain('Add staff');
  });

  it('offers no lifecycle action for an ended membership', () => {
    const fixture = createStaffPage(ADMIN_CAPABILITIES, [
      member({ membershipStatus: 'ENDED', endedAt: '2026-05-01T09:00:00Z' }),
    ]);
    const host = fixture.nativeElement as HTMLElement;
    const actions = host.querySelectorAll('.staff-table__actions button');

    expect(actions.length).toBe(0);
    expect(host.textContent).toContain('Ended');
  });

  it('renders known role labels and degrades safely for an unknown role value', () => {
    const fixture = createStaffPage(ADMIN_CAPABILITIES, [
      member(),
      member({ membershipId: 'membership-2', professionalRole: 'CLINIC_FUTURE_ROLE' }),
    ]);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('Clinic Doctor');
    expect(text).toContain('Future role');
    expect(text).not.toContain('CLINIC_MEDECIN');
  });

  it('never lets a stale list response overwrite the newest query', () => {
    const fixture = createStaffPage(ADMIN_CAPABILITIES, [member()]);

    fixture.componentInstance.store.setStatus('SUSPENDED');
    const stale = http.expectOne((candidate) => candidate.url === STAFF_URL);
    fixture.componentInstance.store.setStatus('ENDED');
    const fresh = http.expectOne(
      (candidate) => candidate.url === STAFF_URL && candidate.params.get('status') === 'ENDED',
    );

    fresh.flush(staffPage([member({ membershipId: 'fresh-row', membershipStatus: 'ENDED' })]));
    stale.flush(staffPage([member({ membershipId: 'stale-row', membershipStatus: 'SUSPENDED' })]));
    fixture.detectChanges();

    expect(fixture.componentInstance.store.items().map((row) => row.membershipId)).toEqual([
      'fresh-row',
    ]);
  });
});
