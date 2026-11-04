import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NzIconModule } from 'ng-zorro-antd/icon';

import { OcButton, OcDialog, OcPopover, OcSheet, OcStatusBadge, OcTab, OcTabs } from '../../../shared/ui';
import {
  DEMO_CLINICAL_TEMPLATES,
  DEMO_CONSULTATION_PATIENT,
  DEMO_MRS_COPY,
  DEMO_RECENT_CONSULTATIONS,
  DemoClinicalField,
  DemoMrsAccessState,
  DemoSaveState,
} from './consultation-demo.fixtures';
import { ConsultationDemoStore } from './consultation-demo.store';

type WorkspaceSection = 'note' | 'vitals' | 'prescription' | 'orders' | 'documents' | 'finalization';

const WORKSPACE_SECTIONS: readonly WorkspaceSection[] = ['note', 'vitals', 'prescription', 'orders', 'documents', 'finalization'];
const MRS_STATES: readonly DemoMrsAccessState[] = ['ACTIVE', 'NONE', 'EXPIRED', 'REVOKED', 'UNAVAILABLE'];

@Component({
  selector: 'oc-consultation-page',
  imports: [NzIconModule, RouterLink, OcButton, OcDialog, OcPopover, OcSheet, OcStatusBadge, OcTabs],
  providers: [ConsultationDemoStore],
  templateUrl: './consultation-page.static-demo.html',
  styleUrls: ['./consultation-page.static-demo.scss', './consultation-page.static-demo.responsive.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown)': 'onDocumentKeydown($event)' },
})
export class ConsultationPage {
  private readonly route = inject(ActivatedRoute);
  readonly store = inject(ConsultationDemoStore);

  private readonly chiefComplaintField = viewChild<ElementRef<HTMLInputElement>>('chiefComplaintField');
  private readonly presentIllnessField = viewChild<ElementRef<HTMLTextAreaElement>>('presentIllnessField');
  private readonly clinicalFindingsField = viewChild<ElementRef<HTMLTextAreaElement>>('clinicalFindingsField');
  private readonly assessmentField = viewChild<ElementRef<HTMLTextAreaElement>>('assessmentField');
  private readonly treatmentPlanField = viewChild<ElementRef<HTMLTextAreaElement>>('treatmentPlanField');
  private readonly notesField = viewChild<ElementRef<HTMLTextAreaElement>>('notesField');

  readonly patient = DEMO_CONSULTATION_PATIENT;
  readonly templates = DEMO_CLINICAL_TEMPLATES;
  readonly recentConsultations = DEMO_RECENT_CONSULTATIONS;
  readonly mrsState = signal<DemoMrsAccessState>(this.readMrsState());
  readonly activeSection = signal<WorkspaceSection>(this.readSection());
  readonly templateSearch = signal('');
  readonly selectedTemplateId = signal('general');
  readonly templatePopoverOpen = signal(false);
  readonly mrsDrawerOpen = signal(false);
  readonly finishDialogOpen = signal(false);
  readonly feedback = signal<string | null>(null);
  readonly newOrderCategory = signal<'LAB' | 'IMAGING' | 'REFERRAL'>('LAB');
  readonly newOrderLabel = signal('');

  readonly filteredTemplates = computed(() => {
    const query = this.templateSearch().trim().toLocaleLowerCase('fr-FR');
    return query ? this.templates.filter((template) => template.label.toLocaleLowerCase('fr-FR').includes(query)) : this.templates;
  });
  readonly selectedTemplate = computed(() => this.templates.find(({ id }) => id === this.selectedTemplateId()));
  readonly mrsLockedCopy = computed(() => this.mrsState() === 'ACTIVE' ? null : DEMO_MRS_COPY[this.mrsState() as Exclude<DemoMrsAccessState, 'ACTIVE'>]);
  readonly workspaceTabs = computed<readonly OcTab[]>(() => [
    { id: 'note', label: 'Note clinique', icon: 'file-text', badge: this.stateBadge(this.store.clinicalSaveState()) },
    { id: 'vitals', label: 'Constantes', icon: 'medicine-box', badge: this.stateBadge(this.store.vitalsSaveState()) },
    { id: 'prescription', label: 'Prescription', icon: 'medicine-box', badge: this.stateBadge(this.store.prescriptionSaveState()) },
    { id: 'orders', label: 'Ordres cliniques', icon: 'solution', badge: this.stateBadge(this.store.ordersSaveState()) },
    { id: 'documents', label: 'Documents', icon: 'file-text', badge: this.stateBadge(this.store.documentsSaveState()) },
    { id: 'finalization', label: 'Finalisation', icon: 'check-circle' },
  ]);
  readonly activeSaveState = computed(() => this.saveStateFor(this.activeSection()));
  readonly activeSaveLabel = computed(() => this.saveLabel(this.activeSaveState()));
  readonly activeSaveTone = computed(() => this.saveTone(this.activeSaveState()));
  readonly activeSectionLabel = computed(() =>
    this.workspaceTabs().find(({ id }) => id === this.activeSection())?.label ?? 'Consultation',
  );
  readonly completionItems = computed(() => [
    { label: 'Note clinique', state: this.store.clinicalSaveState() },
    { label: 'Constantes', state: this.store.vitalsSaveState() },
    { label: 'Prescription', state: this.store.prescriptionSaveState() },
    { label: 'Ordres cliniques', state: this.store.ordersSaveState() },
    { label: 'Documents', state: this.store.documentsSaveState() },
  ] as const);

  constructor() {
    const scenario = this.route.snapshot.queryParamMap.get('saveState');
    if (scenario === 'conflict' || scenario === 'error') this.store.setClinicalScenario(scenario);
  }

  canDeactivate(): boolean {
    return !this.store.hasUnsavedChanges() || window.confirm('Des modifications locales ne sont pas enregistrées. Quitter cette consultation ?');
  }

  setActiveSection(id: string): void {
    if (WORKSPACE_SECTIONS.includes(id as WorkspaceSection)) {
      this.activeSection.set(id as WorkspaceSection);
      this.feedback.set(null);
    }
  }

  onDocumentKeydown(event: KeyboardEvent): void {
    const modifier = event.metaKey || event.ctrlKey;
    if (!modifier || event.altKey) return;
    if (event.key.toLocaleLowerCase() === 's') {
      event.preventDefault();
      this.saveActiveDomain();
      return;
    }
    if (!event.shiftKey && /^[1-6]$/.test(event.key)) {
      event.preventDefault();
      this.activeSection.set('note');
      queueMicrotask(() => this.focusClinicalField(Number(event.key)));
    }
  }

  updateClinical(field: DemoClinicalField, event: Event): void {
    this.store.updateClinical(field, (event.target as HTMLInputElement | HTMLTextAreaElement).value);
  }

  updateMedicationDecision(event: Event): void {
    this.store.updateMedicationDecision((event.target as HTMLSelectElement).value as 'MEDICATION_PRESCRIBED' | 'NO_MEDICATION');
  }

  updateFollowUp(event: Event): void {
    this.store.updateFollowUp((event.target as HTMLSelectElement).value as 'NO_FOLLOW_UP' | 'FOLLOW_UP_IN_PERIOD' | 'FOLLOW_UP_AFTER_RESULTS' | 'FOLLOW_UP_AS_NEEDED');
  }

  updateVital(field: 'systolicBP' | 'diastolicBP' | 'heartRate' | 'temperature' | 'weight', event: Event): void {
    this.store.updateVital(field, (event.target as HTMLInputElement).value);
  }

  selectTemplate(templateId: string): void {
    this.selectedTemplateId.set(templateId);
  }

  applySelectedTemplate(): void {
    const template = this.selectedTemplate();
    if (!template) return;
    this.store.applyTemplate(template.fields);
    this.templatePopoverOpen.set(false);
    this.feedback.set(Object.keys(template.fields).length === 0
      ? 'Cette trame générale ne modifie pas la note actuelle.'
      : 'La trame a complété uniquement les champs vides. Vérifiez tout contenu clinique.');
  }

  addOrder(): void {
    const label = this.newOrderLabel().trim();
    if (!label) {
      this.feedback.set('Précisez la demande avant de l’ajouter au brouillon local.');
      return;
    }
    this.store.addOrder(this.newOrderCategory(), label);
    this.newOrderLabel.set('');
  }

  saveActiveDomain(): void {
    switch (this.activeSection()) {
      case 'note':
        if (['conflict', 'error'].includes(this.store.clinicalSaveState())) {
          this.feedback.set('Résolvez l’état simulé avant un nouvel enregistrement local.');
          return;
        }
        this.store.saveClinical(this.currentTime());
        break;
      case 'vitals': this.store.saveVitals(); break;
      case 'prescription': this.store.savePrescription(); break;
      case 'orders': this.store.saveOrders(); break;
      case 'documents': this.store.saveDocuments(); break;
      case 'finalization': return;
    }
    this.feedback.set('Brouillon enregistré localement pour cet onglet. Aucun envoi réseau.');
  }

  resolveSaveState(): void {
    this.store.resolveClinicalScenario();
    this.feedback.set('État simulé résolu. Enregistrez explicitement le brouillon.');
  }

  requestFinish(): void {
    this.finishDialogOpen.set(true);
  }

  confirmFinish(): void {
    if (!this.store.canFinish()) return;
    this.store.finishLocally();
    this.finishDialogOpen.set(false);
    this.feedback.set('Consultation terminée dans la simulation locale uniquement. Aucune donnée clinique n’a été envoyée.');
  }

  statusLabel(state: DemoSaveState): string {
    if (state === 'saved') return 'Enregistré';
    if (state === 'dirty') return 'Non enregistré';
    if (state === 'saving') return 'Enregistrement…';
    if (state === 'conflict') return 'Conflit';
    return 'Erreur';
  }

  private readMrsState(): DemoMrsAccessState {
    const value = this.route.snapshot.queryParamMap.get('mrs') as DemoMrsAccessState | null;
    return value && MRS_STATES.includes(value) ? value : 'ACTIVE';
  }

  private readSection(): WorkspaceSection {
    const value = this.route.snapshot.queryParamMap.get('tab') as WorkspaceSection | null;
    return value && WORKSPACE_SECTIONS.includes(value) ? value : 'note';
  }

  private stateBadge(state: DemoSaveState): string | undefined {
    if (state === 'dirty') return 'Modifié';
    if (state === 'conflict') return 'Conflit';
    if (state === 'error') return 'Erreur';
    return undefined;
  }

  private saveStateFor(section: WorkspaceSection): DemoSaveState {
    switch (section) {
      case 'note': return this.store.clinicalSaveState();
      case 'vitals': return this.store.vitalsSaveState();
      case 'prescription': return this.store.prescriptionSaveState();
      case 'orders': return this.store.ordersSaveState();
      case 'documents': return this.store.documentsSaveState();
      case 'finalization': return this.store.hasUnsavedChanges() ? 'dirty' : 'saved';
    }
  }

  private saveLabel(state: DemoSaveState): string {
    if (state === 'saved') return `Enregistré localement · ${this.store.lastSavedAt()}`;
    return this.statusLabel(state);
  }

  private saveTone(state: DemoSaveState): 'completed' | 'pending' | 'in-progress' | 'requires-attention' {
    if (state === 'saved') return 'completed';
    if (state === 'saving') return 'in-progress';
    if (state === 'dirty') return 'pending';
    return 'requires-attention';
  }

  private focusClinicalField(index: number): void {
    const fields = [this.chiefComplaintField(), this.presentIllnessField(), this.clinicalFindingsField(), this.assessmentField(), this.treatmentPlanField(), this.notesField()];
    fields[index - 1]?.nativeElement.focus();
  }

  private currentTime(): string {
    return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date());
  }
}
