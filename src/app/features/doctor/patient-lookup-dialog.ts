import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';

import { OcButton } from '../../shared/ui';
import { MockPatientMatch } from './doctor-mock.models';
import { DoctorMockService } from './doctor-mock.service';

@Component({
  selector: 'app-patient-lookup-dialog',
  imports: [OcButton],
  templateUrl: './patient-lookup-dialog.html',
  styleUrl: './patient-lookup-dialog.scss',
  host: {
    '(document:keydown.escape)': 'onEscape()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientLookupDialog {
  readonly open = input(false);
  readonly selected = output<MockPatientMatch>();
  readonly dismissed = output<void>();

  private readonly mock = inject(DoctorMockService);

  readonly query = signal('');
  readonly results = computed(() => this.mock.findPatients(this.query()));

  updateQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  select(match: MockPatientMatch): void {
    this.reset();
    this.selected.emit(match);
  }

  dismiss(): void {
    this.reset();
    this.dismissed.emit();
  }

  onEscape(): void {
    if (this.open()) this.dismiss();
  }

  private reset(): void {
    this.query.set('');
  }
}
