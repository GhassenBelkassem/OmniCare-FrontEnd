export type DemoQueueStatus =
  | 'EXPECTED'
  | 'WAITING'
  | 'CALLED'
  | 'IN_CONSULTATION'
  | 'COMPLETED'
  | 'MISSED_CALL'
  | 'LEFT';

export type DemoAppointmentStatus = 'CONFIRMED' | 'NO_SHOW' | 'COMPLETED';
export type DemoWaitingRoomCabinet = 'Cabinet principal' | 'Cabinet annexe';
export type DemoWaitingRoomAppointmentType =
  | 'Suivi'
  | 'Consultation'
  | 'Cabinet'
  | 'Urgence'
  | 'Sans rendez-vous';

export interface DemoQueueEvent {
  readonly id: string;
  readonly at: string;
  readonly label: string;
}

export interface DemoWaitingRoomPatient {
  readonly id: string;
  readonly name: string;
  readonly age: number;
  readonly birthDate: string;
  readonly gender: 'Femme' | 'Homme' | 'Non renseigné';
  readonly insuranceNumber: string;
  readonly phone: string;
  readonly email: string;
  readonly address: string;
  readonly appointmentTime: string | null;
  readonly checkedInAt: string | null;
  readonly calledAt: string | null;
  readonly consultationStartedAt: string | null;
  readonly completedAt: string | null;
  readonly leftAt: string | null;
  readonly cabinet: DemoWaitingRoomCabinet;
  readonly appointmentType: DemoWaitingRoomAppointmentType;
  readonly appointmentStatus: DemoAppointmentStatus;
  readonly queueStatus: DemoQueueStatus;
  readonly walkIn: boolean;
  readonly events: readonly DemoQueueEvent[];
}

export interface DemoPracticePatient {
  readonly id: string;
  readonly name: string;
  readonly age: number;
  readonly birthDate: string;
  readonly gender: DemoWaitingRoomPatient['gender'];
  readonly insuranceNumber: string;
  readonly phone: string;
  readonly email: string;
  readonly address: string;
}

export const DEMO_WAITING_ROOM_DATE = 'Vendredi 30 octobre 2026';
export const DEMO_WAITING_ROOM_TIME = '11:20';
export const DEMO_WAITING_ROOM_REFRESHED_AT = '11:20:05';

function queueEvent(id: string, at: string, label: string): DemoQueueEvent {
  return { id, at, label };
}

export const DEMO_WAITING_ROOM_PATIENTS: readonly DemoWaitingRoomPatient[] = [
  {
    id: 'demo-waiting-marie', name: 'Marie Dupont', age: 34, birthDate: '12/03/1992',
    gender: 'Femme', insuranceNumber: 'TN-2024-1122', phone: '+216 71 234 567',
    email: 'marie.dupont@example.test', address: '12 rue des Jasmins, Tunis 1000',
    appointmentTime: '08:00', checkedInAt: '10:55', calledAt: null,
    consultationStartedAt: null, completedAt: null, leftAt: null,
    cabinet: 'Cabinet principal', appointmentType: 'Suivi', appointmentStatus: 'CONFIRMED',
    queueStatus: 'WAITING', walkIn: false,
    events: [queueEvent('marie-checkin', '10:55', 'Arrivée enregistrée')],
  },
  {
    id: 'demo-waiting-jean', name: 'Jean Martin', age: 52, birthDate: '06/09/1974',
    gender: 'Homme', insuranceNumber: 'TN-2023-0841', phone: '+216 22 410 520',
    email: 'jean.martin@example.test', address: '8 avenue de Carthage, Tunis 1001',
    appointmentTime: '08:30', checkedInAt: '11:08', calledAt: null,
    consultationStartedAt: null, completedAt: null, leftAt: null,
    cabinet: 'Cabinet principal', appointmentType: 'Consultation', appointmentStatus: 'CONFIRMED',
    queueStatus: 'WAITING', walkIn: false,
    events: [queueEvent('jean-checkin', '11:08', 'Arrivée enregistrée')],
  },
  {
    id: 'demo-waiting-sophie', name: 'Sophie Leroy', age: 28, birthDate: '19/05/1998',
    gender: 'Femme', insuranceNumber: 'TN-2025-2045', phone: '+216 55 802 114',
    email: 'sophie.leroy@example.test', address: '21 rue du Lac, Les Berges du Lac',
    appointmentTime: '09:00', checkedInAt: '11:17', calledAt: null,
    consultationStartedAt: null, completedAt: null, leftAt: null,
    cabinet: 'Cabinet annexe', appointmentType: 'Suivi', appointmentStatus: 'CONFIRMED',
    queueStatus: 'WAITING', walkIn: false,
    events: [queueEvent('sophie-checkin', '11:17', 'Arrivée enregistrée')],
  },
  {
    id: 'demo-waiting-pierre', name: 'Pierre Moreau', age: 41, birthDate: '22/11/1985',
    gender: 'Homme', insuranceNumber: 'TN-2022-1740', phone: '+216 98 765 432',
    email: 'pierre.moreau@example.test', address: '4 rue Ibn Khaldoun, Ariana',
    appointmentTime: '09:30', checkedInAt: '10:27', calledAt: '10:54',
    consultationStartedAt: '10:58', completedAt: null, leftAt: null,
    cabinet: 'Cabinet principal', appointmentType: 'Cabinet', appointmentStatus: 'CONFIRMED',
    queueStatus: 'IN_CONSULTATION', walkIn: false,
    events: [
      queueEvent('pierre-checkin', '10:27', 'Arrivée enregistrée'),
      queueEvent('pierre-called', '10:54', 'Patient appelé'),
      queueEvent('pierre-started', '10:58', 'Consultation démarrée'),
    ],
  },
  {
    id: 'demo-waiting-emma', name: 'Emma Richard', age: 37, birthDate: '30/01/1989',
    gender: 'Femme', insuranceNumber: 'TN-2024-3318', phone: '+216 27 654 321',
    email: 'emma.richard@example.test', address: '16 rue de Marseille, Tunis',
    appointmentTime: '10:15', checkedInAt: null, calledAt: null,
    consultationStartedAt: null, completedAt: null, leftAt: null,
    cabinet: 'Cabinet annexe', appointmentType: 'Suivi', appointmentStatus: 'NO_SHOW',
    queueStatus: 'EXPECTED', walkIn: false,
    events: [queueEvent('emma-noshow', '11:10', 'Non-présentation confirmée manuellement')],
  },
  {
    id: 'demo-waiting-claire', name: 'Claire Bernard', age: 46, birthDate: '14/07/1980',
    gender: 'Femme', insuranceNumber: 'TN-2021-6427', phone: '+216 50 123 987',
    email: 'claire.bernard@example.test', address: '33 avenue Habib Bourguiba, Tunis',
    appointmentTime: '10:45', checkedInAt: '11:12', calledAt: null,
    consultationStartedAt: null, completedAt: null, leftAt: null,
    cabinet: 'Cabinet principal', appointmentType: 'Urgence', appointmentStatus: 'CONFIRMED',
    queueStatus: 'WAITING', walkIn: false,
    events: [queueEvent('claire-checkin', '11:12', 'Arrivée enregistrée')],
  },
  {
    id: 'demo-waiting-lucas', name: 'Lucas Petit', age: 31, birthDate: '03/04/1995',
    gender: 'Homme', insuranceNumber: 'TN-2026-0974', phone: '+216 26 987 654',
    email: 'lucas.petit@example.test', address: '5 rue des Orangers, La Marsa',
    appointmentTime: '11:15', checkedInAt: null, calledAt: null,
    consultationStartedAt: null, completedAt: null, leftAt: null,
    cabinet: 'Cabinet principal', appointmentType: 'Suivi', appointmentStatus: 'CONFIRMED',
    queueStatus: 'EXPECTED', walkIn: false, events: [],
  },
  {
    id: 'demo-waiting-nadia', name: 'Nadia Ferchichi', age: 62, birthDate: '11/02/1964',
    gender: 'Femme', insuranceNumber: 'TN-2020-5102', phone: '+216 29 321 456',
    email: 'nadia.ferchichi@example.test', address: '7 rue de la Liberté, La Soukra',
    appointmentTime: '11:30', checkedInAt: null, calledAt: null,
    consultationStartedAt: null, completedAt: null, leftAt: null,
    cabinet: 'Cabinet annexe', appointmentType: 'Consultation', appointmentStatus: 'CONFIRMED',
    queueStatus: 'EXPECTED', walkIn: false, events: [],
  },
  {
    id: 'demo-waiting-karim', name: 'Karim Letaief', age: 38, birthDate: '08/08/1988',
    gender: 'Homme', insuranceNumber: 'TN-2023-8860', phone: '+216 28 111 222',
    email: 'karim.letaief@example.test', address: '25 rue de Palestine, Tunis',
    appointmentTime: '11:45', checkedInAt: null, calledAt: null,
    consultationStartedAt: null, completedAt: null, leftAt: null,
    cabinet: 'Cabinet principal', appointmentType: 'Cabinet', appointmentStatus: 'CONFIRMED',
    queueStatus: 'EXPECTED', walkIn: false, events: [],
  },
  {
    id: 'demo-waiting-salma', name: 'Salma Bouzid', age: 34, birthDate: '17/12/1992',
    gender: 'Femme', insuranceNumber: 'TN-2025-7714', phone: '+216 26 987 654',
    email: 'salma.bouzid@example.test', address: '10 rue du Parc, Sidi Bou Saïd',
    appointmentTime: '12:00', checkedInAt: null, calledAt: null,
    consultationStartedAt: null, completedAt: null, leftAt: null,
    cabinet: 'Cabinet annexe', appointmentType: 'Suivi', appointmentStatus: 'CONFIRMED',
    queueStatus: 'EXPECTED', walkIn: false, events: [],
  },
];

export const DEMO_PRACTICE_PATIENTS: readonly DemoPracticePatient[] = [
  {
    id: 'practice-amira', name: 'Amira Ben Salah', age: 29, birthDate: '18/04/1997',
    gender: 'Femme', insuranceNumber: 'TN-2025-4812', phone: '+216 20 000 303',
    email: 'amira.bensalah@example.test', address: '18 rue de la Paix, Tunis',
  },
  {
    id: 'practice-youssef', name: 'Youssef Khlifi', age: 45, birthDate: '21/06/1981',
    gender: 'Homme', insuranceNumber: 'TN-2021-3104', phone: '+216 98 765 432',
    email: 'youssef.khlifi@example.test', address: '6 rue du Palmier, Ariana',
  },
];

export function minutesFromTime(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

export function timeFromMinutes(value: number): string {
  const normalized = ((value % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
}

export function waitingMinutes(patient: DemoWaitingRoomPatient, now: string): number | null {
  if (!patient.checkedInAt) return null;
  const stoppedAt = patient.calledAt ?? patient.consultationStartedAt ?? patient.completedAt ?? patient.leftAt;
  const effectiveEnd = patient.queueStatus === 'WAITING' ? now : (stoppedAt ?? now);
  return Math.max(0, minutesFromTime(effectiveEnd) - minutesFromTime(patient.checkedInAt));
}

export function compareQueueOrder(
  left: DemoWaitingRoomPatient,
  right: DemoWaitingRoomPatient,
): number {
  if (left.walkIn !== right.walkIn) return left.walkIn ? 1 : -1;
  const appointmentComparison = (left.appointmentTime ?? '99:99').localeCompare(
    right.appointmentTime ?? '99:99',
  );
  if (appointmentComparison !== 0) return appointmentComparison;
  return (left.checkedInAt ?? '99:99').localeCompare(right.checkedInAt ?? '99:99');
}
