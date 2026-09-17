import { Component, ChangeDetectionStrategy, signal, computed } from '@angular/core';
import {
  OcPageHeader,
  OcTabs,
  OcDataTableShell,
  OcButton,
  OcStatusBadge,
  OcEmptyState,
  OcCard,
  OcFilterToolbar,
} from '../../../shared/ui';

interface Prescription {
  id: string;
  patientName: string;
  date: string;
  drug: string;
  status: 'active' | 'completed' | 'cancelled' | 'pending';
}

interface Demande {
  id: string;
  type: 'lab' | 'imaging' | 'referral' | 'certificate';
  patientName: string;
  date: string;
  description: string;
  status: 'pending' | 'sent' | 'completed';
}

interface Modele {
  id: string;
  name: string;
  category: string;
  lastUsed: string;
  content: string;
}

@Component({
  selector: 'app-prescriptions-page',
  imports: [
    OcPageHeader,
    OcTabs,
    OcDataTableShell,
    OcButton,
    OcStatusBadge,
    OcEmptyState,
    OcCard,
    OcFilterToolbar,
  ],
  templateUrl: './prescriptions-page.html',
  styleUrl: './prescriptions-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrescriptionsPage {
  readonly tabs = signal([
    { id: 'prescriptions', label: 'Prescriptions' },
    { id: 'demandes', label: 'Demandes' },
    { id: 'modeles', label: 'Modeles' },
  ]);

  readonly activeTab = signal<string>('prescriptions');

  readonly prescriptions = signal<Prescription[]>([
    { id: '1', patientName: 'Ahmed Ben Ali', date: '2026-08-15', drug: 'Amoxicilline 500mg', status: 'active' },
    { id: '2', patientName: 'Fatma Trabelsi', date: '2026-08-14', drug: 'Metformine 850mg', status: 'pending' },
    { id: '3', patientName: 'Mohamed Sahli', date: '2026-08-13', drug: 'Atorvastatine 20mg', status: 'completed' },
    { id: '4', patientName: 'Leila Karray', date: '2026-08-12', drug: 'Omeprazole 20mg', status: 'active' },
    { id: '5', patientName: 'Ali Mezghani', date: '2026-08-11', drug: 'Amlodipine 5mg', status: 'cancelled' },
    { id: '6', patientName: 'Nadia Bouazizi', date: '2026-08-10', drug: 'Levothyrox 75mcg', status: 'active' },
    { id: '7', patientName: 'Youssef Gharbi', date: '2026-08-09', drug: 'Ibuprofene 400mg', status: 'completed' },
  ]);

  readonly demandes = signal<Demande[]>([
    { id: '1', type: 'lab', patientName: 'Ahmed Ben Ali', date: '2026-08-15', description: 'Bilan sanguin complet', status: 'pending' },
    { id: '2', type: 'imaging', patientName: 'Fatma Trabelsi', date: '2026-08-14', description: 'Radiographie thoracique', status: 'sent' },
    { id: '3', type: 'referral', patientName: 'Mohamed Sahli', date: '2026-08-13', description: 'Cardiologue - Dr. Mansour', status: 'completed' },
    { id: '4', type: 'certificate', patientName: 'Leila Karray', date: '2026-08-12', description: 'Certificat medical - arret 3 jours', status: 'pending' },
    { id: '5', type: 'lab', patientName: 'Ali Mezghani', date: '2026-08-11', description: 'Glycemie a jeun + HbA1c', status: 'sent' },
    { id: '6', type: 'imaging', patientName: 'Nadia Bouazizi', date: '2026-08-10', description: 'Echographie abdominale', status: 'pending' },
    { id: '7', type: 'referral', patientName: 'Youssef Gharbi', date: '2026-08-09', description: 'Orthopediste - Dr. Cherif', status: 'pending' },
    { id: '8', type: 'certificate', patientName: 'Ahmed Ben Ali', date: '2026-08-08', description: 'Certificat de sport', status: 'completed' },
  ]);

  readonly modeles = signal<Modele[]>([
    { id: '1', name: 'Antibiotherapie standard', category: 'Infectiologie', lastUsed: '2026-08-15', content: 'Amoxicilline 500mg x3/j 7 jours' },
    { id: '2', name: 'Traitement hypertrophie benigne', category: 'Urologie', lastUsed: '2026-08-10', content: 'Tamsulosine 0.4mg 1/j' },
    { id: '3', name: 'Bilan diabetique initial', category: 'Diabetologie', lastUsed: '2026-08-08', content: 'Glycemie + HbA1c + Creatinine + NIA' },
    { id: '4', name: 'Arret de travail standard', category: 'Administratif', lastUsed: '2026-08-05', content: 'Arret de travail pour reason pendant duration jours' },
    { id: '5', name: 'Traitement HTA', category: 'Cardiologie', lastUsed: '2026-08-01', content: 'Amlodipine 5mg 1/j + Perindopril 5mg 1/j' },
    { id: '6', name: 'Echographie prescrite', category: 'Imagerie', lastUsed: '2026-07-28', content: 'Echographie indication a preciser' },
  ]);

  readonly filteredPrescriptions = computed(() => this.prescriptions());
  readonly filteredDemandes = computed(() => this.demandes());
  readonly filteredModeles = computed(() => this.modeles());

  readonly prescriptionsCount = computed(() => this.prescriptions().length);
  readonly demandesCount = computed(() => this.demandes().length);
  readonly modelesCount = computed(() => this.modeles().length);

  readonly prescriptionsStatusColor = computed(() => {
    const map: Record<string, string> = {
      active: 'var(--oc-color-success)',
      completed: 'var(--oc-color-info)',
      cancelled: 'var(--oc-color-error)',
      pending: 'var(--oc-color-warning)',
    };
    return map;
  });

  readonly demandeTypeLabel = computed(() => {
    const map: Record<string, string> = {
      lab: 'Analyse',
      imaging: 'Imagerie',
      referral: 'Orientation',
      certificate: 'Certificat',
    };
    return map;
  });

  readonly demandeTypeColor = computed(() => {
    const map: Record<string, string> = {
      lab: 'var(--oc-color-primary)',
      imaging: 'var(--oc-color-accent)',
      referral: 'var(--oc-color-warning)',
      certificate: 'var(--oc-color-info)',
    };
    return map;
  });

  readonly demandeStatusLabel = computed(() => {
    const map: Record<string, string> = {
      pending: 'En attente',
      sent: 'Envoye',
      completed: 'Termine',
    };
    return map;
  });

  readonly demandeStatusColor = computed(() => {
    const map: Record<string, string> = {
      pending: 'var(--oc-color-warning)',
      sent: 'var(--oc-color-info)',
      completed: 'var(--oc-color-success)',
    };
    return map;
  });

  readonly prescriptionStatusLabel = computed(() => {
    const map: Record<string, string> = {
      active: 'Active',
      completed: 'Terminee',
      cancelled: 'Annulee',
      pending: 'En attente',
    };
    return map;
  });

  readonly prescriptionStatusColor = computed(() => {
    const map: Record<string, string> = {
      active: 'var(--oc-color-success)',
      completed: 'var(--oc-color-info)',
      cancelled: 'var(--oc-color-error)',
      pending: 'var(--oc-color-warning)',
    };
    return map;
  });

  readonly prescriptionOcStatus = computed(() => {
    const map: Record<string, 'confirmed' | 'completed' | 'cancelled' | 'pending'> = {
      active: 'confirmed',
      completed: 'completed',
      cancelled: 'cancelled',
      pending: 'pending',
    };
    return map;
  });

  readonly demandeTypeOcStatus = computed(() => {
    const map: Record<string, 'pending' | 'in-progress' | 'confirmed' | 'completed'> = {
      lab: 'pending',
      imaging: 'in-progress',
      referral: 'confirmed',
      certificate: 'completed',
    };
    return map;
  });

  readonly demandeOcStatus = computed(() => {
    const map: Record<string, 'pending' | 'in-progress' | 'completed'> = {
      pending: 'pending',
      sent: 'in-progress',
      completed: 'completed',
    };
    return map;
  });

  onTabChange(key: string): void {
    this.activeTab.set(key);
  }

  onNewPrescription(): void {
    console.log('New prescription');
  }

  onNewLabRequest(): void {
    console.log('New lab request');
  }

  onNewImagingRequest(): void {
    console.log('New imaging request');
  }

  onNewReferral(): void {
    console.log('New referral');
  }

  onNewCertificate(): void {
    console.log('New certificate');
  }

  onEditModele(modele: Modele): void {
    console.log('Edit modele', modele);
  }

  onUseModele(modele: Modele): void {
    console.log('Use modele', modele);
  }

  onDeleteModele(modele: Modele): void {
    console.log('Delete modele', modele);
  }

  onViewPrescription(prescription: Prescription): void {
    console.log('View prescription', prescription);
  }

  onDeleteDemande(demande: Demande): void {
    console.log('Delete demande', demande);
  }
}
