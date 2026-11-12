import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NzModalModule } from 'ng-zorro-antd/modal';

import { OcButton, OcIcon } from '../../../shared/ui';

@Component({
  selector: 'app-patient-add-method-dialog',
  imports: [NzModalModule, OcButton, OcIcon],
  templateUrl: './patient-add-method-dialog.html',
  styleUrl: './patient-add-method-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientAddMethodDialog {
  readonly open = input(false);
  readonly openChange = output<boolean>();
  readonly findOmniCare = output<void>();
  readonly createExternal = output<void>();

  close(): void {
    this.openChange.emit(false);
  }
}
