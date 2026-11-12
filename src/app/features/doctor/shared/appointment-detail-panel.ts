import { ChangeDetectionStrategy, Component, signal, computed } from '@angular/core';
import { NzModalModule } from 'ng-zorro-antd/modal';

import { OcAvatar, OcStatusBadge, OcButton } from '../../../shared/ui';
import { AppointmentDto } from '../appointment-api.models';

@Component({
  selector: 'app-appointment-detail-panel',
  imports: [NzModalModule, OcAvatar, OcStatusBadge, OcButton],
  template: `
    <nz-modal
      [nzVisible]="open()"
      nzTitle="Détails du rendez-vous"
      [nzClosable]="true"
      [nzMaskClosable]="true"
      [nzKeyboard]="true"
      [nzWidth]="480"
      (nzOnCancel)="open.set(false)"
    >
      <ng-template nzModalContent>
        @if (appointment(); as apt) {
          <div class="apt-detail">
            <div class="apt-detail__patient">
              <oc-avatar [name]="patientName()" size="large" />
              <div>
                <p class="apt-detail__name">{{ patientName() }}</p>
                <p class="apt-detail__id">{{ apt.patientId }}</p>
              </div>
            </div>

            <div class="apt-detail__grid">
              <div class="apt-detail__field">
                <span class="apt-detail__label">Date</span>
                <span class="apt-detail__value">{{ apt.startTime }}</span>
              </div>
              <div class="apt-detail__field">
                <span class="apt-detail__label">Fin</span>
                <span class="apt-detail__value">{{ apt.endTime }}</span>
              </div>
              <div class="apt-detail__field">
                <span class="apt-detail__label">Statut</span>
                <oc-status-badge [status]="statusOc()" />
              </div>
              @if (quotedPrice(); as price) {
                <div class="apt-detail__field">
                  <span class="apt-detail__label">Tarif</span>
                  <span class="apt-detail__value">{{ price.toLocaleString('fr-FR') }} TND</span>
                </div>
              }
              <div class="apt-detail__field">
                <span class="apt-detail__label">Source</span>
                <span class="apt-detail__value">{{ apt.source }}</span>
              </div>
              <div class="apt-detail__field">
                <span class="apt-detail__label">Créé le</span>
                <span class="apt-detail__value">{{ apt.createdAt }}</span>
              </div>
            </div>

            @if (apt.notes; as notes) {
              <div class="apt-detail__notes">
                <span class="apt-detail__label">Notes</span>
                <p>{{ notes }}</p>
              </div>
            }

            @if (actionError(); as error) {
              <p class="apt-detail__error" role="alert">{{ error }}</p>
            }
          </div>
        }
      </ng-template>
      <ng-template nzModalFooter>
        <!-- Read-only details. Starting and finishing go only through the consultation lifecycle
             (« Démarrer la consultation » / the consultation page); the legacy appointment routes are retired. -->
        <oc-button variant="secondary" size="small" (click)="open.set(false)">
          Fermer
        </oc-button>
      </ng-template>
    </nz-modal>
  `,
  styleUrl: './appointment-detail-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppointmentDetailPanel {
  readonly open = signal(false);
  readonly appointment = signal<AppointmentDto | null>(null);
  readonly actionError = signal<string | null>(null);

  readonly patientName = computed(() => {
    const apt = this.appointment();
    if (!apt) return '';
    return apt.patientName ?? apt.patientId;
  });

  readonly statusOc = computed<'pending' | 'confirmed' | 'cancelled' | 'in-progress'>(() => {
    const status = this.appointment()?.status;
    if (status === 'CONFIRMED') return 'pending';
    if (status === 'IN_PROGRESS') return 'in-progress';
    if (status === 'COMPLETED') return 'confirmed';
    if (status === 'CANCELLED') return 'cancelled';
    return 'pending';
  });

  readonly quotedPrice = computed(() => this.appointment()?.quotedPriceTnd ?? null);

  openWith(appointment: AppointmentDto): void {
    this.appointment.set(appointment);
    this.actionError.set(null);
    this.open.set(true);
  }
}
