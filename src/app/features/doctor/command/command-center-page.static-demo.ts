import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { CommandCenterView } from './command-center-view';
import type {
  CommandCenterAction,
  CommandCenterAppointmentViewModel,
  CommandCenterRequestViewModel,
  CommandCenterViewModel,
} from './command-center-view.models';

const ACTIVE_CONSULTATION_ID = '11111111-1111-4111-8111-111111111111';
const DEMO_TIME_ZONE = 'Africa/Tunis';

function capitalize(value: string): string {
  return value.length === 0 ? value : value[0].toLocaleUpperCase('fr-FR') + value.slice(1);
}

function formatDemoDate(instant: string, includeYear = false): string {
  return capitalize(
    new Intl.DateTimeFormat('fr-FR', {
      weekday: includeYear ? 'long' : 'short',
      day: 'numeric',
      month: includeYear ? 'long' : 'short',
      year: includeYear ? 'numeric' : undefined,
      timeZone: DEMO_TIME_ZONE,
    }).format(new Date(instant)),
  );
}

function formatDemoTime(instant: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: DEMO_TIME_ZONE,
  }).format(new Date(instant));
}

const APPOINTMENTS: readonly CommandCenterAppointmentViewModel[] = [
  {
    id: 'demo-appointment-sophie',
    time: formatDemoTime('2026-10-29T07:30:00.000Z'),
    patient: 'Sophie Martin',
    initials: 'SM',
    reason: 'Consultation de suivi',
    state: 'completed',
    statusCode: 'COMPLETED',
    status: 'Terminé',
    avatarTone: 'mint',
    action: { kind: 'NAVIGATE', href: '/doctor/history' },
  },
  {
    id: 'demo-appointment-karim',
    time: formatDemoTime('2026-10-29T08:15:00.000Z'),
    patient: 'Karim Haddad',
    initials: 'KH',
    reason: 'Infection ORL',
    state: 'completed',
    statusCode: 'COMPLETED',
    status: 'Terminé',
    avatarTone: 'blue',
    action: { kind: 'NAVIGATE', href: '/doctor/history' },
  },
  {
    id: 'demo-appointment-amira',
    time: formatDemoTime('2026-10-29T09:00:00.000Z'),
    patient: 'Amira Ben Salah',
    initials: 'AS',
    reason: 'Douleurs abdominales',
    state: 'active',
    statusCode: 'IN_PROGRESS',
    status: 'En cours',
    avatarTone: 'rose',
    action: {
      kind: 'NAVIGATE',
      href: `/doctor/consultation/${ACTIVE_CONSULTATION_ID}`,
    },
  },
  {
    id: 'demo-appointment-julie',
    time: formatDemoTime('2026-10-29T09:45:00.000Z'),
    patient: 'Julie Moreau',
    initials: 'JM',
    reason: 'Contrôle post-opératoire',
    state: 'confirmed',
    statusCode: 'CONFIRMED',
    status: 'Confirmé',
    avatarTone: 'blue',
    action: {
      kind: 'NAVIGATE',
      href: '/doctor/calendar?appointmentId=demo-appointment-julie',
    },
  },
  {
    id: 'demo-appointment-ahmed',
    time: formatDemoTime('2026-10-29T10:30:00.000Z'),
    patient: 'Ahmed Rachid',
    initials: 'AR',
    reason: 'Suivi diabète',
    state: 'upcoming',
    statusCode: 'CONFIRMED',
    status: 'Confirmé',
    avatarTone: 'rose',
    action: {
      kind: 'NAVIGATE',
      href: '/doctor/calendar?appointmentId=demo-appointment-ahmed',
    },
  },
  {
    id: 'demo-appointment-marc',
    time: formatDemoTime('2026-10-29T14:30:00.000Z'),
    patient: 'Marc Legrand',
    initials: 'ML',
    reason: 'Suivi d’hypertension',
    state: 'upcoming',
    statusCode: 'CONFIRMED',
    status: 'Confirmé',
    avatarTone: 'mint',
    action: {
      kind: 'NAVIGATE',
      href: '/doctor/calendar?appointmentId=demo-appointment-marc',
    },
  },
];

const REQUESTS: readonly CommandCenterRequestViewModel[] = [
  {
    id: 'demo-request-claire',
    patient: 'Claire Bernard',
    initials: 'CB',
    reason: 'Toux persistante',
    date: formatDemoDate('2026-10-31T09:00:00.000Z'),
    time: formatDemoTime('2026-10-31T09:00:00.000Z'),
    avatarTone: 'rose',
    action: {
      kind: 'NAVIGATE',
      href: '/doctor/requests?requestId=demo-request-claire',
    },
  },
  {
    id: 'demo-request-thomas',
    patient: 'Thomas Henry',
    initials: 'TH',
    reason: 'Renouvellement d’ordonnance',
    date: formatDemoDate('2026-10-30T13:30:00.000Z'),
    time: formatDemoTime('2026-10-30T13:30:00.000Z'),
    avatarTone: 'blue',
    action: {
      kind: 'NAVIGATE',
      href: '/doctor/requests?requestId=demo-request-thomas',
    },
  },
];

@Component({
  selector: 'app-command-center-page',
  imports: [CommandCenterView],
  templateUrl: './command-center-page.static-demo.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommandCenterPage {
  private readonly router = inject(Router);

  readonly model: CommandCenterViewModel = {
    fixtureNote: 'Données fictives présentées uniquement dans la démonstration statique OmniCare.',
    toClose: [],
    greeting: 'Bonjour, Dr Ben Salah',
    dateLabel: formatDemoDate('2026-10-29T11:00:00.000Z', true),
    appointmentCount: APPOINTMENTS.length,
    pendingRequestCount: REQUESTS.length,
    dayLoading: false,
    dayError: null,
    appointments: APPOINTMENTS,
    scheduledCareLoading: false,
    scheduledCareError: null,
    pendingRequests: REQUESTS,
    nextAppointment: {
      patient: 'Marc Legrand',
      initials: 'ML',
      reason: 'Suivi d’hypertension',
      date: 'Aujourd’hui',
      timeRange: `${formatDemoTime('2026-10-29T14:30:00.000Z')} – ${formatDemoTime('2026-10-29T15:00:00.000Z')}`,
      location: 'Cabinet Les Berges',
      room: 'Salle 2',
      avatarTone: 'blue',
      detailAction: {
        kind: 'NAVIGATE',
        href: '/doctor/calendar?appointmentId=demo-appointment-marc',
      },
      startAction: null,
    },
    clinicalLoading: false,
    clinicalError: null,
    clinicalRetryAction: null,
    clinical: {
      title: 'Consultation en cours',
      patient: 'Amira Ben Salah',
      initials: 'AS',
      meta: 'Femme · 29 ans · #78421',
      reasonLabel: 'Motif de consultation',
      reason: 'Douleurs abdominales et nausées depuis 2 jours',
      avatarTone: 'rose',
      primaryLabel: 'Continuer la consultation',
      primaryAction: {
        kind: 'CONTINUE_CONSULTATION',
        consultationId: ACTIVE_CONSULTATION_ID,
        href: `/doctor/consultation/${ACTIVE_CONSULTATION_ID}`,
      },
      secondaryLabel: 'Voir le dossier patient',
      secondaryAction: {
        kind: 'NAVIGATE',
        href: '/doctor/patient/demo-practice-patient-amira',
      },
      statusLabel: null,
    },
    clinicalStarting: false,
    clinicalStartError: null,
    availabilityState: 'ready',
    availabilityTitle: 'Planning à jour',
    availabilityDescription: 'Aucune indisponibilité à venir cette semaine.',
  };

  handleAction(action: CommandCenterAction): void {
    if ('href' in action) void this.router.navigateByUrl(action.href);
  }
}
