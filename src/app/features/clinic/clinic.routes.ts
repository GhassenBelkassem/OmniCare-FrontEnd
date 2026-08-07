import { Routes } from '@angular/router';

import { authenticatedGuard } from '../../core/auth/auth.guards';

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
        path: 'overview',
        loadComponent: () =>
          import('./clinic-overview-page').then((component) => component.ClinicOverviewPage),
        title: 'Clinic overview | OmniCare',
      },
      {
        path: 'access-unavailable',
        loadComponent: () =>
          import('./clinic-access-unavailable-page').then(
            (component) => component.ClinicAccessUnavailablePage,
          ),
        title: 'Clinic access unavailable | OmniCare',
      },
      { path: '**', redirectTo: '' },
    ],
  },
];
