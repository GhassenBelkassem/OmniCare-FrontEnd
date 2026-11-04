import { ClinicalOrderCategory } from '../clinical-order.models';

export type DemoMrsAccessState = 'ACTIVE' | 'NONE' | 'EXPIRED' | 'REVOKED' | 'UNAVAILABLE';
export type DemoSaveState = 'saved' | 'dirty' | 'saving' | 'conflict' | 'error';
export type DemoClinicalField =
  | 'chiefComplaint'
  | 'presentIllness'
  | 'clinicalFindings'
  | 'assessment'
  | 'treatmentPlan'
  | 'notes';

export interface DemoClinicalDraft {
  readonly chiefComplaint: string;
  readonly presentIllness: string;
  readonly clinicalFindings: string;
  readonly assessment: string;
  readonly treatmentPlan: string;
  readonly notes: string;
  readonly medicationDecision: 'MEDICATION_PRESCRIBED' | 'NO_MEDICATION' | null;
  readonly followUp: 'NO_FOLLOW_UP' | 'FOLLOW_UP_IN_PERIOD' | 'FOLLOW_UP_AFTER_RESULTS' | 'FOLLOW_UP_AS_NEEDED';
}

export interface DemoClinicalTemplate {
  readonly id: string;
  readonly label: string;
  readonly icon: string;
  readonly hint: string;
  readonly fields: Partial<Record<DemoClinicalField, string>>;
}

export interface DemoMedication {
  readonly id: string;
  readonly name: string;
  readonly dosage: string;
  readonly duration: string;
}

export interface DemoOrder {
  readonly id: string;
  readonly category: ClinicalOrderCategory;
  readonly label: string;
}

export interface DemoVitalsDraft {
  readonly systolicBP: string;
  readonly diastolicBP: string;
  readonly heartRate: string;
  readonly temperature: string;
  readonly weight: string;
}

export interface DemoArtifactDraft {
  readonly id: string;
  readonly type: 'MEDICAL_CERTIFICATE' | 'SICK_LEAVE_CERTIFICATE';
  readonly label: string;
  readonly status: 'DRAFT';
}

export const DEMO_CONSULTATION_PATIENT = {
  id: 'demo-youssef-mansour',
  name: 'Youssef Mansour',
  initials: 'YM',
  age: 32,
  gender: 'Homme',
  insuranceNumber: 'TN-2024-1188',
  bloodGroup: 'A+',
  appointmentTime: '10:30',
  arrivedAt: '09:55',
  waitMinutes: 14,
  cabinet: 'Cabinet principal',
} as const;

export const DEMO_INITIAL_CLINICAL_DRAFT: DemoClinicalDraft = {
  chiefComplaint: 'Douleur abdominale depuis 2 jours',
  presentIllness: 'Douleur abdominale diffuse depuis 2 jours, aggravée après les repas. Pas de fièvre. Pas de vomissements. Appétit diminué.',
  clinicalFindings: 'Abdomen souple, sensible à la palpation épigastrique, sans défense. Pas de signes de péritonite.',
  assessment: 'Gastrite probable.',
  treatmentPlan: 'IPP 20 mg/j pendant 4 semaines\nMesures hygiéno-diététiques\nContrôle si persistance des symptômes',
  notes: '',
  medicationDecision: 'MEDICATION_PRESCRIBED',
  followUp: 'FOLLOW_UP_AS_NEEDED',
};

export const DEMO_CLINICAL_TEMPLATES: readonly DemoClinicalTemplate[] = [
  {
    id: 'general',
    label: 'Consultation générale',
    icon: 'file-text',
    hint: 'Structure générale sans contenu clinique automatique',
    fields: {},
  },
  {
    id: 'chronic',
    label: 'Suivi chronique',
    icon: 'history',
    hint: 'Ajoute uniquement des invites de suivi',
    fields: { notes: 'Observance :\nTolérance :\nObjectifs convenus : ' },
  },
  {
    id: 'respiratory',
    label: 'Infection respiratoire',
    icon: 'medicine-box',
    hint: 'Trame de recueil, sans diagnostic suggéré',
    fields: { clinicalFindings: 'Température :\nAuscultation :\nSignes de gravité recherchés : ' },
  },
  {
    id: 'urinary',
    label: 'Infection urinaire',
    icon: 'search',
    hint: 'Trame de recueil, sans traitement suggéré',
    fields: { presentIllness: 'Début des symptômes :\nSignes associés :\nFacteurs de risque : ' },
  },
  {
    id: 'abdominal',
    label: 'Douleur abdominale',
    icon: 'unordered-list',
    hint: 'Structure d’examen abdominal',
    fields: { clinicalFindings: 'Inspection :\nPalpation :\nAuscultation :\nSignes associés : ' },
  },
  {
    id: 'blood-pressure',
    label: 'Contrôle tensionnel',
    icon: 'medicine-box',
    hint: 'Trame de suivi des constantes',
    fields: { notes: 'Mesures à domicile :\nObservance :\nTolérance : ' },
  },
  {
    id: 'renewal',
    label: 'Renouvellement',
    icon: 'reload',
    hint: 'Vérifications avant décision médicale',
    fields: { notes: 'Traitement vérifié :\nTolérance :\nDécision médicale : ' },
  },
  {
    id: 'post-op',
    label: 'Suivi post-opératoire',
    icon: 'audit',
    hint: 'Trame d’observation post-opératoire',
    fields: { clinicalFindings: 'Plaie :\nDouleur :\nMobilité :\nSignes d’alerte recherchés : ' },
  },
  {
    id: 'certificate',
    label: 'Certificat médical',
    icon: 'file-text',
    hint: 'Prépare une trame de note, sans générer de document',
    fields: { notes: 'Éléments factuels constatés : ' },
  },
  {
    id: 'sick-leave',
    label: 'Arrêt de travail',
    icon: 'calendar',
    hint: 'Prépare une trame de note, sans générer de document',
    fields: { notes: 'Éléments justifiant la décision médicale : ' },
  },
];

export const DEMO_INITIAL_MEDICATIONS: readonly DemoMedication[] = [
  { id: 'med-paracetamol', name: 'Paracétamol 1 000 mg', dosage: '3×/jour', duration: '5 jours' },
  { id: 'med-omeprazole', name: 'Oméprazole 20 mg', dosage: '1×/jour', duration: '4 semaines' },
];

export const DEMO_INITIAL_VITALS: DemoVitalsDraft = {
  systolicBP: '120',
  diastolicBP: '80',
  heartRate: '72',
  temperature: '36.8',
  weight: '74',
};

export const DEMO_VITALS = [
  { label: 'TA', value: '120 / 80', unit: 'mmHg', icon: 'medicine-box', tone: 'blue' },
  { label: 'FC', value: '72', unit: 'bpm', icon: 'clock-circle', tone: 'green' },
  { label: 'Température', value: '36.8', unit: '°C', icon: 'line-chart', tone: 'blue' },
  { label: 'Poids', value: '74', unit: 'kg', icon: 'medicine-box', tone: 'blue' },
] as const;

export const DEMO_RECENT_CONSULTATIONS = [
  { date: '12/09/2026', label: 'Gastro-entérite', doctor: 'Dr Ben Salah' },
  { date: '18/06/2026', label: 'Contrôle tensionnel', doctor: 'Dr Ben Salah' },
  { date: '03/02/2026', label: 'Infection respiratoire', doctor: 'Dr Ben Salah' },
] as const;

export const DEMO_MRS_COPY: Record<Exclude<DemoMrsAccessState, 'ACTIVE'>, { title: string; description: string }> = {
  NONE: {
    title: 'Dossier médical verrouillé',
    description: 'Aucune autorisation MRS n’est active pour cette consultation.',
  },
  EXPIRED: {
    title: 'Autorisation expirée',
    description: 'L’accès historique a expiré. Aucune donnée médicale n’est affichée.',
  },
  REVOKED: {
    title: 'Autorisation révoquée',
    description: 'Le patient a révoqué l’accès. Les informations protégées restent masquées.',
  },
  UNAVAILABLE: {
    title: 'Service MRS indisponible',
    description: 'Le statut d’autorisation ne peut pas être vérifié dans cette démo hors ligne.',
  },
};
