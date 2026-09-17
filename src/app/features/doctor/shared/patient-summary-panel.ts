import { ChangeDetectionStrategy, Component, inject, output, signal, computed } from '@angular/core';
import { Router } from '@angular/router';

import { OcAvatar, OcButton } from '../../../shared/ui';
import { OcDetailPanel } from '../../../shared/ui';
import { DoctorMockService, ageFromDob } from '../doctor-mock.service';
import { MockPatient } from '../doctor-mock.models';

@Component({
  selector: 'app-patient-summary-panel',
  imports: [OcDetailPanel, OcAvatar, OcButton],
  template: `
    <oc-detail-panel
      [open]="open()"
      title="Dossier patient"
      (closed)="open.set(false)"
    >
      @if (patient(); as p) {
        <div class="patient-detail">
          <div class="patient-detail__header">
            <oc-avatar [name]="p.name" size="large" />
            <div>
              <p class="patient-detail__name">{{ p.name }}</p>
              <p class="patient-detail__meta">{{ age() }} ans — {{ p.phone }}</p>
            </div>
          </div>

          <div class="patient-detail__grid">
            <div class="patient-detail__field">
              <span class="patient-detail__label">Date de naissance</span>
              <span class="patient-detail__value">{{ p.dob }}</span>
            </div>
            <div class="patient-detail__field">
              <span class="patient-detail__label">Telephone</span>
              <span class="patient-detail__value">{{ p.phone }}</span>
            </div>
            <div class="patient-detail__field">
              <span class="patient-detail__label">ID</span>
              <span class="patient-detail__value">{{ p.id }}</span>
            </div>
          </div>
        </div>
      } @else {
        <div class="patient-detail__empty">Patient introuvable.</div>
      }

      <div ocDetailActions>
        <oc-button variant="primary" size="small" (click)="viewFullChart()">
          Voir le dossier complet
        </oc-button>
      </div>
    </oc-detail-panel>
  `,
  styleUrl: './patient-summary-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientSummaryPanel {
  private readonly router = inject(Router);
  private readonly mock = inject(DoctorMockService);

  readonly open = signal(false);
  readonly patientId = signal('');
  readonly viewChart = output<string>();

  readonly patient = computed<MockPatient | undefined>(() => {
    const id = this.patientId();
    if (!id) return undefined;
    return this.mock.patientById(id);
  });

  readonly age = computed(() => {
    const p = this.patient();
    if (!p) return 0;
    return ageFromDob(p.dob);
  });

  openWith(patientId: string): void {
    this.patientId.set(patientId);
    this.open.set(true);
  }

  viewFullChart(): void {
    const id = this.patientId();
    this.viewChart.emit(id);
    this.open.set(false);
    void this.router.navigate(['/doctor', 'patient', id]);
  }
}
