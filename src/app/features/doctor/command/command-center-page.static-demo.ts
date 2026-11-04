import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { Params, RouterLink } from '@angular/router';

import { OcIcon } from '../../../shared/ui';

type AppointmentState = 'completed' | 'active' | 'confirmed' | 'upcoming';
type AvatarTone = 'mint' | 'blue' | 'rose';

interface DemoAppointment {
  readonly id: string;
  readonly time: string;
  readonly patient: string;
  readonly initials: string;
  readonly reason: string;
  readonly state: AppointmentState;
  readonly status: string;
  readonly avatarTone: AvatarTone;
  readonly route: readonly string[];
  readonly queryParams?: Params;
}

interface DemoRequest {
  readonly id: string;
  readonly patient: string;
  readonly initials: string;
  readonly reason: string;
  readonly date: string;
  readonly time: string;
  readonly avatarTone: AvatarTone;
}

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

@Component({
  selector: 'app-command-center-page',
  imports: [RouterLink, OcIcon],
  templateUrl: './command-center-page.static-demo.html',
  styleUrl: './command-center-page.static-demo.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommandCenterPage {
  readonly activeConsultationId = ACTIVE_CONSULTATION_ID;
  readonly dashboardDateLabel = formatDemoDate('2026-10-29T11:00:00.000Z', true);
  readonly nextAppointmentStart = formatDemoTime('2026-10-29T14:30:00.000Z');
  readonly nextAppointmentEnd = formatDemoTime('2026-10-29T15:00:00.000Z');

  readonly appointments = signal<readonly DemoAppointment[]>([
    {
      id: 'demo-appointment-sophie',
      time: formatDemoTime('2026-10-29T07:30:00.000Z'),
      patient: 'Sophie Martin',
      initials: 'SM',
      reason: 'Consultation de suivi',
      state: 'completed',
      status: 'Terminée',
      avatarTone: 'mint',
      route: ['/doctor/history'],
    },
    {
      id: 'demo-appointment-karim',
      time: formatDemoTime('2026-10-29T08:15:00.000Z'),
      patient: 'Karim Haddad',
      initials: 'KH',
      reason: 'Infection ORL',
      state: 'completed',
      status: 'Terminée',
      avatarTone: 'blue',
      route: ['/doctor/history'],
    },
    {
      id: 'demo-appointment-amira',
      time: formatDemoTime('2026-10-29T09:00:00.000Z'),
      patient: 'Amira Ben Salah',
      initials: 'AS',
      reason: 'Douleurs abdominales',
      state: 'active',
      status: 'En cours',
      avatarTone: 'rose',
      route: ['/doctor/consultation', ACTIVE_CONSULTATION_ID],
    },
    {
      id: 'demo-appointment-julie',
      time: formatDemoTime('2026-10-29T09:45:00.000Z'),
      patient: 'Julie Moreau',
      initials: 'JM',
      reason: 'Contrôle post-opératoire',
      state: 'confirmed',
      status: 'Confirmé',
      avatarTone: 'blue',
      route: ['/doctor/calendar'],
      queryParams: { appointmentId: 'demo-appointment-julie' },
    },
    {
      id: 'demo-appointment-ahmed',
      time: formatDemoTime('2026-10-29T10:30:00.000Z'),
      patient: 'Ahmed Rachid',
      initials: 'AR',
      reason: 'Suivi diabète',
      state: 'upcoming',
      status: 'À venir',
      avatarTone: 'rose',
      route: ['/doctor/calendar'],
      queryParams: { appointmentId: 'demo-appointment-ahmed' },
    },
    {
      id: 'demo-appointment-marc',
      time: formatDemoTime('2026-10-29T14:30:00.000Z'),
      patient: 'Marc Legrand',
      initials: 'ML',
      reason: 'Suivi d’hypertension',
      state: 'upcoming',
      status: 'À venir',
      avatarTone: 'mint',
      route: ['/doctor/calendar'],
      queryParams: { appointmentId: 'demo-appointment-marc' },
    },
  ]);

  readonly requests = signal<readonly DemoRequest[]>([
    {
      id: 'demo-request-claire',
      patient: 'Claire Bernard',
      initials: 'CB',
      reason: 'Toux persistante',
      date: formatDemoDate('2026-10-31T09:00:00.000Z'),
      time: formatDemoTime('2026-10-31T09:00:00.000Z'),
      avatarTone: 'rose',
    },
    {
      id: 'demo-request-thomas',
      patient: 'Thomas Henry',
      initials: 'TH',
      reason: 'Renouvellement d’ordonnance',
      date: formatDemoDate('2026-10-30T13:30:00.000Z'),
      time: formatDemoTime('2026-10-30T13:30:00.000Z'),
      avatarTone: 'blue',
    },
  ]);
}
