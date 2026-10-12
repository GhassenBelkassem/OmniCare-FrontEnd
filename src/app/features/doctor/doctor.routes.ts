import { Routes } from '@angular/router';

import { authenticatedGuard, roleGuard } from '../../core/auth/auth.guards';
import { unsavedChangesGuard } from './unsaved-changes.guard';

export const DOCTOR_ROUTES: Routes = [
  {
    path: '',
    canActivate: [authenticatedGuard, roleGuard('DOCTOR')],
    loadComponent: () => import('./doctor-shell').then((c) => c.DoctorShell),
    title: 'Doctor workspace | OmniCare',
    children: [
      {
        path: '',
        redirectTo: 'command',
        pathMatch: 'full',
      },
      {
        path: 'command',
        loadComponent: () =>
          import('./command/command-center-page').then((c) => c.CommandCenterPage),
        title: 'Accueil | OmniCare',
      },
      {
        path: 'patients',
        loadComponent: () => import('./patients/patients-page').then((c) => c.PatientsPage),
        title: 'Mes Patients | OmniCare',
      },
      {
        path: 'patient/:id',
        loadComponent: () =>
          import('./patient-chart/patient-chart-page').then((c) => c.PatientChartPage),
        title: 'Dossier patient | OmniCare',
      },
      {
        path: 'calendar',
        loadComponent: () => import('./calendar/calendar-page').then((c) => c.CalendarPage),
        title: 'Calendrier | OmniCare',
      },
      {
        path: 'waiting-room',
        loadComponent: () =>
          import('./waiting-room/waiting-room-page').then((c) => c.WaitingRoomPage),
        title: "Salle d'attente | OmniCare",
      },
      {
        path: 'consultation/:id',
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () =>
          import('./consultation/consultation-page').then((c) => c.ConsultationPage),
        title: 'Consultation | OmniCare',
      },
      {
        path: 'prescriptions',
        loadComponent: () =>
          import('./prescriptions/prescriptions-page').then((c) => c.PrescriptionsPage),
        title: 'Prescriptions | OmniCare',
      },
      {
        path: 'results',
        loadComponent: () => import('./results/results-page').then((c) => c.ResultsPage),
        title: 'Résultats et suivi | OmniCare',
      },
      {
        path: 'requests',
        loadComponent: () => import('./requests/requests-page').then((c) => c.RequestsPage),
        title: 'Demandes | OmniCare',
      },
      {
        path: 'urgent-readiness',
        loadComponent: () =>
          import('./urgent-readiness/urgent-readiness-page').then((c) => c.UrgentReadinessPage),
        title: 'Préparation aux urgences | OmniCare',
      },
      {
        path: 'communication',
        loadComponent: () =>
          import('./communication/communication-page').then((c) => c.CommunicationPage),
        title: 'Communication | OmniCare',
      },
      {
        path: 'history',
        loadComponent: () => import('./history/history-page').then((c) => c.HistoryPage),
        title: 'Historique | OmniCare',
      },
      {
        path: 'billing',
        loadComponent: () => import('./billing/billing-page').then((c) => c.BillingPage),
        title: 'Facturation | OmniCare',
      },
      {
        path: 'analytics',
        loadComponent: () => import('./analytics/analytics-page').then((c) => c.AnalyticsPage),
        title: 'Analyses | OmniCare',
      },
      {
        path: 'settings',
        loadComponent: () => import('./settings/settings-page').then((c) => c.SettingsPage),
        title: 'Paramètres | OmniCare',
      },
    ],
  },
];
