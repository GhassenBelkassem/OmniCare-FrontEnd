import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router, RouterOutlet, Routes } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { ClinicBootstrapResponse } from './clinic-api.models';
import { ClinicContextStore } from './clinic-context.store';
import { ClinicShell } from './clinic-shell';

@Component({ template: '<p>Requests routed content</p>' })
class RequestsProbe {}

@Component({ template: '<p>My Tasks routed content</p>' })
class MyTasksProbe {}

@Component({ template: '<p>Handovers routed content</p>' })
class HandoversProbe {}

@Component({ imports: [RouterOutlet], template: '<router-outlet />' })
class RouterHost {}

const ROUTES: Routes = [
  {
    path: 'clinic',
    component: ClinicShell,
    children: [
      { path: 'requests', component: RequestsProbe },
      { path: 'tasks/my', component: MyTasksProbe },
      { path: 'handovers', component: HandoversProbe },
    ],
  },
];

describe('ClinicShell routed content', () => {
  let fixture: ComponentFixture<RouterHost>;
  let router: Router;

  beforeEach(() => {
    const bootstrap = signal<ClinicBootstrapResponse | null>({
      contractVersion: '1.0',
      clinic: { clinicId: 'clinic-a', clinicName: 'Clinic A', clinicStatus: 'ACTIVE' },
      membership: { membershipId: 'member-a', membershipStatus: 'ACTIVE', professionalRole: 'CLINIC_ADMIN', version: 1 },
      capabilities: ['CLINIC_CASE_INTAKE_READ', 'CLINIC_TASK_READ', 'CLINIC_TASK_HANDOVER'],
      featureFlags: {},
      resolvedAt: '2026-09-14T12:00:00Z',
    });
    TestBed.configureTestingModule({
      imports: [RouterHost],
      providers: [
        provideRouter(ROUTES),
        { provide: ClinicContextStore, useValue: { bootstrap, clear: vi.fn() } },
        { provide: AuthService, useValue: { logout: vi.fn() } },
      ],
    });
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(RouterHost);
  });

  it('renders the workspace header, main container, and representative child content', async () => {
    await navigate('/clinic/requests');

    expect(fixture.nativeElement.querySelector('.clinic-context-bar')).toBeTruthy();
    const main = fixture.nativeElement.querySelector('#clinic-content') as HTMLElement;
    expect(main).toBeTruthy();
    expect(main.textContent).toContain('Requests routed content');
  });

  it('retains activated content when navigating between Requests, My Tasks, and Handovers', async () => {
    await navigate('/clinic/requests');
    expect(content()).toContain('Requests routed content');

    await navigate('/clinic/tasks/my');
    expect(content()).toContain('My Tasks routed content');

    await navigate('/clinic/handovers');
    expect(content()).toContain('Handovers routed content');
  });

  it('does not hide routed content after mobile navigation closes', async () => {
    await navigate('/clinic/tasks/my');
    const component = fixture.debugElement.query((node) => node.componentInstance instanceof ClinicShell)
      .componentInstance as ClinicShell;
    component.mobileNavigationOpen.set(true);
    fixture.detectChanges();
    component.mobileNavigationOpen.set(false);
    fixture.detectChanges();

    expect(content()).toContain('My Tasks routed content');
  });

  it('creates safely before route activation without browser-only shell reads', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  async function navigate(url: string): Promise<void> {
    await router.navigateByUrl(url);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function content(): string {
    return (fixture.nativeElement.querySelector('#clinic-content')?.textContent ?? '') as string;
  }
});
