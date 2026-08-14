import { Routes } from '@angular/router';

import { authenticatedGuard } from '../../core/auth/auth.guards';
import { clinicHandoversGuard, clinicPositionsGuard, clinicRequestsGuard, clinicResponsibilitiesGuard, clinicRoutingIncidentsGuard, clinicStaffGuard, clinicTasksGuard } from './clinic-capability.guard';

export const CLINIC_ROUTES: Routes = [
  {
    path: '',
    canActivate: [authenticatedGuard],
    loadComponent: () => import('./clinic-shell').then((component) => component.ClinicShell),
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./clinic-entry-page').then((component) => component.ClinicEntryPage),
        title: 'Clinic workspace | OmniCare',
      },
      {
        path: 'select',
        loadComponent: () =>
          import('./clinic-select-page').then((component) => component.ClinicSelectPage),
        title: 'Select a clinic | OmniCare',
      },
      {
        path: 'requests',
        canActivate: [clinicRequestsGuard],
        loadComponent: () =>
          import('./clinic-intake-page').then((component) => component.ClinicIntakePage),
        title: 'Clinic requests | OmniCare',
      },
      {
        path: 'requests/:caseId',
        canActivate: [clinicRequestsGuard],
        loadComponent: () =>
          import('./clinic-request-detail-page').then(
            (component) => component.ClinicRequestDetailPage,
          ),
        title: 'Request detail | OmniCare',
      },
      {
        path: 'tasks/queue',
        canActivate: [clinicTasksGuard],
        data: { kind: 'queue' },
        loadComponent: () =>
          import('./clinic-task-list-page').then((component) => component.ClinicTaskListPage),
        title: 'Position Queue | OmniCare',
      },
      {
        path: 'tasks/my',
        canActivate: [clinicTasksGuard],
        data: { kind: 'my' },
        loadComponent: () =>
          import('./clinic-task-list-page').then((component) => component.ClinicTaskListPage),
        title: 'My Tasks | OmniCare',
      },
      {
        path: 'tasks/:taskId',
        canActivate: [clinicTasksGuard],
        loadComponent: () =>
          import('./clinic-task-detail-page').then(
            (component) => component.ClinicTaskDetailPage,
          ),
        title: 'Task detail | OmniCare',
      },
      {
        path: 'handovers',
        canActivate: [clinicHandoversGuard],
        loadComponent: () =>
          import('./clinic-handovers-page').then((component) => component.ClinicHandoversPage),
        title: 'Task handovers | OmniCare',
      },
      {
        path: 'routing-incidents',
        canActivate: [clinicRoutingIncidentsGuard],
        loadComponent: () =>
          import('./clinic-routing-incidents-page').then(
            (component) => component.ClinicRoutingIncidentsPage,
          ),
        title: 'Routing incidents | OmniCare',
      },
      {
        path: 'routing-incidents/:incidentId',
        canActivate: [clinicRoutingIncidentsGuard],
        loadComponent: () =>
          import('./clinic-routing-incident-detail-page').then(
            (component) => component.ClinicRoutingIncidentDetailPage,
          ),
        title: 'Routing incident | OmniCare',
      },
      { path: 'positions', canActivate: [clinicPositionsGuard], loadComponent: () => import('./clinic-positions-page').then((c) => c.ClinicPositionsPage), title: 'Positions | OmniCare' },
      { path: 'positions/:positionId', canActivate: [clinicPositionsGuard], loadComponent: () => import('./clinic-position-detail-page').then((c) => c.ClinicPositionDetailPage), title: 'Position detail | OmniCare' },
      { path: 'responsibilities', canActivate: [clinicResponsibilitiesGuard], loadComponent: () => import('./clinic-responsibilities-page').then((c) => c.ClinicResponsibilitiesPage), title: 'Responsibilities | OmniCare' },
      { path: 'responsibilities/:responsibilityId', canActivate: [clinicResponsibilitiesGuard], loadComponent: () => import('./clinic-responsibility-detail-page').then((c) => c.ClinicResponsibilityDetailPage), title: 'Responsibility detail | OmniCare' },
      {
        path: 'staff',
        canActivate: [clinicStaffGuard],
        loadComponent: () =>
          import('./clinic-staff-page').then((component) => component.ClinicStaffPage),
        title: 'Clinic staff | OmniCare',
      },
      {
        path: 'staff/:membershipId',
        canActivate: [clinicStaffGuard],
        loadComponent: () =>
          import('./clinic-staff-detail-page').then(
            (component) => component.ClinicStaffDetailPage,
          ),
        title: 'Staff member | OmniCare',
      },
      {
        path: 'access-unavailable',
        loadComponent: () =>
          import('./clinic-access-unavailable-page').then(
            (component) => component.ClinicAccessUnavailablePage,
          ),
        title: 'Clinic access unavailable | OmniCare',
      },
      { path: '**', redirectTo: 'requests' },
    ],
  },
];
