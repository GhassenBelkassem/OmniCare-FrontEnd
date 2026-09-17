import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  OcPageHeader,
  OcCard,
  OcAvatar,
  OcStatusBadge,
  OcButton,
  OcEmptyState,
  OcTabs,
  OcTimelineItem,
} from '../../../shared/ui';

interface PatientDemographics {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  age: number;
  gender: string;
  phone: string;
  email: string;
  address: string;
  bloodType: string;
  insuranceNumber: string;
  source: 'omnicare' | 'external';
}

interface Condition {
  name: string;
  diagnosedDate: string;
  status: 'active' | 'resolved' | 'chronic';
}

interface Allergy {
  name: string;
  severity: 'mild' | 'moderate' | 'severe';
  reaction: string;
}

interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  startDate: string;
  prescribedBy: string;
}

interface VitalsRecord {
  date: string;
  bloodPressure: string;
  heartRate: number;
  temperature: number;
  weight: number;
  height: number;
  bmi: number;
}

interface Consultation {
  id: string;
  date: string;
  reason: string;
  diagnosis: string;
  notes: string;
  prescriptions: string[];
}

interface TimelineEvent {
  id: string;
  date: string;
  type: 'consultation' | 'prescription' | 'lab' | 'hospitalization' | 'note';
  title: string;
  description: string;
}

interface Document {
  id: string;
  name: string;
  type: string;
  date: string;
  size: string;
}

@Component({
  selector: 'app-patient-chart-page',
  templateUrl: './patient-chart-page.html',
  styleUrls: ['./patient-chart-page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    OcPageHeader,
    OcCard,
    OcAvatar,
    OcStatusBadge,
    OcButton,
    OcEmptyState,
    OcTabs,
    OcTimelineItem,
  ],
})
export class PatientChartPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly activeTab = signal('dossier');
  readonly isLoading = signal(true);

  readonly patientId = computed(() => this.route.snapshot.paramMap.get('id') ?? '');

  readonly demographics = signal<PatientDemographics>({
    id: '1',
    firstName: 'Ahmed',
    lastName: 'Ben Salah',
    dateOfBirth: '1985-03-12',
    age: 41,
    gender: 'Homme',
    phone: '+216 71 234 567',
    email: 'ahmed.bensalah@email.tn',
    address: '42 Rue Habib Bourguiba, Tunis 1000',
    bloodType: 'A+',
    insuranceNumber: 'TN-2024-8834',
    source: 'omnicare',
  });

  readonly conditions = signal<Condition[]>([
    { name: 'Hypertension artérielle', diagnosedDate: '2022-06-15', status: 'chronic' },
    { name: 'Diabète type 2', diagnosedDate: '2023-01-20', status: 'chronic' },
    { name: 'Gastro-œsophagite', diagnosedDate: '2025-11-10', status: 'active' },
  ]);

  readonly allergies = signal<Allergy[]>([
    { name: 'Pénicilline', severity: 'severe', reaction: 'Choc anaphylactique' },
    { name: 'Aspirine', severity: 'moderate', reaction: 'Éruption cutanée' },
    { name: 'Pollens', severity: 'mild', reaction: 'Rhinite allergique' },
  ]);

  readonly medications = signal<Medication[]>([
    { name: 'Amlodipine', dosage: '5mg', frequency: '1 fois/jour', startDate: '2022-06-15', prescribedBy: 'Dr. Cherif' },
    { name: 'Metformine', dosage: '850mg', frequency: '2 fois/jour', startDate: '2023-01-20', prescribedBy: 'Dr. Cherif' },
    { name: 'Oméprazole', dosage: '20mg', frequency: '1 fois/jour', startDate: '2025-11-10', prescribedBy: 'Dr. Cherif' },
    { name: 'Paracétamol', dosage: '1000mg', frequency: 'Si besoin', startDate: '2026-01-05', prescribedBy: 'Dr. Cherif' },
  ]);

  readonly vitalsHistory = signal<VitalsRecord[]>([
    { date: '2026-08-10', bloodPressure: '132/85', heartRate: 78, temperature: 36.8, weight: 82, height: 175, bmi: 26.8 },
    { date: '2026-06-15', bloodPressure: '138/88', heartRate: 82, temperature: 36.6, weight: 84, height: 175, bmi: 27.4 },
    { date: '2026-03-20', bloodPressure: '140/90', heartRate: 80, temperature: 36.7, weight: 85, height: 175, bmi: 27.8 },
    { date: '2025-12-10', bloodPressure: '135/87', heartRate: 76, temperature: 36.5, weight: 83, height: 175, bmi: 27.1 },
    { date: '2025-09-05', bloodPressure: '142/92', heartRate: 84, temperature: 36.9, weight: 86, height: 175, bmi: 28.1 },
  ]);

  readonly consultations = signal<Consultation[]>([
    {
      id: 'c1',
      date: '2026-08-10',
      reason: 'Contrôle tension et glycémie',
      diagnosis: 'Hypertension stabilisée, glycémie sous contrôle',
      notes: 'Patient stable. Continuer le traitement actuel. Contrôle dans 3 mois.',
      prescriptions: ['Amlodipine 5mg', 'Metformine 850mg'],
    },
    {
      id: 'c2',
      date: '2026-06-15',
      reason: 'Douleurs gastriques',
      diagnosis: 'Gastro-œsophagite',
      notes: 'Prescrire oméprazole 20mg. Régime alimentaire adapté.',
      prescriptions: ['Oméprazole 20mg', 'Régime gastro-protecteur'],
    },
    {
      id: 'c3',
      date: '2026-03-20',
      reason: 'Bilan de routine',
      diagnosis: 'Hypertension légèrement élevée',
      notes: 'Augmenter dose si pas d\'amélioration. Analyses sanguines demandées.',
      prescriptions: ['Amlodipine 5mg (maintien)'],
    },
    {
      id: 'c4',
      date: '2025-12-10',
      reason: 'Suivi diabète',
      diagnosis: 'Diabète type 2 - HbA1c: 7.2%',
      notes: 'Glycémie correcte mais peut être améliorée. Marche 30min/jour recommandée.',
      prescriptions: ['Metformine 850mg'],
    },
  ]);

  readonly timelineEvents = signal<TimelineEvent[]>([
    { id: 't1', date: '2026-08-10', type: 'consultation', title: 'Consultation de suivi', description: 'Contrôle tension et glycémie. Patient stable.' },
    { id: 't2', date: '2026-08-05', type: 'lab', title: 'Résultats analyses', description: 'HbA1c: 7.0%, Créatinine: 0.9, Cholestérol: 2.1' },
    { id: 't3', date: '2026-06-15', type: 'consultation', title: 'Consultation gastro', description: 'Diagnostic gastro-œsophagite. Prescrit oméprazole.' },
    { id: 't4', date: '2026-06-10', type: 'prescription', title: 'Ordonnance', description: 'Oméprazole 20mg pendant 8 semaines.' },
    { id: 't5', date: '2026-03-20', type: 'consultation', title: 'Bilan annuel', description: 'Bilan de routine. Hypertension légèrement élevée.' },
    { id: 't6', date: '2026-03-18', type: 'lab', title: 'Analyses sanguines', description: 'Bilan lipidique, glycémie, fonction rénale.' },
    { id: 't7', date: '2025-12-10', type: 'consultation', title: 'Suivi diabète', description: 'HbA1c: 7.2%. Maintien metformine.' },
    { id: 't8', date: '2025-09-05', type: 'note', title: 'Note interne', description: 'Patient demande reports pour mutuelle.' },
  ]);

  readonly documents = signal<Document[]>([
    { id: 'd1', name: 'Compte rendu consultation 10/08/2026', type: 'pdf', date: '2026-08-10', size: '245 Ko' },
    { id: 'd2', name: 'Résultats analyses 05/08/2026', type: 'pdf', date: '2026-08-05', size: '1.2 Mo' },
    { id: 'd3', name: 'Ordonnance Oméprazole', type: 'pdf', date: '2026-06-10', size: '128 Ko' },
    { id: 'd4', name: 'ECG 20/03/2026', type: 'image', date: '2026-03-20', size: '3.4 Mo' },
    { id: 'd5', name: 'Bilan lipidique 18/03/2026', type: 'pdf', date: '2026-03-18', size: '567 Ko' },
  ]);

  readonly latestVitals = computed(() => {
    const vitals = this.vitalsHistory();
    return vitals.length > 0 ? vitals[0] : null;
  });

  readonly activeConditionsCount = computed(() =>
    this.conditions().filter((c) => c.status === 'active' || c.status === 'chronic').length
  );

  readonly statusOcValue = computed(() => {
    const count = this.activeConditionsCount();
    if (count >= 2) return 'critical' as const;
    if (count === 1) return 'requires-attention' as const;
    return 'completed' as const;
  });

  conditionOcStatus(status: 'active' | 'resolved' | 'chronic'): 'in-progress' | 'completed' | 'pending' {
    switch (status) {
      case 'active': return 'in-progress';
      case 'chronic': return 'pending';
      case 'resolved': return 'completed';
    }
  }

  timelineOcTone(type: string): 'default' | 'success' | 'warning' | 'critical' | 'information' {
    switch (type) {
      case 'consultation': return 'information';
      case 'prescription': return 'success';
      case 'lab': return 'warning';
      case 'hospitalization': return 'critical';
      default: return 'default';
    }
  }

  ngOnInit(): void {
    setTimeout(() => this.isLoading.set(false), 300);
  }

  onTabChange(tab: string): void {
    this.activeTab.set(tab);
  }

  onBack(): void {
    this.router.navigate(['/doctor/patients']);
  }

  onEditPatient(): void {
    this.router.navigate(['/doctor/patient', this.patientId(), 'edit']);
  }

  onPrintChart(): void {
    window.print();
  }

  onDownloadDocument(doc: Document): void {
    console.log('Downloading document:', doc.name);
  }

  trackByEventId(_index: number, event: TimelineEvent): string {
    return event.id;
  }

  trackByConsultationId(_index: number, consultation: Consultation): string {
    return consultation.id;
  }

  trackByDocumentId(_index: number, document: Document): string {
    return document.id;
  }
}
