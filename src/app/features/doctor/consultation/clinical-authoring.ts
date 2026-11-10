import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { OcButton } from '../../../shared/ui';
import { ClinicalRecordStore } from '../clinical-record.store';
import type { ClinicalDiagnosis, ClinicalFinding, ClinicalRecordPayload, FollowUpDecision } from '../clinical-record.models';

export type ClinicalQuickAction =
  | 'prescription'
  | 'lab'
  | 'imaging'
  | 'referral'
  | 'medical-certificate'
  | 'sick-leave-certificate';

@Component({
  selector: 'app-clinical-authoring',
  imports: [FormsModule, OcButton],
  templateUrl: './clinical-authoring.html',
  styleUrl: './clinical-authoring.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClinicalAuthoring {
  readonly consultationId = input.required<string>();
  readonly actionRequested = output<ClinicalQuickAction>();
  readonly store = inject(ClinicalRecordStore);

  constructor() {
    const destroyRef = inject(DestroyRef);
    effect(() => this.store.attach(this.consultationId()));
    destroyRef.onDestroy(() => this.store.clear());
  }

  updateText(field: 'chiefComplaint' | 'assessment' | 'notes', value: string): void {
    this.update({ ...this.store.draft(), [field]: nullable(value) });
  }

  updateHistory(field: keyof ClinicalRecordPayload['history'], value: string): void {
    const current = this.store.draft();
    this.update({ ...current, history: { ...current.history, [field]: nullable(value) } });
  }

  updateFinding(field: keyof ClinicalFinding, value: string): void {
    const current = this.store.draft();
    const finding = current.clinicalFindings[0] ?? { type: '', description: '' };
    const next = { ...finding, [field]: value,
      ...(field === 'description' && value.trim().length > 0 && finding.type.length === 0
        ? { type: 'EXAMINATION' } : {}) };
    this.update({ ...current, clinicalFindings: next.type || next.description ? [next] : [] });
  }

  updateDiagnosis(field: keyof ClinicalDiagnosis, value: string): void {
    const current = this.store.draft();
    const diagnosis = current.diagnoses[0] ?? { system: 'LOCAL', code: '', label: '', status: 'PROVISIONAL' };
    const next = { ...diagnosis, [field]: value };
    this.update({ ...current, diagnoses: next.label.trim().length > 0 ? [next] : [] });
  }

  updateTreatment(value: string): void {
    this.update({ ...this.store.draft(), treatmentPlan: value.split('\n').map((item) => item.trim()).filter(Boolean) });
  }

  updateFollowUpDecision(value: string): void {
    const current = this.store.draft();
    const decision = isFollowUpDecision(value) ? value : null;
    const required = decision !== null && decision !== 'NO_FOLLOW_UP';
    const recommendedAt = decision === 'FOLLOW_UP_IN_PERIOD' ? current.followUp.recommendedAt : null;
    this.update({ ...current, followUp: { decision, required, recommendedAt } });
  }

  updateFollowUpDate(value: string): void {
    const current = this.store.draft();
    this.update({ ...current, followUp: { ...current.followUp, recommendedAt: nullable(value) } });
  }

  updateMedicationDecision(value: string): void {
    const decision = value === 'MEDICATION_PRESCRIBED' || value === 'NO_MEDICATION' ? value : null;
    this.update({ ...this.store.draft(), medicationDecision: decision });
    if (decision === 'MEDICATION_PRESCRIBED') this.actionRequested.emit('prescription');
  }

  requestAction(action: ClinicalQuickAction): void {
    this.actionRequested.emit(action);
  }

  finding(field: keyof ClinicalFinding): string {
    return this.store.draft().clinicalFindings[0]?.[field] ?? '';
  }

  diagnosis(field: keyof ClinicalDiagnosis): string {
    return this.store.draft().diagnoses[0]?.[field] ?? (field === 'status' ? 'PROVISIONAL' : '');
  }

  private update(value: ClinicalRecordPayload): void {
    this.store.setDraft(value);
  }
}

function isFollowUpDecision(value: string): value is FollowUpDecision {
  return ['NO_FOLLOW_UP', 'FOLLOW_UP_IN_PERIOD', 'FOLLOW_UP_AFTER_RESULTS', 'FOLLOW_UP_AS_NEEDED'].includes(value);
}

function nullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
