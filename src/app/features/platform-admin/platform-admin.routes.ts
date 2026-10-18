import { Routes } from '@angular/router';
import { authenticatedGuard, roleGuard } from '../../core/auth/auth.guards';

export const PLATFORM_ADMIN_ROUTES: Routes = [
  {
    path: '',
    canActivate: [authenticatedGuard, roleGuard('ADMIN')],
    loadComponent: () => import('./admin-shell').then((component) => component.AdminShell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'professionals' },
      { path: 'professionals', loadComponent: () => import('./professionals-page').then((component) => component.ProfessionalsPage), title: 'Professionals | OmniCare' },
      { path: 'professionals/:userId', loadComponent: () => import('./professional-detail-page').then((component) => component.ProfessionalDetailPage), title: 'Professional detail | OmniCare' },
      { path: 'patients', loadComponent: () => import('./patients-page').then((component) => component.PatientsPage), title: 'Patients | OmniCare' },
      { path: 'clinics', loadComponent: () => import('./clinics-page').then((component) => component.ClinicsPage), title: 'Clinics | OmniCare' },
      { path: 'clinics/:clinicId', loadComponent: () => import('./clinic-detail-page').then((component) => component.ClinicDetailPage), title: 'Clinic detail | OmniCare' },
    ],
  },
];
