import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { OcButton, OcAvatar, OcPageHeader } from '../../../shared/ui';
import { UnsavedChangesAware } from '../unsaved-changes.guard';
import { ConsultationDraft, ConsultationMode, MockConsultation, MockMedicalRecord, MockPatientMatch } from '../doctor-mock.models';
import { DoctorMockService, blankDraft, hasDraftContent } from '../doctor-mock.service';
import { ActiveConsultationForm } from './active-consultation-form';
import { CloseSummary } from './close-summary';
import { MedicalRecordView } from './medical-record-view';

const EMPTY_DRAFT: ConsultationDraft = {
  diagnosis: '',
  treatment: '',
  vitals: { systolicBP: null, diastolicBP: null, heartRate: null, temperature: null, weight: null },
  prescriptionLines: [],
  scribeText: '',
  ordonnanceText: '',
};

@Component({
  selector: 'app-consultation-page',
  imports: [OcButton, OcAvatar, OcPageHeader, RouterLink, ActiveConsultationForm, CloseSummary, MedicalRecordView],
  templateUrl: './consultation-page.html',
  styleUrl: './consultation-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConsultationPage implements UnsavedChangesAware {
  private readonly mock = inject(DoctorMockService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly consultationId: string;
  readonly isNew: boolean;
  record: MockMedicalRecord | null = null;
  consultation: MockConsultation | null = null;
  mode: ConsultationMode = 'active';

  readonly draft = signal<ConsultationDraft>(EMPTY_DRAFT);
  readonly started = signal(false);
  readonly closed = signal(false);

  readonly patientQuery = signal('');
  readonly patientResults = signal<readonly MockPatientMatch[]>([]);

  constructor() {
    this.consultationId = this.route.snapshot.paramMap.get('id') ?? '';
    this.isNew = this.consultationId === 'new';
    const source = this.route.snapshot.queryParamMap.get('source');

    if (this.isNew && source === 'urgent') {
      this.consultationId = 'c-14';
      this.isNew = false;
      this.loadConsultation(this.consultationId);
    } else if (!this.isNew) {
      this.loadConsultation(this.consultationId);
    }
  }

  private loadConsultation(id: string): void {
    const source = this.route.snapshot.queryParamMap.get('source');
    this.record = this.mock.recordFor(id, source === 'urgent' ? 'urgent' : undefined);
    this.consultation = this.mock.consultationFor(id);
    this.mode = this.consultation.status === 'closed' ? 'readonly' : 'active';
    this.draft.set(this.mock.draftFor(id) ?? blankDraft(this.consultation));
  }

  searchPatients(): void {
    const query = this.patientQuery();
    if (query.trim().length < 2) {
      this.patientResults.set([]);
      return;
    }
    this.patientResults.set(this.mock.findPatients(query));
  }

  selectPatient(match: MockPatientMatch): void {
    const id = this.mock.consultationIdForPatient(match.id);
    void this.router.navigate(['/doctor', 'consultation', id]);
  }

  storeDraft(draft: ConsultationDraft): void {
    this.draft.set(draft);
    this.mock.updateDraft(this.consultationId, draft);
  }

  closeConsultation(): void {
    this.mock.closeConsultation(this.consultationId, this.draft());
    this.closed.set(true);
  }

  bookFollowUp(): void {
    void this.router.navigate(['/doctor', 'follow-up']);
  }

  back(): void {
    void this.router.navigate(['/doctor']);
  }

  canDeactivate(): boolean {
    if (this.isNew) return true;
    if (this.mode === 'readonly' || this.closed() || !hasDraftContent(this.draft())) return true;
    return globalThis.window?.confirm('Vous avez des modifications non enregistrees. Quitter quand meme ?') ?? true;
  }
}
