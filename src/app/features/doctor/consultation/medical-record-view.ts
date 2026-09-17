import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { OcButton } from '../../../shared/ui';
import { ConsultationMode, MockMedicalRecord } from '../doctor-mock.models';
import { ageFromDob } from '../doctor-mock.service';

@Component({
  selector: 'app-medical-record-view',
  imports: [OcButton],
  templateUrl: './medical-record-view.html',
  styleUrl: './medical-record-view.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MedicalRecordView {
  readonly record = input.required<MockMedicalRecord>();
  readonly mode = input<ConsultationMode>('active');
  readonly started = input(false);
  readonly start = output<void>();

  readonly ageFromDob = ageFromDob;
}
