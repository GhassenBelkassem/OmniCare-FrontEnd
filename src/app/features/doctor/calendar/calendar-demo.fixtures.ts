export type DemoCalendarCategory =
  'consultation' | 'follow-up' | 'control' | 'annual' | 'vaccination' | 'results' | 'urgent';

export type DemoAppointmentStatus = 'confirmed' | 'pending' | 'completed';

export interface DemoCalendarAppointment {
  readonly id: string;
  readonly patientId: string;
  readonly patientName: string;
  readonly start: string;
  readonly end: string;
  readonly category: DemoCalendarCategory;
  readonly categoryLabel: string;
  readonly status: DemoAppointmentStatus;
  readonly statusLabel: string;
  readonly phone: string;
  readonly email: string;
  readonly birthDate: string;
  readonly age: number;
  readonly reason: string;
  readonly notes: string;
}

export type DemoDayStateKind = 'day-off' | 'weekly-rest' | 'unavailable' | 'exception';

export interface DemoDayState {
  readonly date: string;
  readonly kind: DemoDayStateKind;
  readonly title: string;
  readonly description: string;
}

interface AppointmentSeed {
  readonly date: string;
  readonly time: string;
  readonly patientName: string;
  readonly category: DemoCalendarCategory;
  readonly categoryLabel: string;
  readonly reason?: string;
  readonly status?: DemoAppointmentStatus;
  readonly patientId?: string;
}

const PATIENT_DETAILS: Readonly<
  Record<
    string,
    { patientId: string; phone: string; email: string; birthDate: string; age: number }
  >
> = {
  'Amira Saidi': {
    patientId: 'demo-practice-patient-amira',
    phone: '+216 12 345 678',
    email: 'amira.saidi@example.test',
    birthDate: '12/03/1998',
    age: 28,
  },
  'Sophie Martin': {
    patientId: 'demo-practice-patient-salma',
    phone: '+216 26 987 654',
    email: 'sophie.martin@example.test',
    birthDate: '04/08/1989',
    age: 37,
  },
  'Ahmed Rachid': {
    patientId: 'demo-practice-patient-ahmed-rachid',
    phone: '+216 50 123 987',
    email: 'ahmed.rachid@example.test',
    birthDate: '19/02/1981',
    age: 45,
  },
};

function addMinutes(time: string, minutes: number): string {
  const [hours = 0, currentMinutes = 0] = time.split(':').map(Number);
  const total = hours * 60 + currentMinutes + minutes;
  return `${Math.floor(total / 60)
    .toString()
    .padStart(2, '0')}:${(total % 60).toString().padStart(2, '0')}`;
}

function appointment(seed: AppointmentSeed, index: number): DemoCalendarAppointment {
  const details = PATIENT_DETAILS[seed.patientName] ?? {
    patientId: seed.patientId ?? `demo-calendar-patient-${index + 1}`,
    phone: '+216 71 000 000',
    email: `${seed.patientName.toLowerCase().replaceAll(' ', '.')}@example.test`,
    birthDate: '14/03/1990',
    age: 36,
  };
  const status = seed.status ?? 'confirmed';
  return {
    id: `demo-appointment-${index + 1}`,
    patientId: seed.patientId ?? details.patientId,
    patientName: seed.patientName,
    start: `${seed.date}T${seed.time}:00`,
    end: `${seed.date}T${addMinutes(seed.time, 30)}:00`,
    category: seed.category,
    categoryLabel: seed.categoryLabel,
    status,
    statusLabel:
      status === 'confirmed' ? 'Confirmé' : status === 'completed' ? 'Terminé' : 'À confirmer',
    phone: details.phone,
    email: details.email,
    birthDate: details.birthDate,
    age: details.age,
    reason: seed.reason ?? `${seed.categoryLabel} programmée`,
    notes:
      seed.patientName === 'Amira Saidi'
        ? 'Douleurs à la gorge depuis lundi. Fièvre légère le soir. Souhaite un avis et un traitement si nécessaire.'
        : 'Notes fictives de démonstration. Aucun dossier médical réel n’est affiché.',
  };
}

const APPOINTMENT_SEEDS: readonly AppointmentSeed[] = [
  {
    date: '2026-10-01',
    time: '09:00',
    patientName: 'Mme Dupont',
    category: 'consultation',
    categoryLabel: 'Consultation',
  },
  {
    date: '2026-10-01',
    time: '11:30',
    patientName: 'M. Bernard',
    category: 'follow-up',
    categoryLabel: 'Suivi diabète',
  },
  {
    date: '2026-10-02',
    time: '14:00',
    patientName: 'Mme Martin',
    category: 'consultation',
    categoryLabel: 'Consultation',
  },
  {
    date: '2026-10-02',
    time: '16:30',
    patientName: 'M. Petit',
    category: 'control',
    categoryLabel: 'Contrôle tension',
  },
  {
    date: '2026-10-05',
    time: '09:00',
    patientName: 'M. Moreau',
    category: 'consultation',
    categoryLabel: 'Consultation',
  },
  {
    date: '2026-10-05',
    time: '10:30',
    patientName: 'Mme Richard',
    category: 'follow-up',
    categoryLabel: 'Suivi',
  },
  {
    date: '2026-10-05',
    time: '14:30',
    patientName: 'Mme Mercier',
    category: 'control',
    categoryLabel: 'Contrôle',
  },
  {
    date: '2026-10-06',
    time: '08:30',
    patientName: 'M. Lefevre',
    category: 'annual',
    categoryLabel: 'Bilan annuel',
  },
  {
    date: '2026-10-06',
    time: '15:00',
    patientName: 'Mme Garcia',
    category: 'consultation',
    categoryLabel: 'Consultation',
  },
  {
    date: '2026-10-07',
    time: '09:00',
    patientName: 'Enfant Martin',
    category: 'vaccination',
    categoryLabel: 'Vaccination',
  },
  {
    date: '2026-10-07',
    time: '11:00',
    patientName: 'Mme Roux',
    category: 'consultation',
    categoryLabel: 'Consultation',
  },
  {
    date: '2026-10-09',
    time: '10:00',
    patientName: 'M. Lambert',
    category: 'control',
    categoryLabel: 'Contrôle',
  },
  {
    date: '2026-10-09',
    time: '14:30',
    patientName: 'Mme Petit',
    category: 'follow-up',
    categoryLabel: 'Suivi',
  },
  {
    date: '2026-10-12',
    time: '09:00',
    patientName: 'Mme Nicolas',
    category: 'consultation',
    categoryLabel: 'Consultation',
  },
  {
    date: '2026-10-12',
    time: '16:00',
    patientName: 'M. Caron',
    category: 'results',
    categoryLabel: 'Résultats',
  },
  {
    date: '2026-10-13',
    time: '08:30',
    patientName: 'M. Blanc',
    category: 'follow-up',
    categoryLabel: 'Suivi diabète',
  },
  {
    date: '2026-10-14',
    time: '11:00',
    patientName: 'Mme Morel',
    category: 'consultation',
    categoryLabel: 'Consultation',
  },
  {
    date: '2026-10-14',
    time: '15:30',
    patientName: 'M. Simon',
    category: 'control',
    categoryLabel: 'Contrôle tension',
  },
  {
    date: '2026-10-15',
    time: '09:00',
    patientName: 'Mme Durand',
    category: 'annual',
    categoryLabel: 'Bilan annuel',
  },
  {
    date: '2026-10-15',
    time: '14:00',
    patientName: 'M. Robert',
    category: 'consultation',
    categoryLabel: 'Consultation',
  },
  {
    date: '2026-10-16',
    time: '09:00',
    patientName: 'Mme Leroy',
    category: 'consultation',
    categoryLabel: 'Consultation',
  },
  {
    date: '2026-10-16',
    time: '11:30',
    patientName: 'M. Fournier',
    category: 'follow-up',
    categoryLabel: 'Suivi',
  },
  {
    date: '2026-10-16',
    time: '15:00',
    patientName: 'Mme Girard',
    category: 'control',
    categoryLabel: 'Contrôle',
  },
  {
    date: '2026-10-19',
    time: '09:00',
    patientName: 'Mme Dubois',
    category: 'consultation',
    categoryLabel: 'Consultation',
  },
  {
    date: '2026-10-19',
    time: '11:00',
    patientName: 'Enfant Petit',
    category: 'vaccination',
    categoryLabel: 'Vaccination',
  },
  {
    date: '2026-10-21',
    time: '08:30',
    patientName: 'M. Girard',
    category: 'follow-up',
    categoryLabel: 'Suivi',
  },
  {
    date: '2026-10-21',
    time: '15:00',
    patientName: 'Mme Henry',
    category: 'consultation',
    categoryLabel: 'Consultation',
  },
  {
    date: '2026-10-22',
    time: '10:00',
    patientName: 'M. Leclerc',
    category: 'results',
    categoryLabel: 'Résultats',
  },
  {
    date: '2026-10-22',
    time: '16:30',
    patientName: 'Mme Garcia',
    category: 'consultation',
    categoryLabel: 'Consultation',
  },
  {
    date: '2026-10-23',
    time: '10:00',
    patientName: 'M. Thomas',
    category: 'annual',
    categoryLabel: 'Bilan annuel',
  },
  {
    date: '2026-10-23',
    time: '14:00',
    patientName: 'M. Bernard',
    category: 'follow-up',
    categoryLabel: 'Suivi diabète',
  },
  {
    date: '2026-10-26',
    time: '08:30',
    patientName: 'Sophie Martin',
    category: 'follow-up',
    categoryLabel: 'Suivi',
    reason: 'Suivi – Diabète',
    status: 'completed',
  },
  {
    date: '2026-10-26',
    time: '09:15',
    patientName: 'Thomas Bernard',
    category: 'consultation',
    categoryLabel: 'Consultation',
  },
  {
    date: '2026-10-26',
    time: '10:00',
    patientName: 'Emma Dubois',
    category: 'urgent',
    categoryLabel: 'Urgence',
    status: 'pending',
  },
  {
    date: '2026-10-26',
    time: '11:00',
    patientName: 'Lucas Moreau',
    category: 'follow-up',
    categoryLabel: 'Suivi',
  },
  {
    date: '2026-10-26',
    time: '14:00',
    patientName: 'Nathalie Petit',
    category: 'consultation',
    categoryLabel: 'Consultation',
  },
  {
    date: '2026-10-26',
    time: '15:30',
    patientName: 'Antoine Lefèvre',
    category: 'control',
    categoryLabel: 'Contrôle',
  },
  {
    date: '2026-10-26',
    time: '16:30',
    patientName: 'Julie Caron',
    category: 'follow-up',
    categoryLabel: 'Suivi',
  },
  {
    date: '2026-10-27',
    time: '08:30',
    patientName: 'Marie Lambert',
    category: 'follow-up',
    categoryLabel: 'Suivi',
  },
  {
    date: '2026-10-27',
    time: '09:30',
    patientName: 'Hugo Richard',
    category: 'consultation',
    categoryLabel: 'Consultation',
  },
  {
    date: '2026-10-27',
    time: '11:00',
    patientName: 'Chloé Garnier',
    category: 'control',
    categoryLabel: 'Contrôle',
  },
  {
    date: '2026-10-27',
    time: '13:30',
    patientName: 'Alexandre Blanc',
    category: 'consultation',
    categoryLabel: 'Consultation',
  },
  {
    date: '2026-10-27',
    time: '14:30',
    patientName: 'Manon Robert',
    category: 'follow-up',
    categoryLabel: 'Suivi',
  },
  {
    date: '2026-10-27',
    time: '16:00',
    patientName: 'Paul Mercier',
    category: 'urgent',
    categoryLabel: 'Urgence',
    status: 'pending',
  },
  {
    date: '2026-10-28',
    time: '08:30',
    patientName: 'Élise Rousseau',
    category: 'consultation',
    categoryLabel: 'Consultation',
  },
  {
    date: '2026-10-28',
    time: '10:00',
    patientName: 'Mathieu Girard',
    category: 'control',
    categoryLabel: 'Contrôle',
  },
  {
    date: '2026-10-28',
    time: '11:30',
    patientName: 'Claire Fontaine',
    category: 'consultation',
    categoryLabel: 'Consultation',
  },
  {
    date: '2026-10-28',
    time: '14:00',
    patientName: 'Lucas Bertrand',
    category: 'follow-up',
    categoryLabel: 'Suivi',
  },
  {
    date: '2026-10-28',
    time: '15:00',
    patientName: 'Camille Morel',
    category: 'consultation',
    categoryLabel: 'Consultation',
  },
  {
    date: '2026-10-29',
    time: '09:00',
    patientName: 'Inès Boucher',
    category: 'consultation',
    categoryLabel: 'Consultation',
  },
  {
    date: '2026-10-29',
    time: '10:30',
    patientName: 'David Nguyen',
    category: 'control',
    categoryLabel: 'Contrôle',
  },
  {
    date: '2026-10-29',
    time: '13:30',
    patientName: 'Sarah Karim',
    category: 'consultation',
    categoryLabel: 'Consultation',
  },
  {
    date: '2026-10-29',
    time: '15:00',
    patientName: 'Nathan Petit',
    category: 'follow-up',
    categoryLabel: 'Suivi',
  },
  {
    date: '2026-10-29',
    time: '16:00',
    patientName: 'Amélie Dubreuil',
    category: 'follow-up',
    categoryLabel: 'Suivi',
  },
  {
    date: '2026-10-30',
    time: '08:00',
    patientName: 'Sophie Martin',
    category: 'follow-up',
    categoryLabel: 'Suivi',
    reason: 'Suivi – Diabète',
    status: 'completed',
  },
  {
    date: '2026-10-30',
    time: '09:00',
    patientName: 'Thomas Bernard',
    category: 'consultation',
    categoryLabel: 'Consultation',
    reason: 'Consultation – Douleurs dorsales',
  },
  {
    date: '2026-10-30',
    time: '10:00',
    patientName: 'Amira Saidi',
    category: 'consultation',
    categoryLabel: 'Consultation',
    reason: 'Consultation – Infection ORL',
  },
  {
    date: '2026-10-30',
    time: '11:00',
    patientName: 'Lucas Moreau',
    category: 'follow-up',
    categoryLabel: 'Contrôle',
    reason: 'Contrôle – Tension artérielle',
  },
  {
    date: '2026-10-30',
    time: '13:00',
    patientName: 'Claire Dubois',
    category: 'follow-up',
    categoryLabel: 'Suivi',
    reason: 'Suivi – Résultats d’analyse',
    status: 'completed',
  },
  {
    date: '2026-10-30',
    time: '14:00',
    patientName: 'Karim Ben Ali',
    category: 'urgent',
    categoryLabel: 'Consultation',
    reason: 'Consultation – Douleurs abdominales',
    status: 'pending',
  },
  {
    date: '2026-10-30',
    time: '15:00',
    patientName: 'Emma Lefèvre',
    category: 'consultation',
    categoryLabel: 'Suivi',
    reason: 'Suivi – Asthme',
  },
  {
    date: '2026-10-30',
    time: '16:00',
    patientName: 'Philippe Garnier',
    category: 'annual',
    categoryLabel: 'Consultation',
    reason: 'Consultation – Renouvellement d’ordonnance',
  },
];

export const DEMO_CALENDAR_APPOINTMENTS: readonly DemoCalendarAppointment[] =
  APPOINTMENT_SEEDS.map(appointment);

export const DEMO_CALENDAR_DAY_STATES: readonly DemoDayState[] = [
  {
    date: '2026-10-03',
    kind: 'weekly-rest',
    title: 'Repos hebdomadaire',
    description: 'Jour non travaillé',
  },
  {
    date: '2026-10-10',
    kind: 'weekly-rest',
    title: 'Repos hebdomadaire',
    description: 'Jour non travaillé',
  },
  {
    date: '2026-10-17',
    kind: 'weekly-rest',
    title: 'Repos hebdomadaire',
    description: 'Jour non travaillé',
  },
  {
    date: '2026-10-24',
    kind: 'weekly-rest',
    title: 'Repos hebdomadaire',
    description: 'Jour non travaillé',
  },
  {
    date: '2026-10-31',
    kind: 'day-off',
    title: 'Jour off',
    description: 'Pas de rendez-vous ce jour-là',
  },
  {
    date: '2026-11-01',
    kind: 'exception',
    title: 'Indisponible',
    description: 'Exception configurée',
  },
];
