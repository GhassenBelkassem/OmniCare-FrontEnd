import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
} from '@angular/core';

import { OcButton } from '../../../shared/ui';
import {
  canReadMedicalContext,
  isExternalOwner,
  type ActiveConsultation,
  type MedicalAccessStatus,
} from '../active-consultation.models';
import type { ConsultationSummary, CurrentMedication } from '../medical-record.models';
import { MedicalRecordStore } from '../medical-record.store';

@Component({
  selector: 'app-doctor-medical-workspace',
  imports: [OcButton],
  templateUrl: './doctor-medical-workspace.html',
  styleUrl: './doctor-medical-workspace.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DoctorMedicalWorkspace {
  readonly consultation = input.required<ActiveConsultation>();
  readonly store = inject(MedicalRecordStore);
  /** The doctor owns this external patient's record: no access step, no access message. */
  readonly externalOwner = computed(() => isExternalOwner(this.consultation()));
  /** ACTIVE whenever the context may be read; otherwise the consultation's grant state. */
  readonly accessState = computed<MedicalAccessStatus>(() =>
    canReadMedicalContext(this.consultation()) ? 'ACTIVE' : this.consultation().medicalAccessStatus,
  );

  constructor() {
    const destroyRef = inject(DestroyRef);
    effect(() => {
      const consultation = this.consultation();
      if (canReadMedicalContext(consultation)) {
        this.store.attach(consultation.consultationId);
      } else {
        this.store.clear();
      }
    });
    destroyRef.onDestroy(() => this.store.clear());
  }

  sectionState(section: 'ESSENTIAL_INFORMATION' | 'CURRENT_MEDICATIONS' | 'CONSULTATION_SUMMARIES'): string {
    return this.store.workspace()?.access.sections[section] ?? 'NOT_SHARED';
  }

  medicationLabel(medication: CurrentMedication): string {
    return medication.name ?? medication.code ?? 'Médicament sans libellé';
  }

  medicationInstruction(medication: CurrentMedication): string {
    return [
      medication.strength,
      medication.dosageText ?? this.dose(medication),
      medication.frequencyText ?? (medication.timesPerDay === null
        ? null
        : `${medication.timesPerDay} fois/jour`),
      medication.route,
    ].filter((value): value is string => value !== null && value.trim().length > 0).join(' · ');
  }

  summaryTitle(summary: ConsultationSummary): string {
    return summary.chiefComplaint
      ?? summary.diagnoses.find((diagnosis) => diagnosis.label !== null)?.label
      ?? summary.clinicalCodes.find((code) => code.code !== null)?.code
      ?? 'Consultation';
  }

  summaryDiagnosis(summary: ConsultationSummary): string {
    return summary.diagnoses
      .map((diagnosis) => diagnosis.label ?? diagnosis.code)
      .filter((value): value is string => value !== null)
      .join(', ');
  }

  private dose(medication: CurrentMedication): string | null {
    if (medication.doseAmount === null) return null;
    return `${medication.doseAmount}${medication.doseUnit ? ` ${medication.doseUnit}` : ''}`;
  }
}
