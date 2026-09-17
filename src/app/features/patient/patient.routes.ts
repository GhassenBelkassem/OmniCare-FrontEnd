import { Routes } from '@angular/router';

import { authenticatedGuard, roleGuard } from '../../core/auth/auth.guards';

export const PATIENT_ROUTES: Routes = [
  {
    path: '',
    canActivate: [authenticatedGuard, roleGuard('PATIENT')],
    loadComponent: () => import('./patient-page').then((component) => component.PatientPage),
    title: 'Patient workspace | OmniCare',
  },
  {
    path: 'urgent-request/:id/tracking',
    canActivate: [authenticatedGuard, roleGuard('PATIENT')],
    loadComponent: () =>
      import('./urgent-request-tracking-page').then((component) => component.UrgentRequestTrackingPage),
    title: 'Suivi urgence | OmniCare',
  },
];
