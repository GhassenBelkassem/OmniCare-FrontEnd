export type DemoPatientSex = 'F' | 'M' | 'autre';
export type DemoPatientSource = 'OMNICARE' | 'MANUAL' | 'IMPORTED' | 'WALK_IN';
export type DemoPatientLinkage = 'LINKED' | 'POSSIBLE' | 'UNLINKED';
export type DemoPatientCategory = 'LINKED' | 'CABINET' | 'WALK_IN';

export interface DemoPatientRecord {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly dateOfBirth: string;
  readonly sex: DemoPatientSex;
  readonly phone: string;
  readonly email: string | null;
  readonly address: string | null;
  readonly insuranceNumber: string;
  readonly source: DemoPatientSource;
  readonly linkage: DemoPatientLinkage;
  readonly category: DemoPatientCategory;
  readonly lastConsultation: string | null;
  readonly nextAppointment: string | null;
  readonly createdAt: string;
}

const FIRST_NAMES_F = [
  'Amira',
  'Leila',
  'Meriem',
  'Salma',
  'Nadia',
  'Ines',
  'Sarra',
  'Rania',
  'Yasmine',
  'Nour',
  'Ons',
  'Emna',
  'Rahma',
  'Lina',
  'Asma',
  'Sonia',
  'Dorra',
  'Rim',
  'Mouna',
  'Wafa',
] as const;

const FIRST_NAMES_M = [
  'Ahmed',
  'Youssef',
  'Hedi',
  'Karim',
  'Mohamed',
  'Aziz',
  'Sami',
  'Mehdi',
  'Walid',
  'Aymen',
  'Omar',
  'Bilel',
  'Nizar',
  'Fares',
  'Hamza',
  'Ali',
  'Skander',
  'Anis',
  'Malek',
  'Slim',
] as const;

const LAST_NAMES = [
  'Ben Salah',
  'Trabelsi',
  'Mansouri',
  'Khlifi',
  'Baccouche',
  'Rachid',
  'Bouzid',
  'Amara',
  'Ferchichi',
  'Letaief',
  'Gharbi',
  'Ayari',
  'Jaziri',
  'Dridi',
  'Haddad',
  'Kammoun',
  'Chaabane',
  'Masmoudi',
  'Ben Amor',
  'Abid',
  'Saidi',
  'Mejri',
  'Miled',
  'Rekik',
] as const;

const AREAS = [
  'Tunis',
  'La Marsa',
  'Ariana',
  'Le Bardo',
  'Carthage',
  'La Soukra',
  'Ben Arous',
  'Manouba',
] as const;

const SPECIAL_PATIENTS: readonly DemoPatientRecord[] = [
  {
    id: 'demo-practice-patient-amira',
    firstName: 'Amira',
    lastName: 'Ben Salah',
    dateOfBirth: '1985-03-12',
    sex: 'F',
    phone: '+216 20 000 303',
    email: 'amira.bensalah@example.test',
    address: '42 rue Habib-Bourguiba, Tunis 1000',
    insuranceNumber: 'TN-2024-8834',
    source: 'OMNICARE',
    linkage: 'LINKED',
    category: 'LINKED',
    lastConsultation: '2026-10-29T09:00:00+01:00',
    nextAppointment: '2026-11-15T10:30:00+01:00',
    createdAt: '2024-02-12T10:00:00+01:00',
  },
  {
    id: 'demo-practice-patient-ahmed',
    firstName: 'Ahmed',
    lastName: 'Trabelsi',
    dateOfBirth: '1974-06-08',
    sex: 'M',
    phone: '+216 22 410 520',
    email: 'ahmed.trabelsi@example.test',
    address: '18 avenue de la Liberté, Tunis',
    insuranceNumber: 'TN-2023-2198',
    source: 'MANUAL',
    linkage: 'POSSIBLE',
    category: 'CABINET',
    lastConsultation: '2026-10-12T11:15:00+01:00',
    nextAppointment: null,
    createdAt: '2023-09-18T08:30:00+01:00',
  },
  {
    id: 'demo-practice-patient-leila',
    firstName: 'Leila',
    lastName: 'Mansouri',
    dateOfBirth: '1990-01-24',
    sex: 'F',
    phone: '+216 55 802 114',
    email: 'leila.mansouri@example.test',
    address: '7 rue de Carthage, Ariana',
    insuranceNumber: 'TN-2025-6402',
    source: 'IMPORTED',
    linkage: 'UNLINKED',
    category: 'CABINET',
    lastConsultation: '2026-10-28T14:00:00+01:00',
    nextAppointment: '2026-11-05T14:00:00+01:00',
    createdAt: '2025-01-07T14:20:00+01:00',
  },
  {
    id: 'demo-practice-patient-youssef',
    firstName: 'Youssef',
    lastName: 'Khlifi',
    dateOfBirth: '1959-09-17',
    sex: 'M',
    phone: '+216 98 765 432',
    email: null,
    address: 'Sidi Bou Saïd, Tunis',
    insuranceNumber: 'TN-2021-4520',
    source: 'OMNICARE',
    linkage: 'LINKED',
    category: 'LINKED',
    lastConsultation: '2026-10-20T08:45:00+01:00',
    nextAppointment: null,
    createdAt: '2021-05-02T09:00:00+01:00',
  },
  {
    id: 'demo-practice-patient-meriem',
    firstName: 'Meriem',
    lastName: 'Baccouche',
    dateOfBirth: '1997-11-03',
    sex: 'F',
    phone: '+216 27 654 321',
    email: 'meriem.baccouche@example.test',
    address: 'La Soukra, Ariana',
    insuranceNumber: 'TN-2026-1044',
    source: 'MANUAL',
    linkage: 'LINKED',
    category: 'LINKED',
    lastConsultation: '2026-10-18T16:10:00+01:00',
    nextAppointment: '2026-11-02T09:00:00+01:00',
    createdAt: '2026-02-14T16:10:00+01:00',
  },
  {
    id: 'demo-practice-patient-ahmed-rachid',
    firstName: 'Ahmed',
    lastName: 'Rachid',
    dateOfBirth: '1981-02-19',
    sex: 'M',
    phone: '+216 50 123 987',
    email: null,
    address: null,
    insuranceNumber: 'TN-2026-7712',
    source: 'WALK_IN',
    linkage: 'UNLINKED',
    category: 'WALK_IN',
    lastConsultation: '2026-10-25T10:30:00+01:00',
    nextAppointment: null,
    createdAt: '2026-10-25T10:05:00+01:00',
  },
  {
    id: 'demo-practice-patient-salma',
    firstName: 'Salma',
    lastName: 'Bouzid',
    dateOfBirth: '1992-07-31',
    sex: 'F',
    phone: '+216 26 987 654',
    email: 'salma.bouzid@example.test',
    address: 'El Menzah, Tunis',
    insuranceNumber: 'TN-2022-0831',
    source: 'OMNICARE',
    linkage: 'LINKED',
    category: 'LINKED',
    lastConsultation: '2026-10-21T15:00:00+01:00',
    nextAppointment: '2026-11-10T16:00:00+01:00',
    createdAt: '2022-08-03T11:00:00+01:00',
  },
  {
    id: 'demo-practice-patient-hedi',
    firstName: 'Hedi',
    lastName: 'Amara',
    dateOfBirth: '1968-05-22',
    sex: 'M',
    phone: '+216 23 456 789',
    email: 'hedi.amara@example.test',
    address: 'Le Bardo, Tunis',
    insuranceNumber: 'TN-2020-5924',
    source: 'MANUAL',
    linkage: 'POSSIBLE',
    category: 'CABINET',
    lastConsultation: '2026-10-14T09:30:00+01:00',
    nextAppointment: null,
    createdAt: '2020-11-09T12:00:00+01:00',
  },
  {
    id: 'demo-practice-patient-nadia',
    firstName: 'Nadia',
    lastName: 'Ferchichi',
    dateOfBirth: '1964-04-07',
    sex: 'F',
    phone: '+216 29 321 456',
    email: 'nadia.ferchichi@example.test',
    address: 'Carthage, Tunis',
    insuranceNumber: 'TN-2023-9105',
    source: 'OMNICARE',
    linkage: 'LINKED',
    category: 'LINKED',
    lastConsultation: '2026-10-27T13:20:00+01:00',
    nextAppointment: '2026-11-03T11:30:00+01:00',
    createdAt: '2023-03-16T09:00:00+01:00',
  },
  {
    id: 'demo-practice-patient-karim',
    firstName: 'Karim',
    lastName: 'Letaief',
    dateOfBirth: '1988-08-14',
    sex: 'M',
    phone: '+216 28 111 222',
    email: null,
    address: null,
    insuranceNumber: 'TN-2026-8821',
    source: 'WALK_IN',
    linkage: 'UNLINKED',
    category: 'WALK_IN',
    lastConsultation: '2026-10-19T12:00:00+01:00',
    nextAppointment: null,
    createdAt: '2026-10-19T11:35:00+01:00',
  },
] as const;

function pad(value: number, width: number): string {
  return value.toString().padStart(width, '0');
}

function generatedPatient(index: number, category: DemoPatientCategory): DemoPatientRecord {
  const female = index % 2 === 0;
  const firstNames = female ? FIRST_NAMES_F : FIRST_NAMES_M;
  const firstName = firstNames[index % firstNames.length] ?? (female ? 'Amira' : 'Ahmed');
  const lastName =
    LAST_NAMES[Math.floor(index / firstNames.length) % LAST_NAMES.length] ?? 'Ben Salah';
  const year = 1948 + (index % 58);
  const month = (index % 12) + 1;
  const day = (index % 27) + 1;
  const source: DemoPatientSource =
    category === 'LINKED'
      ? 'OMNICARE'
      : category === 'WALK_IN'
        ? 'WALK_IN'
        : index % 3 === 0
          ? 'IMPORTED'
          : 'MANUAL';
  const linkage: DemoPatientLinkage =
    category === 'LINKED' ? 'LINKED' : index % 4 === 0 ? 'POSSIBLE' : 'UNLINKED';
  const lastDay = (index % 28) + 1;
  const hasNextAppointment = index % 3 === 0;
  const area = AREAS[index % AREAS.length] ?? 'Tunis';
  const phonePrefix = 20 + (index % 80);
  const phoneTail = 100000 + ((index * 7919) % 899999);

  return {
    id: `demo-practice-patient-${pad(index, 5)}`,
    firstName,
    lastName,
    dateOfBirth: `${year}-${pad(month, 2)}-${pad(day, 2)}`,
    sex: female ? 'F' : 'M',
    phone: `+216 ${phonePrefix} ${pad(Math.floor(phoneTail / 1000), 3)} ${pad(phoneTail % 1000, 3)}`,
    email:
      index % 5 === 0
        ? null
        : `${firstName}.${lastName.replaceAll(' ', '')}.${index}@example.test`.toLocaleLowerCase(
            'fr-FR',
          ),
    address: index % 7 === 0 ? null : `${1 + (index % 98)} rue de la République, ${area}`,
    insuranceNumber: `TN-${2020 + (index % 7)}-${pad((index * 37) % 10000, 4)}`,
    source,
    linkage,
    category,
    lastConsultation:
      index % 11 === 0
        ? null
        : `2026-${pad(((index + 5) % 10) + 1, 2)}-${pad(lastDay, 2)}T09:00:00+01:00`,
    nextAppointment: hasNextAppointment
      ? `2026-11-${pad((index % 27) + 1, 2)}T${pad(8 + (index % 9), 2)}:${index % 2 === 0 ? '00' : '30'}:00+01:00`
      : null,
    createdAt: `${2020 + (index % 7)}-${pad(month, 2)}-${pad(day, 2)}T08:00:00+01:00`,
  };
}

function buildDirectory(): readonly DemoPatientRecord[] {
  const records: DemoPatientRecord[] = [...SPECIAL_PATIENTS];
  let index = SPECIAL_PATIENTS.length + 1;

  for (let count = 0; count < 3_119; count += 1) records.push(generatedPatient(index++, 'LINKED'));
  for (let count = 0; count < 4_889; count += 1) records.push(generatedPatient(index++, 'CABINET'));
  for (let count = 0; count < 444; count += 1) records.push(generatedPatient(index++, 'WALK_IN'));

  return records;
}

export const DEMO_PATIENT_DIRECTORY = buildDirectory();

export function findDemoPatient(id: string): DemoPatientRecord | null {
  return DEMO_PATIENT_DIRECTORY.find((patient) => patient.id === id) ?? null;
}

export function demoPatientFullName(patient: DemoPatientRecord): string {
  return `${patient.firstName} ${patient.lastName}`;
}

export function demoPatientAge(patient: DemoPatientRecord): number {
  const [year = 0, month = 1, day = 1] = patient.dateOfBirth.split('-').map(Number);
  const beforeBirthday = month > 10 || (month === 10 && day > 29);
  return 2026 - year - (beforeBirthday ? 1 : 0);
}
