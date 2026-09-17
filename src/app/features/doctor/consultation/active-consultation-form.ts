import { ChangeDetectionStrategy, Component, OnInit, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { OcButton } from '../../../shared/ui';
import { ConsultationDraft, MockPrescriptionLine, MockVitals } from '../doctor-mock.models';
import { emptyVitals } from '../doctor-mock.service';
import { AiScribeStub } from './ai-scribe-stub';
import { OrdonnanceUploadStub } from './ordonnance-upload-stub';
import { PrescriptionBuilder } from './prescription-builder';
import { VitalsForm } from './vitals-form';

@Component({
  selector: 'app-active-consultation-form',
  imports: [FormsModule, OcButton, AiScribeStub, OrdonnanceUploadStub, PrescriptionBuilder, VitalsForm],
  templateUrl: './active-consultation-form.html',
  styleUrl: './active-consultation-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActiveConsultationForm implements OnInit {
  readonly readonly = input(false);
  readonly draft = input.required<ConsultationDraft>();
  readonly draftChange = output<ConsultationDraft>();
  readonly close = output<void>();

  readonly diagnosis = signal('');
  readonly treatment = signal('');
  readonly vitals = signal<MockVitals>(emptyVitals());
  readonly prescriptionLines = signal<readonly MockPrescriptionLine[]>([]);
  readonly scribeText = signal('');
  readonly ordonnanceText = signal('');

  readonly vitalsSummary = computed(() => {
    const vitals = this.vitals();
    const items: { label: string; value: string }[] = [];
    if (vitals.systolicBP !== null && vitals.diastolicBP !== null) {
      items.push({ label: 'Tension arterielle', value: `${vitals.systolicBP}/${vitals.diastolicBP} mmHg` });
    } else if (vitals.systolicBP !== null) {
      items.push({ label: 'Tension systolique', value: `${vitals.systolicBP} mmHg` });
    } else if (vitals.diastolicBP !== null) {
      items.push({ label: 'Tension diastolique', value: `${vitals.diastolicBP} mmHg` });
    }
    if (vitals.heartRate !== null) items.push({ label: 'Frequence cardiaque', value: `${vitals.heartRate} bpm` });
    if (vitals.temperature !== null) items.push({ label: 'Temperature', value: `${vitals.temperature} °C` });
    if (vitals.weight !== null) items.push({ label: 'Poids', value: `${vitals.weight} kg` });
    return items;
  });

  ngOnInit(): void {
    const draft = this.draft();
    this.diagnosis.set(draft.diagnosis);
    this.treatment.set(draft.treatment);
    this.vitals.set(draft.vitals);
    this.prescriptionLines.set(draft.prescriptionLines);
    this.scribeText.set(draft.scribeText);
    this.ordonnanceText.set(draft.ordonnanceText);
  }

  updateDiagnosis(value: string): void { this.diagnosis.set(value); this.emit(); }
  updateTreatment(value: string): void { this.treatment.set(value); this.emit(); }
  updateVitals(vitals: MockVitals): void { this.vitals.set(vitals); this.emit(); }
  updateLines(lines: readonly MockPrescriptionLine[]): void { this.prescriptionLines.set(lines); this.emit(); }
  updateScribe(text: string): void { this.scribeText.set(text); this.emit(); }
  updateOrdonnance(text: string): void { this.ordonnanceText.set(text); this.emit(); }

  private emit(): void {
    this.draftChange.emit({
      diagnosis: this.diagnosis(),
      treatment: this.treatment(),
      vitals: this.vitals(),
      prescriptionLines: this.prescriptionLines(),
      scribeText: this.scribeText(),
      ordonnanceText: this.ordonnanceText(),
    });
  }
}
