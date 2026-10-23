import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { provideNzIcons } from 'ng-zorro-antd/icon';

import { RUNTIME_CONFIG } from '../../../../core/config/runtime-config';
import { OMNICARE_ICONS } from '../../../../app.icons';
import { DoctorStaffDetail, SecretaryMembershipStatus } from '../secretary-api.models';
import { TeamDetailPage } from './team-detail-page';

function detail(overrides: Partial<DoctorStaffDetail> = {}): DoctorStaffDetail {
  return {
    membershipId: 'mem-1',
    secretaryUserId: 'user-9',
    firstName: 'Amira',
    lastName: 'Ben Salah',
    email: 'assistant@cabinet.tn',
    status: 'ACTIVE',
    permissions: ['VIEW_AGENDA', 'CREATE_APPOINTMENT', 'VIEW_PATIENT_CONTACT'],
    invitedAt: '2026-08-01T09:00:00Z',
    activatedAt: '2026-08-02T09:00:00Z',
    suspendedAt: null,
    endedAt: null,
    version: 3,
    invitationExpiresAt: null,
    ...overrides,
  };
}

describe('TeamDetailPage', () => {
  let fixture: ComponentFixture<TeamDetailPage>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TeamDetailPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideNzIcons(OMNICARE_ICONS),
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: '/api/v1' } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: routeParams('mem-1') } } },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function render(): void {
    fixture = TestBed.createComponent(TeamDetailPage);
    fixture.detectChanges();
  }

  function flushDetail(member: DoctorStaffDetail): void {
    http.expectOne('/api/v1/me/secretaries/mem-1').flush(member);
    fixture.detectChanges();
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function buttonLabels(): (string | undefined)[] {
    return Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    ).map((button) => button.textContent?.trim());
  }

  it('loads the delegation named in the route', () => {
    render();

    const request = http.expectOne('/api/v1/me/secretaries/mem-1');
    expect(request.request.method).toBe('GET');
    request.flush(detail());
    fixture.detectChanges();
  });

  it('shows the name as the heading and keeps the email visible underneath', () => {
    render();
    flushDetail(detail());

    const header = (fixture.nativeElement as HTMLElement).querySelector('oc-page-header');
    expect(header?.textContent).toContain('Amira Ben Salah');
    expect(header?.textContent).toContain('assistant@cabinet.tn');
  });

  it('falls back to the email as the heading when no name was captured', () => {
    // Every delegation invited before names existed returns nulls, so "not provided"
    // must be a supported state rather than an error or a blank heading.
    render();
    flushDetail(detail({ firstName: null, lastName: null }));

    const header = (fixture.nativeElement as HTMLElement).querySelector('oc-page-header');
    expect(header?.textContent).toContain('assistant@cabinet.tn');
    expect(fixture.componentInstance.hasName()).toBe(false);
    expect(text()).toContain('Not provided');
  });

  it('renders one name when only one was captured', () => {
    render();
    flushDetail(detail({ firstName: 'Amira', lastName: null }));

    expect(fixture.componentInstance.displayName()).toBe('Amira');
    expect(text()).toContain('Not provided');
  });

  it('lists every granted permission as its own chip', () => {
    // The list view joined these into one string, which was unreadable at five permissions
    // and hid what was actually delegated.
    render();
    flushDetail(
      detail({
        permissions: [
          'VIEW_AGENDA',
          'CREATE_APPOINTMENT',
          'RESCHEDULE_APPOINTMENT',
          'CANCEL_APPOINTMENT',
          'VIEW_PATIENT_CONTACT',
        ],
      }),
    );

    const chips = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.team-detail__permission'),
    ).map((chip) => chip.textContent?.trim());

    expect(chips).toEqual([
      'View agenda',
      'Create appointments',
      'Reschedule appointments',
      'Cancel appointments',
      'View patient contact details',
    ]);
  });

  it('says so plainly when nothing is granted', () => {
    render();
    flushDetail(detail({ permissions: [] }));

    expect(text()).toContain('No permissions granted');
  });

  it('offers the permission editor for an open, active, or suspended delegation', () => {
    const editable: readonly SecretaryMembershipStatus[] = ['INVITED', 'ACTIVE', 'SUSPENDED'];

    for (const status of editable) {
      fixture = TestBed.createComponent(TeamDetailPage);
      fixture.detectChanges();
      http.expectOne('/api/v1/me/secretaries/mem-1').flush(detail({ status }));
      fixture.detectChanges();

      expect(buttonLabels()).toContain('Manage permissions');
      fixture.destroy();
    }
  });

  it('refuses the editor on an ended delegation and explains why', () => {
    render();
    flushDetail(detail({ status: 'ENDED', endedAt: '2026-08-04T09:00:00Z' }));

    expect(buttonLabels()).not.toContain('Manage permissions');
    expect(text()).toContain('no longer be changed');
  });

  it('seeds the editor with the server set, then sends the whole replacement set', () => {
    render();
    flushDetail(detail());

    expect(fixture.componentInstance.permissionForm.getRawValue().permissions).toEqual([
      'VIEW_AGENDA',
      'CREATE_APPOINTMENT',
      'VIEW_PATIENT_CONTACT',
    ]);

    fixture.componentInstance.startEditing();
    fixture.componentInstance.permissionForm.controls.permissions.setValue([
      'VIEW_AGENDA',
      'MANAGE_AGENDA',
    ]);
    fixture.componentInstance.savePermissions();
    fixture.detectChanges();

    const patch = http.expectOne('/api/v1/me/secretaries/mem-1/permissions');
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.body).toEqual({ permissions: ['VIEW_AGENDA', 'MANAGE_AGENDA'] });

    // Re-read rather than trusting the request: the server decides what was stored.
    patch.flush(detail({ permissions: ['VIEW_AGENDA', 'MANAGE_AGENDA'] }));
    flushDetail(detail({ permissions: ['VIEW_AGENDA', 'MANAGE_AGENDA'] }));

    expect(fixture.componentInstance.notice()).toBe('Permissions updated.');
    expect(fixture.componentInstance.editingPermissions()).toBe(false);
  });

  it('reopens the editor on the stored set, not on what a cancelled attempt typed', () => {
    render();
    flushDetail(detail());

    fixture.componentInstance.startEditing();
    fixture.componentInstance.permissionForm.controls.permissions.setValue(['CANCEL_APPOINTMENT']);
    fixture.componentInstance.cancelEditing();
    fixture.componentInstance.startEditing();

    expect(fixture.componentInstance.permissionForm.getRawValue().permissions).toEqual([
      'VIEW_AGENDA',
      'CREATE_APPOINTMENT',
      'VIEW_PATIENT_CONTACT',
    ]);
  });

  it('shows the backend wording when a replacement set is refused', () => {
    render();
    flushDetail(detail());

    fixture.componentInstance.startEditing();
    fixture.componentInstance.permissionForm.controls.permissions.setValue([]);
    fixture.componentInstance.savePermissions();
    fixture.detectChanges();

    http.expectOne('/api/v1/me/secretaries/mem-1/permissions').flush(
      { code: 'secretary-permission-empty', message: 'raw backend text' },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    fixture.detectChanges();

    expect(text()).toContain('Grant at least one permission.');
    expect(text()).not.toContain('raw backend text');
    // The editor stays open so the mistake is recoverable in place.
    expect(fixture.componentInstance.editingPermissions()).toBe(true);
  });

  it('re-reads after suspending instead of patching local state', () => {
    render();
    flushDetail(detail());

    fixture.componentInstance.requestAction('suspend');
    fixture.componentInstance.confirmAction();

    http.expectOne('/api/v1/me/secretaries/mem-1/suspension').flush({});
    flushDetail(detail({ status: 'SUSPENDED', suspendedAt: '2026-08-05T09:00:00Z' }));

    expect(fixture.componentInstance.notice()).toBe('assistant@cabinet.tn is suspended.');
    expect(text()).toContain('Suspended');
  });

  it('resends an open invitation and re-reads the new expiry', () => {
    render();
    flushDetail(detail({ status: 'INVITED', activatedAt: null, invitationExpiresAt: '2026-08-08T09:00:00Z' }));

    fixture.componentInstance.requestAction('resend');
    fixture.componentInstance.confirmAction();

    http.expectOne('/api/v1/me/secretaries/mem-1/invitation/resend').flush({});
    flushDetail(detail({ status: 'INVITED', activatedAt: null, invitationExpiresAt: '2026-08-15T09:00:00Z' }));

    expect(fixture.componentInstance.notice()).toBe(
      'Invitation resent to assistant@cabinet.tn.',
    );
    expect(fixture.componentInstance.member()?.invitationExpiresAt).toBe('2026-08-15T09:00:00Z');
  });

  it('offers suspend only while active, and end for anything not already ended', () => {
    render();
    flushDetail(detail({ status: 'INVITED', activatedAt: null }));
    expect(buttonLabels()).not.toContain('Suspend');
    expect(buttonLabels()).toContain('End access');

    fixture.destroy();
    render();
    flushDetail(detail({ status: 'ENDED', endedAt: '2026-08-04T09:00:00Z' }));
    expect(buttonLabels()).not.toContain('Suspend');
    expect(buttonLabels()).not.toContain('End access');
    expect(text()).toContain('No further action is available');
  });

  it('maps a failure to the contract wording and keeps the page usable', () => {
    render();
    http.expectOne('/api/v1/me/secretaries/mem-1').flush(
      { code: 'secretary-doctor-role-required', message: 'raw backend text' },
      { status: 403, statusText: 'Forbidden' },
    );
    fixture.detectChanges();

    expect(text()).toContain('Only a doctor can manage their delegation.');
    expect(text()).not.toContain('raw backend text');
    expect((fixture.nativeElement as HTMLElement).querySelector('.team-detail__error')).not.toBeNull();
  });

  it('links back to the team list', () => {
    render();
    flushDetail(detail());

    const back = (fixture.nativeElement as HTMLElement).querySelector('a.back-link');
    expect(back?.getAttribute('href')).toBe('/doctor/team');
  });
});

function routeParams(membershipId: string): Map<string, string> {
  return new Map([['membershipId', membershipId]]);
}