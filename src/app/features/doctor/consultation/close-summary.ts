import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { OcButton } from '../../../shared/ui';
import { ConsultationDraft, MockConsultation, MockMedicalRecord } from '../doctor-mock.models';

@Component({
  selector: 'app-close-summary',
  imports: [OcButton],
  templateUrl: './close-summary.html',
  styleUrl: './close-summary.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CloseSummary {
  readonly record = input.required<MockMedicalRecord>();
  readonly consultation = input.required<MockConsultation>();
  readonly draft = input.required<ConsultationDraft>();
  readonly bookFollowUp = output<void>();
  readonly backToDashboard = output<void>();
}
