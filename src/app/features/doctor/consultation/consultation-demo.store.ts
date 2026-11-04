import { computed, Injectable, signal } from '@angular/core';

import {
  DEMO_INITIAL_CLINICAL_DRAFT,
  DEMO_INITIAL_MEDICATIONS,
  DEMO_INITIAL_VITALS,
  DemoArtifactDraft,
  DemoClinicalDraft,
  DemoClinicalField,
  DemoMedication,
  DemoOrder,
  DemoSaveState,
  DemoVitalsDraft,
} from './consultation-demo.fixtures';

@Injectable()
export class ConsultationDemoStore {
  readonly clinicalDraft = signal<DemoClinicalDraft>({ ...DEMO_INITIAL_CLINICAL_DRAFT });
  readonly clinicalSaveState = signal<DemoSaveState>('saved');
  readonly prescriptionSaveState = signal<DemoSaveState>('saved');
  readonly ordersSaveState = signal<DemoSaveState>('saved');
  readonly vitalsSaveState = signal<DemoSaveState>('saved');
  readonly documentsSaveState = signal<DemoSaveState>('saved');
  readonly medications = signal<readonly DemoMedication[]>([...DEMO_INITIAL_MEDICATIONS]);
  readonly orders = signal<readonly DemoOrder[]>([]);
  readonly vitals = signal<DemoVitalsDraft>({ ...DEMO_INITIAL_VITALS });
  readonly artifacts = signal<readonly DemoArtifactDraft[]>([]);
  readonly lastSavedAt = signal('10:12:34');
  readonly finished = signal(false);

  readonly hasUnsavedChanges = computed(() =>
    [this.clinicalSaveState(), this.prescriptionSaveState(), this.ordersSaveState(), this.vitalsSaveState(), this.documentsSaveState()].some(
      (state) => state !== 'saved',
    ),
  );
  readonly canFinish = computed(() =>
    !this.finished() &&
    this.clinicalSaveState() === 'saved' &&
    this.prescriptionSaveState() === 'saved' &&
    this.ordersSaveState() === 'saved' &&
    this.vitalsSaveState() === 'saved' &&
    this.documentsSaveState() === 'saved',
  );

  updateClinical(field: DemoClinicalField, value: string): void {
    this.clinicalDraft.update((draft) => ({ ...draft, [field]: value }));
    this.clinicalSaveState.set('dirty');
  }

  updateMedicationDecision(value: DemoClinicalDraft['medicationDecision']): void {
    this.clinicalDraft.update((draft) => ({ ...draft, medicationDecision: value }));
    this.clinicalSaveState.set('dirty');
  }

  updateFollowUp(value: DemoClinicalDraft['followUp']): void {
    this.clinicalDraft.update((draft) => ({ ...draft, followUp: value }));
    this.clinicalSaveState.set('dirty');
  }

  applyTemplate(fields: Partial<Record<DemoClinicalField, string>>): void {
    if (Object.keys(fields).length === 0) return;
    this.clinicalDraft.update((draft) => {
      const next = { ...draft };
      for (const [field, value] of Object.entries(fields) as [DemoClinicalField, string][]) {
        if (!next[field].trim()) next[field] = value;
      }
      return next;
    });
    this.clinicalSaveState.set('dirty');
  }

  saveClinical(now = '10:12:34'): void {
    if (this.clinicalSaveState() === 'saving') return;
    if (['conflict', 'error'].includes(this.clinicalSaveState())) return;
    this.clinicalSaveState.set('saving');
    queueMicrotask(() => {
      this.lastSavedAt.set(now);
      this.clinicalSaveState.set('saved');
    });
  }

  setClinicalScenario(state: Extract<DemoSaveState, 'conflict' | 'error'>): void {
    this.clinicalSaveState.set(state);
  }

  resolveClinicalScenario(): void {
    this.clinicalSaveState.set('dirty');
  }

  addMedication(): void {
    const number = this.medications().length + 1;
    this.medications.update((items) => [
      ...items,
      { id: `local-med-${number}`, name: 'Médicament à préciser', dosage: 'Posologie à préciser', duration: 'Durée à préciser' },
    ]);
    this.prescriptionSaveState.set('dirty');
  }

  removeMedication(id: string): void {
    this.medications.update((items) => items.filter((item) => item.id !== id));
    this.prescriptionSaveState.set('dirty');
  }

  updateMedication(id: string, field: keyof Pick<DemoMedication, 'name' | 'dosage' | 'duration'>, value: string): void {
    this.medications.update((items) => items.map((item) => item.id === id ? { ...item, [field]: value } : item));
    this.prescriptionSaveState.set('dirty');
  }

  savePrescription(): void {
    this.prescriptionSaveState.set('saved');
  }

  addOrder(category: DemoOrder['category'], label: string): void {
    const id = `local-order-${this.orders().length + 1}`;
    this.orders.update((orders) => [...orders, { id, category, label }]);
    this.ordersSaveState.set('dirty');
  }

  removeOrder(id: string): void {
    this.orders.update((orders) => orders.filter((order) => order.id !== id));
    this.ordersSaveState.set('dirty');
  }

  saveOrders(): void {
    this.ordersSaveState.set('saved');
  }

  updateVital(field: keyof DemoVitalsDraft, value: string): void {
    this.vitals.update((vitals) => ({ ...vitals, [field]: value }));
    this.vitalsSaveState.set('dirty');
  }

  saveVitals(): void {
    this.vitalsSaveState.set('saved');
  }

  addArtifact(type: DemoArtifactDraft['type']): void {
    const label = type === 'MEDICAL_CERTIFICATE' ? 'Certificat médical' : 'Arrêt de travail';
    const id = `local-artifact-${this.artifacts().length + 1}`;
    this.artifacts.update((artifacts) => [...artifacts, { id, type, label, status: 'DRAFT' }]);
    this.documentsSaveState.set('dirty');
  }

  removeArtifact(id: string): void {
    this.artifacts.update((artifacts) => artifacts.filter((artifact) => artifact.id !== id));
    this.documentsSaveState.set('dirty');
  }

  saveDocuments(): void {
    this.documentsSaveState.set('saved');
  }

  finishLocally(): void {
    if (this.canFinish()) this.finished.set(true);
  }
}
