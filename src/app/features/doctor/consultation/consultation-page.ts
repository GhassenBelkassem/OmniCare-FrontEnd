import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { OcButton, OcSheet, type OcStatus, type OcTab } from '../../../shared/ui';
import { ActiveConsultationStore } from '../active-consultation.store';
import {
  canReadMedicalContext,
  isExternalOwner,
  type ActiveConsultation,
  type ConsultationStatus,
} from '../active-consultation.models';
import { ArtifactStore } from '../artifact.store';
import { ClinicalOrderStore } from '../clinical-order.store';
import { ClinicalRecordStore } from '../clinical-record.store';
import { ConsultationFinishStore } from '../consultation-finish.store';
import { MedicalRecordStore } from '../medical-record.store';
import { PrescriptionStore } from '../prescription.store';
import { UrgentCabinetClinicalStore } from '../urgent-cabinet-clinical.store';
import { ageLabel, patientInitials, sexLabel } from '../patient-chart/patient-chart-format';
import { UnsavedChangesAware } from '../unsaved-changes.guard';
import { ClinicalAuthoring, type ClinicalQuickAction } from './clinical-authoring';
import { ClinicalOrders } from './clinical-orders';
import { ConsultationWorkspaceView } from './consultation-workspace-view';
import type {
  ConsultationIdentityBadge,
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
  readonly medicalRecord = inject(MedicalRecordStore);
  readonly urgentCabinet = inject(UrgentCabinetClinicalStore);

  readonly consultationId = this.route.snapshot.paramMap.get('id') ?? '';
  readonly canonicalRoute = UUID_PATTERN.test(this.consultationId);
  readonly activeSection = signal<ConsultationWorkspaceSection>('note');
  readonly mrsDrawerOpen = signal(false);
  readonly feedback = signal<string | null>(null);

  /** The patient's medical context may be shown (external owner, or OmniCare grant). */
  readonly canReadContext = computed(() => canReadMedicalContext(this.finish.consultation()));
  /** The doctor owns this external patient's record: no access message is ever shown. */
  readonly externalOwner = computed(() => isExternalOwner(this.finish.consultation()));

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

    const patient = consultation?.patient ?? null;

    return {
      screenReaderDescription: patient
        ? `Consultation de ${patient.fullName}. Seules les informations auxquelles vous avez accès sont affichées.`
        : 'Consultation en cours. Seules les informations auxquelles vous avez accès sont affichées.',
      title: patient?.fullName ?? 'Patient',
      initials: patient ? patientInitials(patient) : 'P',
      identityBadges: this.identityBadges(consultation),
      contextItems: consultation
        ? [this.sourceLabel(consultation), `Début ${this.formatTime(consultation.startedAt)}`]
        : ['Chargement de la consultation'],
      status: this.consultationTone(status),
      statusLabel: this.consultationLabel(status),
      tabs: this.workspaceTabs(),
      activeSection: section,
      activeSectionLabel: this.activeSectionLabel(),
      feedback: this.feedback(),
      patientRecordHref: patient ? `/doctor/patient/${patient.chartId}` : null,
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
    effect(() => {
      const consultation = this.finish.consultation();
      if (consultation && canReadMedicalContext(consultation)) {
        this.medicalRecord.attach(consultation.consultationId);
      } else {
        this.medicalRecord.clear();
      }
    });
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
        this.activeSection.set('finalization');
        void this.finish.review();
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

  openAction(action: ClinicalQuickAction): void {
    if (action === 'prescription') {
      this.activeSection.set('prescription');
    } else if (action === 'lab' || action === 'imaging' || action === 'referral') {
      this.activeSection.set('orders');
      this.orders.beginCreate(action === 'lab' ? 'LAB' : action === 'imaging' ? 'IMAGING' : 'REFERRAL');
    } else {
      this.activeSection.set('documents');
      this.artifacts.begin(action === 'medical-certificate' ? 'MEDICAL_CERTIFICATE' : 'SICK_LEAVE_CERTIFICATE');
    }
    this.feedback.set(null);
  }

  readinessLabel(code: string): string {
    const labels: Record<string, string> = {
      CLINICAL_RECORD_MISSING: 'Enregistrez le dossier clinique.',
      DIAGNOSIS: 'Diagnostic ou conclusion requis.',
      MEDICATION_DECISION: 'Décision médicamenteuse requise.',
      FOLLOW_UP_DECISION: 'Décision de suivi requise.',
      PRESCRIPTION_NOT_FINALIZED: 'Finalisez et signez la prescription.',
      PRESCRIPTION_CONTRADICTS_DECISION: 'La prescription contredit la décision médicamenteuse.',
      ORDER_NOT_FINALIZED: 'Finalisez les ordres cliniques en brouillon.',
      ARTIFACT_NOT_FINALIZED: 'Finalisez les documents officiels en brouillon.',
    };
    return labels[code] ?? 'Un élément doit être vérifié avant la fin.';
  }

  resolveReadiness(code: string): void {
    if (code.startsWith('PRESCRIPTION_')) {
      this.activeSection.set('prescription');
    } else if (code.startsWith('ORDER_')) {
      this.activeSection.set('orders');
    } else if (code.startsWith('ARTIFACT_')) {
      this.activeSection.set('documents');
    } else {
      this.activeSection.set('note');
    }
    this.feedback.set(null);
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

  /**
   * « environ 20 ans », « Homme », « Patient externe » ; an OmniCare patient also keeps the
   * consultation's access badge. An external owner never sees an access message.
   */
  private identityBadges(consultation: ActiveConsultation | null): readonly ConsultationIdentityBadge[] {
    const patient = consultation?.patient ?? null;
    const badges: ConsultationIdentityBadge[] = [];
    if (patient) {
      const age = ageLabel(patient);
      if (age) badges.push({ label: age });
      if (patient.sex) badges.push({ label: sexLabel(patient.sex) });
    }
    const external = patient ? patient.patientType === 'EXTERNAL' : isExternalOwner(consultation);
    if (patient || consultation?.access) {
      badges.push({ label: external ? 'Patient externe' : 'Patient OmniCare', icon: 'user', emphasis: true });
    }
    if (!isExternalOwner(consultation)) badges.push({ label: this.accessLabel(consultation) });
    return badges;
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

}
