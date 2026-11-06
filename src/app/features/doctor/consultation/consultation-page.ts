import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { OcButton, OcSheet, type OcStatus, type OcTab } from '../../../shared/ui';
import { ActiveConsultationStore } from '../active-consultation.store';
import type { ActiveConsultation, ConsultationStatus } from '../active-consultation.models';
import { ArtifactStore } from '../artifact.store';
import { ClinicalOrderStore } from '../clinical-order.store';
import { ClinicalRecordStore } from '../clinical-record.store';
import { ConsultationFinishStore } from '../consultation-finish.store';
import { PrescriptionStore } from '../prescription.store';
import { UrgentCabinetClinicalStore } from '../urgent-cabinet-clinical.store';
import { UnsavedChangesAware } from '../unsaved-changes.guard';
import { ClinicalAuthoring } from './clinical-authoring';
import { ClinicalOrders } from './clinical-orders';
import { ConsultationWorkspaceView } from './consultation-workspace-view';
import type {
  ConsultationWorkspaceAction,
  ConsultationWorkspaceSection,
  ConsultationWorkspaceViewModel,
} from './consultation-workspace-view.models';
import { DoctorMedicalWorkspace } from './doctor-medical-workspace';
import { OfficialArtifacts } from './official-artifacts';
import { PrescriptionAuthoring } from './prescription-authoring';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Component({
  selector: 'app-consultation-page',
  imports: [
    OcButton,
    OcSheet,
    ConsultationWorkspaceView,
    ClinicalAuthoring,
    ClinicalOrders,
    DoctorMedicalWorkspace,
    OfficialArtifacts,
    PrescriptionAuthoring,
  ],
  templateUrl: './consultation-page.html',
  styleUrl: './consultation-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ConsultationFinishStore],
  host: { '(document:keydown)': 'onDocumentKeydown($event)' },
})
export class ConsultationPage implements UnsavedChangesAware {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly activeConsultation = inject(ActiveConsultationStore);
  readonly clinical = inject(ClinicalRecordStore);
  readonly prescription = inject(PrescriptionStore);
  readonly orders = inject(ClinicalOrderStore);
  readonly artifacts = inject(ArtifactStore);
  readonly finish = inject(ConsultationFinishStore);
  readonly urgentCabinet = inject(UrgentCabinetClinicalStore);

  readonly consultationId = this.route.snapshot.paramMap.get('id') ?? '';
  readonly canonicalRoute = UUID_PATTERN.test(this.consultationId);
  readonly activeSection = signal<ConsultationWorkspaceSection>('note');
  readonly mrsDrawerOpen = signal(false);
  readonly feedback = signal<string | null>(null);

  readonly urgentIntake = computed(() => {
    const active = this.activeConsultation.active();
    const context = this.urgentCabinet.protectedIntake();
    return active?.consultationId === this.consultationId &&
      active.sourceType === 'URGENT_CABINET' &&
      context?.commitmentId === active.sourceId
      ? context
      : null;
  });

  readonly workspaceTabs = computed<readonly OcTab[]>(() => [
    { id: 'note', label: 'Note clinique', icon: 'file-text', badge: this.domainBadge('note') },
    { id: 'vitals', label: 'Constantes', icon: 'medicine-box' },
    {
      id: 'prescription',
      label: 'Prescription',
      icon: 'medicine-box',
      badge: this.domainBadge('prescription'),
    },
    {
      id: 'orders',
      label: 'Ordres cliniques',
      icon: 'solution',
      badge: this.domainBadge('orders'),
    },
    {
      id: 'documents',
      label: 'Documents',
      icon: 'file-text',
      badge: this.domainBadge('documents'),
    },
    { id: 'finalization', label: 'Finalisation', icon: 'check-circle' },
  ]);

  readonly activeSectionLabel = computed(() =>
    this.workspaceTabs().find(({ id }) => id === this.activeSection())?.label ?? 'Consultation',
  );

  readonly hasUnsavedChanges = computed(() =>
    this.clinical.dirty() ||
    this.prescription.dirty() ||
    this.orders.dirty() ||
    this.artifacts.dirty(),
  );

  readonly viewModel = computed<ConsultationWorkspaceViewModel>(() => {
    const consultation = this.finish.consultation();
    const section = this.activeSection();
    const status = consultation?.status ?? 'IN_PROGRESS';
    const activeSave = this.activeSavePresentation(section);

    return {
      screenReaderDescription:
        'Espace clinique connecté aux services de production. Les données non présentes dans la projection autorisée ne sont pas affichées.',
      title: 'Consultation active',
      initials: 'CS',
      identityBadges: [
        { label: 'Identité patient non disponible', icon: 'user', emphasis: true },
        { label: this.accessLabel(consultation) },
      ],
      contextItems: consultation
        ? [
            this.sourceLabel(consultation),
            `Début ${this.formatTime(consultation.startedAt)}`,
            `Référence ${this.shortReference(consultation.consultationId)}`,
          ]
        : ['Synchronisation de la consultation'],
      status: this.consultationTone(status),
      statusLabel: this.consultationLabel(status),
      tabs: this.workspaceTabs(),
      activeSection: section,
      activeSectionLabel: this.activeSectionLabel(),
      feedback: this.feedback(),
      patientRecordHref: null,
      activeSaveStatus: activeSave.status,
      activeSaveLabel: activeSave.label,
      showSaveAction: ['note', 'prescription', 'orders', 'documents'].includes(section),
      canSave: activeSave.canSave && status === 'IN_PROGRESS',
      saving: activeSave.saving,
      showPdfPreview: true,
      canPreviewPdf: false,
      canFinish:
        status === 'IN_PROGRESS' &&
        this.clinical.authoritative() !== null &&
        !this.hasUnsavedChanges() &&
        !this.clinical.saving() &&
        !this.prescription.saving() &&
        !this.prescription.finalizing() &&
        !this.orders.saving() &&
        this.orders.finalizingId() === null &&
        !this.artifacts.saving() &&
        !this.finish.submitting(),
      finishing: this.finish.submitting(),
      finishLabel: status === 'COMPLETED' ? 'Consultation terminée' : 'Terminer la consultation',
    };
  });

  constructor() {
    if (this.canonicalRoute) void this.finish.attach(this.consultationId);
  }

  handleWorkspaceAction(action: ConsultationWorkspaceAction): void {
    switch (action.kind) {
      case 'SET_SECTION':
        this.activeSection.set(action.section);
        this.feedback.set(null);
        break;
      case 'OPEN_MEDICAL_RECORD':
        this.mrsDrawerOpen.set(true);
        break;
      case 'DISMISS_FEEDBACK':
        this.feedback.set(null);
        break;
      case 'SAVE_ACTIVE':
        void this.saveActiveDomain();
        break;
      case 'PREVIEW_PDF':
        this.feedback.set('Aucun aperçu PDF global n’est disponible pour cette consultation.');
        break;
      case 'FINISH':
        void this.finish.finish();
        break;
    }
  }

  onDocumentKeydown(event: KeyboardEvent): void {
    if (!(event.metaKey || event.ctrlKey) || event.altKey || event.key.toLocaleLowerCase('fr-FR') !== 's') {
      return;
    }
    event.preventDefault();
    void this.saveActiveDomain();
  }

  canDeactivate(): boolean {
    if (!this.hasUnsavedChanges()) return true;
    return globalThis.window?.confirm(
      'Des modifications cliniques ne sont pas enregistrées. Quitter cette consultation ?',
    ) ?? true;
  }

  back(): void {
    void this.router.navigate(['/doctor']);
  }

  private async saveActiveDomain(): Promise<void> {
    switch (this.activeSection()) {
      case 'note':
        await this.clinical.save();
        break;
      case 'prescription':
        await this.prescription.save();
        break;
      case 'orders':
        await this.orders.save();
        break;
      case 'documents':
        await this.artifacts.save();
        break;
      case 'vitals':
        this.feedback.set('La saisie canonique des constantes n’est pas disponible.');
        break;
      case 'finalization':
        break;
    }
  }

  private activeSavePresentation(section: ConsultationWorkspaceSection): {
    readonly status: OcStatus;
    readonly label: string;
    readonly saving: boolean;
    readonly canSave: boolean;
  } {
    if (section === 'vitals') {
      return { status: 'blocked', label: 'Saisie indisponible', saving: false, canSave: false };
    }
    if (section === 'finalization') {
      return {
        status: this.hasUnsavedChanges() ? 'requires-attention' : 'completed',
        label: this.hasUnsavedChanges() ? 'Brouillons à enregistrer' : 'État synchronisé',
        saving: false,
        canSave: false,
      };
    }

    const domain = section === 'note'
      ? this.clinical
      : section === 'prescription'
        ? this.prescription
        : section === 'orders'
          ? this.orders
          : this.artifacts;
    const saving = domain.saving();
    const dirty = domain.dirty();
    const failed = domain.failure() !== null || domain.conflict();
    return {
      status: failed ? 'requires-attention' : saving ? 'in-progress' : dirty ? 'pending' : 'completed',
      label: failed
        ? 'Action requise'
        : saving
          ? 'Enregistrement…'
          : dirty
            ? 'Non enregistré'
            : 'Synchronisé',
      saving,
      canSave: dirty && !saving,
    };
  }

  private domainBadge(section: 'note' | 'prescription' | 'orders' | 'documents'): string | undefined {
    const presentation = this.activeSavePresentation(section);
    if (presentation.status === 'requires-attention') return 'Action';
    if (presentation.status === 'pending') return 'Modifié';
    return undefined;
  }

  private consultationTone(status: ConsultationStatus): OcStatus {
    if (status === 'IN_PROGRESS') return 'in-progress';
    if (status === 'FINALIZING') return 'pending';
    if (status === 'COMPLETED') return 'completed';
    return 'cancelled';
  }

  private consultationLabel(status: ConsultationStatus): string {
    if (status === 'IN_PROGRESS') return 'En cours';
    if (status === 'FINALIZING') return 'Finalisation en cours';
    if (status === 'COMPLETED') return 'Terminée';
    return 'Interrompue';
  }

  private accessLabel(consultation: ActiveConsultation | null): string {
    if (consultation === null) return 'Accès médical en vérification';
    const labels: Record<ActiveConsultation['medicalAccessStatus'], string> = {
      ACTIVE: 'Accès médical actif',
      NONE: 'Aucun accès médical',
      EXPIRED: 'Accès médical expiré',
      REVOKED: 'Accès médical révoqué',
      UNAVAILABLE: 'Accès médical indisponible',
    };
    return labels[consultation.medicalAccessStatus];
  }

  private sourceLabel(consultation: ActiveConsultation): string {
    if (consultation.sourceType === 'SCHEDULED_APPOINTMENT') return 'Rendez-vous planifié';
    if (consultation.sourceType === 'URGENT_CABINET') return 'Urgence au cabinet';
    return 'Urgence à domicile';
  }

  private formatTime(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'non renseigné';
    return new Intl.DateTimeFormat('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  }

  private shortReference(value: string): string {
    return value.slice(0, 8).toLocaleUpperCase('fr-FR');
  }
}
