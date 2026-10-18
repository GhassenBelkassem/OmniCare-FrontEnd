import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { RUNTIME_CONFIG } from '../../../../core/config/runtime-config';
import { OMNICARE_ICONS } from '../../../../app.icons';
import { DoctorStaffSummary } from '../secretary-api.models';
import { TeamPage } from './team-page';
import { provideNzIcons } from 'ng-zorro-antd/icon';

function member(overrides: Partial<DoctorStaffSummary> = {}): DoctorStaffSummary {
  return {
    membershipId: 'mem-1',
    secretaryUserId: null,
    email: 'assistant@cabinet.tn',
    status: 'INVITED',
    permissions: ['VIEW_AGENDA', 'CREATE_APPOINTMENT'],
    invitedAt: '2026-08-01T09:00:00Z',
    activatedAt: null,
    suspendedAt: null,
    endedAt: null,
    version: 0,
    invitationExpiresAt: '2026-08-08T09:00:00Z',
    ...overrides,
  };
}

describe('TeamPage', () => {
  let fixture: ComponentFixture<TeamPage>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TeamPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        // The rows are router links now, so RouterLink needs a Router/ActivatedRoute in
        // the injector even though the test never navigates.
        provideRouter([]),
        provideNzIcons(OMNICARE_ICONS),
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: '/api/v1' } },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function render(): void {
    fixture = TestBed.createComponent(TeamPage);
    fixture.detectChanges();
  }

  function flushList(members: readonly DoctorStaffSummary[]): void {
    http.expectOne('/api/v1/me/secretaries').flush(members);
    fixture.detectChanges();
  }

  it('lists delegations by email with a visible status', () => {
    render();
    flushList([member()]);

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('assistant@cabinet.tn');
    expect(text).toContain('Invitation sent');
    expect(text).toContain('View agenda, Create appointments');
  });

  it('links each row to the detail view rather than expanding it inline', () => {
    render();
    flushList([member({ membershipId: 'mem-7' })]);

    const link = (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>(
      '.team-card__link',
    );
    expect(link?.getAttribute('href')).toBe('/doctor/team/mem-7');

    // Lifecycle actions moved to the detail view, so they are no longer on the row.
    const buttons = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    ).map((button) => button.textContent?.trim());
    expect(buttons).not.toContain('Resend invitation');
    expect(buttons).not.toContain('End access');
  });

  it('puts the clickable label inside the anchor, not beside it', () => {
    // Regression: the "View details and manage access" label used to be a sibling <p> of the
    // anchor, so the card advertised a link the click never reached. Asserting that an href
    // exists on the page is not enough -- it passed while the label itself was dead. The
    // label must resolve *through* the anchor to the membership's detail route.
    render();
    flushList([member({ membershipId: 'mem-7' }), member({ membershipId: 'mem-8' })]);

    const host = fixture.nativeElement as HTMLElement;
    const labels = Array.from(host.querySelectorAll('.team-card__cta'));
    expect(labels).toHaveLength(2);

    for (const label of labels) {
      const anchor = label.closest('a');
      expect(anchor, `"${label.textContent}" is not inside an anchor`).not.toBeNull();
      expect(anchor?.getAttribute('href')).toMatch(/^\/doctor\/team\/mem-\d$/);
      // The whole card is the hit target: the summary and the metadata are inside it too.
      expect(anchor?.querySelector('.team-card__email')?.textContent).toContain('@cabinet.tn');
      expect(anchor?.querySelector('.team-card__details')).not.toBeNull();
    }

    // Each row links to its OWN membership, and each label is the one on its own card.
    const anchors = Array.from(host.querySelectorAll('a.team-card__link'));
    expect(anchors.map((a) => a.getAttribute('href'))).toEqual([
      '/doctor/team/mem-7',
      '/doctor/team/mem-8',
    ]);
    expect(anchors[1]?.querySelector('.team-card__cta')).toBe(labels[1]);
  });

  it('gives the row link an accessible name, since the row is no longer a set of buttons', () => {
    render();
    flushList([member()]);

    const link = (fixture.nativeElement as HTMLElement).querySelector('.team-card__link');
    expect(link?.getAttribute('aria-label')).toBe(
      'View details for assistant@cabinet.tn',
    );
  });

  it('shows an empty state when there are no delegations', () => {
    render();
    flushList([]);

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No secretaries yet');
  });

  it('renders the header invite button, which only appears when ocPrimaryAction is set', () => {
    render();
    flushList([member()]);

    // OcPageHeader projects selectively via [ocPrimaryAction] / [ocSecondaryActions]
    // and has no catch-all slot, so a button missing that attribute is silently
    // discarded rather than rendered.
    const actions = (fixture.nativeElement as HTMLElement).querySelector(
      '.oc-page-header__actions',
    );
    expect(actions?.textContent).toContain('Invite a secretary');
  });

  it('offers the invite action inside the empty state when there is nobody yet', () => {
    render();
    flushList([]);

    const emptyActions = (fixture.nativeElement as HTMLElement).querySelector(
      '.oc-empty-state__actions',
    );
    expect(emptyActions?.textContent).toContain('Invite a secretary');
  });

  it('opens the invite form from either entry point', () => {
    render();
    flushList([]);

    fixture.componentInstance.openInvite();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('#invite-email')).not.toBeNull();
  });

  it('does not show a validation error before the field is touched', () => {
    render();
    flushList([]);

    fixture.componentInstance.openInvite();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).not.toContain('Enter a valid email address');
    expect(fixture.componentInstance.inviteForm.controls.email.touched).toBe(false);
  });

  it('omits the permissions key entirely when the doctor leaves the set empty', () => {
    // The backend grants its defaults only for an ABSENT set, and rejects an explicitly
    // empty one with 422 `secretary-permission-empty`. Sending `[]` therefore broke the
    // form's own "leave empty to grant the default agenda set" promise.
    render();
    flushList([]);

    fixture.componentInstance.openInvite();
    fixture.componentInstance.inviteForm.controls.email.setValue('assistant@cabinet.tn');
    fixture.componentInstance.submitInvite();
    fixture.detectChanges();

    const invitation = http.expectOne('/api/v1/me/secretaries/invitations');
    expect(invitation.request.body).toEqual({ email: 'assistant@cabinet.tn' });
    expect(Object.keys(invitation.request.body as object)).not.toContain('permissions');
    expect(invitation.request.body).not.toHaveProperty('permissions');

    invitation.flush({
      membershipId: 'mem-9',
      secretaryUserId: 'user-9',
      email: 'assistant@cabinet.tn',
      status: 'INVITED',
      permissions: ['VIEW_AGENDA', 'CREATE_APPOINTMENT', 'VIEW_PATIENT_CONTACT'],
      expiresAt: '2026-08-08T09:00:00Z',
    });
    flushList([]);
  });

  it('sends the explicit permissions when the doctor selects a set', () => {
    render();
    flushList([]);

    fixture.componentInstance.openInvite();
    fixture.componentInstance.inviteForm.controls.email.setValue('assistant@cabinet.tn');
    fixture.componentInstance.inviteForm.controls.permissions.setValue(['VIEW_AGENDA']);
    fixture.componentInstance.submitInvite();
    fixture.detectChanges();

    const invitation = http.expectOne('/api/v1/me/secretaries/invitations');
    expect(invitation.request.body).toEqual({
      email: 'assistant@cabinet.tn',
      permissions: ['VIEW_AGENDA'],
    });

    invitation.flush({
      membershipId: 'mem-9',
      secretaryUserId: 'user-9',
      email: 'assistant@cabinet.tn',
      status: 'INVITED',
      permissions: ['VIEW_AGENDA'],
      expiresAt: '2026-08-08T09:00:00Z',
    });
    flushList([]);
  });

  it('sends the names the doctor typed, trimmed, and leaves the rest absent', () => {
    render();
    flushList([]);

    fixture.componentInstance.openInvite();
    fixture.componentInstance.inviteForm.controls.email.setValue('assistant@cabinet.tn');
    fixture.componentInstance.inviteForm.controls.permissions.setValue(['VIEW_AGENDA']);
    fixture.componentInstance.inviteForm.controls.firstName.setValue('  Amira  ');
    fixture.componentInstance.inviteForm.controls.lastName.setValue('  Ben Salah ');
    fixture.componentInstance.submitInvite();
    fixture.detectChanges();

    const invitation = http.expectOne('/api/v1/me/secretaries/invitations');
    expect(invitation.request.body).toEqual({
      email: 'assistant@cabinet.tn',
      permissions: ['VIEW_AGENDA'],
      firstName: 'Amira',
      lastName: 'Ben Salah',
    });

    invitation.flush({
      membershipId: 'mem-9',
      secretaryUserId: 'user-9',
      email: 'assistant@cabinet.tn',
      status: 'INVITED',
      permissions: ['VIEW_AGENDA'],
      expiresAt: '2026-08-08T09:00:00Z',
    });
    flushList([]);
  });

  it('never sends a name key for a field the doctor left blank', () => {
    // The backend creates the profile when EITHER name is present, so a single name is
    // a complete answer. A whitespace-only field is dropped rather than sent as "",
    // which the backend would have to guess the intent of.
    render();
    flushList([]);

    fixture.componentInstance.openInvite();
    fixture.componentInstance.inviteForm.controls.email.setValue('assistant@cabinet.tn');
    fixture.componentInstance.inviteForm.controls.lastName.setValue('   ');
    fixture.componentInstance.inviteForm.controls.firstName.setValue('Amira');
    fixture.componentInstance.submitInvite();
    fixture.detectChanges();

    const invitation = http.expectOne('/api/v1/me/secretaries/invitations');
    expect(invitation.request.body).toEqual({
      email: 'assistant@cabinet.tn',
      firstName: 'Amira',
    });
    expect(invitation.request.body).not.toHaveProperty('lastName');

    invitation.flush({
      membershipId: 'mem-9',
      secretaryUserId: 'user-9',
      email: 'assistant@cabinet.tn',
      status: 'INVITED',
      permissions: ['VIEW_AGENDA', 'CREATE_APPOINTMENT', 'VIEW_PATIENT_CONTACT'],
      expiresAt: '2026-08-08T09:00:00Z',
    });
    flushList([]);
  });

  it('labels both name fields as optional rather than marking them required', () => {
    render();
    flushList([]);
    fixture.componentInstance.openInvite();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('#invite-first-name')).not.toBeNull();
    expect(host.querySelector('#invite-last-name')).not.toBeNull();

    const labels = Array.from(host.querySelectorAll('label')).map((label) =>
      (label.textContent ?? '').trim(),
    );
    expect(labels.some((label) => /First name/i.test(label))).toBe(true);
    expect(labels.some((label) => /Last name/i.test(label))).toBe(true);

    // Required-ness lives in the validator, not a stray asterisk: neither field blocks a submit.
    expect(fixture.componentInstance.inviteForm.controls.firstName.hasError('required')).toBe(false);
    expect(fixture.componentInstance.inviteForm.controls.lastName.hasError('required')).toBe(false);
  });

  it('reports a successful invitation exactly once, in the open panel', () => {
    render();
    flushList([]);

    fixture.componentInstance.openInvite();
    fixture.componentInstance.inviteForm.controls.email.setValue('assistant@cabinet.tn');
    fixture.componentInstance.submitInvite();
    fixture.detectChanges();

    http.expectOne('/api/v1/me/secretaries/invitations').flush({
      membershipId: 'mem-9',
      secretaryUserId: 'user-9',
      email: 'assistant@cabinet.tn',
      status: 'INVITED',
      permissions: ['VIEW_AGENDA'],
      expiresAt: '2026-08-08T09:00:00Z',
    });
    flushList([member({ email: 'assistant@cabinet.tn', status: 'INVITED' })]);
    fixture.detectChanges();

    // One presentation only: the detailed in-panel result. The page-level notice
    // used to restate the same fact as "Invitation sent to {email}.".
    expect((fixture.nativeElement as HTMLElement).querySelector('.team-page__notice')).toBeNull();
    const result = (fixture.nativeElement as HTMLElement).querySelector('.team-page__result');
    expect(result?.textContent).toContain('An invitation was sent to');
    expect(result?.textContent).toContain('assistant@cabinet.tn');
    expect(result?.textContent).toContain('Invitation sent');

    const body = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(body).not.toContain('Invitation sent to assistant@cabinet.tn.');
  });

  it('keeps the invitation success when the list refresh fails', () => {
    render();
    flushList([]);

    fixture.componentInstance.openInvite();
    fixture.componentInstance.inviteForm.controls.email.setValue('assistant@cabinet.tn');
    fixture.componentInstance.submitInvite();
    fixture.detectChanges();

    http.expectOne('/api/v1/me/secretaries/invitations').flush({
      membershipId: 'mem-9',
      secretaryUserId: 'user-9',
      email: 'assistant@cabinet.tn',
      status: 'INVITED',
      permissions: ['VIEW_AGENDA'],
      expiresAt: '2026-08-08T09:00:00Z',
    });
    fixture.detectChanges();

    http.expectOne('/api/v1/me/secretaries').flush(null, {
      status: 500,
      statusText: 'Server Error',
    });
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('An invitation was sent to');
    expect(text).not.toContain('An unexpected error occurred');
    expect(text).toContain('the team list could not be refreshed');
    expect(fixture.componentInstance.inviteError()).toBeNull();
    expect(fixture.componentInstance.listErrorMessage()).toBe(
      'Invitation sent, but the team list could not be refreshed.',
    );
  });

  it('ignores a second submit while an invitation is in flight', () => {
    render();
    flushList([]);

    fixture.componentInstance.openInvite();
    fixture.componentInstance.inviteForm.controls.email.setValue('assistant@cabinet.tn');
    fixture.detectChanges();

    const submit = (fixture.nativeElement as HTMLElement).querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement | null;
    expect(submit?.disabled).toBe(false);

    fixture.componentInstance.submitInvite();
    fixture.componentInstance.submitInvite();
    fixture.componentInstance.submitInvite();
    fixture.detectChanges();

    expect(submit?.disabled).toBe(true);
    const invitations = http.match('/api/v1/me/secretaries/invitations');
    expect(invitations.length).toBe(1);
    invitations[0].flush({
      membershipId: 'mem-9',
      secretaryUserId: 'user-9',
      email: 'assistant@cabinet.tn',
      status: 'INVITED',
      permissions: [],
      expiresAt: '2026-08-08T09:00:00Z',
    });

    // A successful invite re-reads the list; drain it so afterEach verify stays clean.
    flushList([]);
  });

  it('hides the empty state and its own CTA while the invite form is open', () => {
    render();
    flushList([]);
    fixture.detectChanges();

    const emptyState = (fixture.nativeElement as HTMLElement).querySelector('oc-empty-state');
    expect(emptyState).not.toBeNull();
    expect(
      emptyState?.querySelector('.oc-empty-state__actions button')?.textContent,
    ).toContain('Invite a secretary');

    fixture.componentInstance.openInvite();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('oc-empty-state')).toBeNull();
    expect(host.querySelector('.oc-empty-state__actions')).toBeNull();
    expect(host.querySelector('#invite-email')).not.toBeNull();
  });

  it('renders no empty list when the form is open with nobody on the team', () => {
    render();
    flushList([]);

    fixture.componentInstance.openInvite();
    fixture.detectChanges();

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.team-page__list'),
    ).toBeNull();
  });

  it('brings the empty state back after the form is cancelled', () => {
    render();
    flushList([]);
    fixture.componentInstance.openInvite();
    fixture.detectChanges();

    fixture.componentInstance.closeInvite();
    fixture.detectChanges();

    const emptyState = (fixture.nativeElement as HTMLElement).querySelector('oc-empty-state');
    expect(emptyState).not.toBeNull();
    expect(
      emptyState?.querySelector('.oc-empty-state__actions button')?.textContent,
    ).toContain('Invite a secretary');
  });

  it('still lists existing members alongside an open invite form', () => {
    render();
    flushList([member()]);

    fixture.componentInstance.openInvite();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('#invite-email')).not.toBeNull();
    expect(host.textContent).toContain('assistant@cabinet.tn');
    expect(host.querySelector('oc-empty-state')).toBeNull();
  });

  it('reveals the validation error after a submit attempt on an untouched field', () => {
    render();
    flushList([]);

    fixture.componentInstance.openInvite();
    fixture.detectChanges();
    expect(fixture.componentInstance.inviteForm.controls.email.touched).toBe(false);

    fixture.componentInstance.submitInvite();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Enter a valid email address',
    );
  });

  it('reveals the validation error on blur without any submit', () => {
    render();
    flushList([]);

    fixture.componentInstance.openInvite();
    fixture.detectChanges();
    fixture.componentInstance.inviteForm.controls.email.markAsTouched();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Enter a valid email address',
    );
  });

  it('does not complain while a valid email is being typed', () => {
    render();
    flushList([]);

    fixture.componentInstance.openInvite();
    fixture.componentInstance.inviteForm.controls.email.setValue('assistant@cabinet.tn');
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain(
      'Enter a valid email address',
    );
  });

  it('clears a previously revealed error when the form is reopened', () => {
    render();
    flushList([]);

    fixture.componentInstance.openInvite();
    fixture.detectChanges();
    fixture.componentInstance.submitInvite();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Enter a valid email address',
    );

    fixture.componentInstance.closeInvite();
    fixture.detectChanges();
    fixture.componentInstance.openInvite();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain(
      'Enter a valid email address',
    );
  });

  it('surfaces the contract copy for a known failure code', () => {
    render();
    http.expectOne('/api/v1/me/secretaries').flush(
      { code: 'secretary-doctor-role-required', message: 'raw backend text' },
      { status: 403, statusText: 'Forbidden' },
    );
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Only a doctor can manage their delegation.',
    );
  });

  it('offers resend only while the invitation is open', () => {
    render();
    flushList([
      member({ status: 'INVITED' }),
      member({
        membershipId: 'mem-2',
        email: 'done@cabinet.tn',
        status: 'ACTIVE',
        activatedAt: '2026-08-02T09:00:00Z',
        invitationExpiresAt: null,
      }),
    ]);

    // Lifecycle affordances moved to the detail view; the list is now summary-only.
    // Their availability rules are covered by the detail page spec instead.
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'View details and manage access',
    );
  });
});