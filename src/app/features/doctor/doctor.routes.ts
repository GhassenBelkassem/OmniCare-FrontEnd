import { inject } from '@angular/core';
import { Route, Routes } from '@angular/router';

import { authenticatedGuard, roleGuard } from '../../core/auth/auth.guards';
import { AuthTokenStore } from '../../core/auth/auth-token.store';
import { unsavedChangesGuard } from './unsaved-changes.guard';
import { URGENT_REQUESTS_DATA_SOURCE } from './urgent-requests/urgent-request-queue.models';
import { UrgentRequestsApiDataSource } from './urgent-requests/urgent-requests-api.data-source';

function doctorWorkspaceLanding(): string {
  return inject(AuthTokenStore).user()?.role === 'SECRETARY' ? 'secretary-agenda' : 'command';
}

function doctorOnly(route: Route): Route {
  return { ...route, canActivate: [roleGuard('DOCTOR')] };
}

export const DOCTOR_ROUTES: Routes = [
  {
    path: '',
    canActivate: [authenticatedGuard, roleGuard('DOCTOR', 'SECRETARY')],
    loadComponent: () => import('./doctor-shell').then((c) => c.DoctorShell),
    title: 'Espace médecin | OmniCare',
    children: [
      {
        path: '',
        redirectTo: doctorWorkspaceLanding,
        pathMatch: 'full',
      },
      doctorOnly({
        path: 'command',
        loadComponent: () =>
          import('./command/command-center-page').then((c) => c.CommandCenterPage),
        title: 'Accueil | OmniCare',
      }),
      {
        path: 'secretary-agenda',
        loadComponent: () =>
          import('./secretary/agenda/secretary-agenda-page').then((c) => c.SecretaryAgendaPage),
        title: 'Agenda | OmniCare',
      },
      doctorOnly({
        path: 'team',
        loadComponent: () => import('./secretary/team/team-page').then((c) => c.TeamPage),
        title: 'Mon équipe | OmniCare',
      }),
      doctorOnly({
        path: 'team/:membershipId',
        loadComponent: () =>
          import('./secretary/team/team-detail-page').then((c) => c.TeamDetailPage),
        title: 'Détail du secrétaire | OmniCare',
      }),
      doctorOnly({
        path: 'patients',
        loadComponent: () => import('./patients/patients-page').then((c) => c.PatientsPage),
        title: 'Mes Patients | OmniCare',
      }),
      doctorOnly({
        path: 'patient/:id',
        loadComponent: () =>
          import('./patient-chart/patient-chart-page').then((c) => c.PatientChartPage),
        title: 'Dossier patient | OmniCare',
      }),
      doctorOnly({
        path: 'calendar',
        loadComponent: () => import('./calendar/calendar-page').then((c) => c.CalendarPage),
        title: 'Calendrier | OmniCare',
      }),
      doctorOnly({
        path: 'waiting-room',
        loadComponent: () =>
          import('./unavailable/production-unavailable-page').then(
            (c) => c.ProductionUnavailablePage,
          ),
        data: {
          featureTitle: 'Salle d’attente',
          featureDescription:
            'Le suivi de présence et les changements de statut ne sont pas encore reliés à un service serveur autoritatif.',
        },
        title: "Salle d'attente | OmniCare",
      }),
      doctorOnly({
        path: 'consultation/:id',
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () =>
          import('./consultation/consultation-page').then((c) => c.ConsultationPage),
        title: 'Consultation | OmniCare',
      }),
      doctorOnly({
        path: 'prescriptions',
        loadComponent: () =>
          import('./unavailable/production-unavailable-page').then(
            (c) => c.ProductionUnavailablePage,
          ),
        data: {
          featureTitle: 'Prescriptions & demandes',
          featureDescription:
            'La liste transversale des prescriptions, demandes et modèles ne dispose pas encore d’un contrat serveur de production.',
        },
        title: 'Prescriptions | OmniCare',
      }),
      doctorOnly({
        path: 'documents',
        loadComponent: () => import('./documents/documents-page').then((c) => c.DocumentsPage),
        title: 'Documents & modèles | OmniCare',
      }),
      doctorOnly({
        path: 'results',
        loadComponent: () =>
          import('./unavailable/production-unavailable-page').then(
            (c) => c.ProductionUnavailablePage,
          ),
        data: {
          featureTitle: 'Résultats & suivi',
          featureDescription:
            'La boîte de résultats, les rappels patients et les tâches de suivi ne disposent pas encore d’un stockage serveur de production.',
        },
        title: 'Résultats et suivi | OmniCare',
      }),
      doctorOnly({
        path: 'requests',
        loadComponent: () => import('./requests/requests-page').then((c) => c.RequestsPage),
        title: 'Demandes | OmniCare',
      }),
      doctorOnly({
        path: 'urgent-requests',
        providers: [
          { provide: URGENT_REQUESTS_DATA_SOURCE, useClass: UrgentRequestsApiDataSource },
        ],
        loadComponent: () =>
          import('./urgent-requests/urgent-requests-page').then((c) => c.UrgentRequestsPage),
        title: 'Demandes urgentes | OmniCare',
      }),
      doctorOnly({
        path: 'urgent-readiness',
        loadComponent: () =>
          import('./urgent-readiness/urgent-readiness-page').then((c) => c.UrgentReadinessPage),
        title: 'Préparation aux urgences | OmniCare',
      }),
      doctorOnly({
        path: 'communication',
        loadComponent: () =>
          import('./communication/communication-page').then((c) => c.CommunicationPage),
        title: 'Communication | OmniCare',
      }),
      doctorOnly({
        path: 'history/:consultationId',
        loadComponent: () =>
          import('./history/completed-consultation-page').then((c) => c.CompletedConsultationPage),
        title: 'Consultation terminée | OmniCare',
      }),
      doctorOnly({
        path: 'history',
        loadComponent: () => import('./history/history-page').then((c) => c.HistoryPage),
        title: 'Historique | OmniCare',
      }),
      doctorOnly({
        path: 'billing',
        loadComponent: () => import('./billing/billing-page').then((c) => c.BillingPage),
        title: 'Facturation | OmniCare',
      }),
      doctorOnly({
        path: 'analytics',
        loadComponent: () =>
          import('./unavailable/production-unavailable-page').then(
            (c) => c.ProductionUnavailablePage,
          ),
        data: {
          featureTitle: 'Analyses',
          featureDescription:
            'Les indicateurs d’activité et de revenus ne disposent pas encore d’une source serveur de production vérifiée.',
        },
        title: 'Analyses | OmniCare',
      }),
      doctorOnly({
        path: 'settings',
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () => import('./settings/settings-page').then((c) => c.SettingsPage),
        title: 'Paramètres | OmniCare',
      }),
    ],
  },
];
