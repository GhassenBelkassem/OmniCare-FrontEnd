import { ChangeDetectionStrategy, Component, inject, input, output, signal, computed, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';
import { NzModalModule } from 'ng-zorro-antd/modal';

import { OcAvatar, OcStatusBadge, OcButton } from '../../../shared/ui';
import { AppointmentDto } from '../appointment-api.models';
import { AppointmentApiService } from '../appointment-api.service';

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
        @if (appointment()?.status === 'CONFIRMED') {
          <oc-button
            variant="primary"
            size="small"
            [loading]="acting()"
            (click)="startAppointment()"
          >
            Commencer
          </oc-button>
          <oc-button variant="secondary" size="small" (click)="cancel.emit()">
            Annuler
          </oc-button>
        } @else if (appointment()?.status === 'IN_PROGRESS') {
          <oc-button
            variant="primary"
            size="small"
            [loading]="acting()"
            (click)="completeAppointment()"
          >
            Terminer
          </oc-button>
        }
        <oc-button variant="secondary" size="small" (click)="open.set(false)">
          Fermer
        </oc-button>
      </ng-template>
    </nz-modal>
  `,
  styleUrl: './appointment-detail-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppointmentDetailPanel implements OnInit {
  private readonly appointmentApi = inject(AppointmentApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly open = signal(false);
  readonly appointment = signal<AppointmentDto | null>(null);
  readonly acting = signal(false);
  readonly actionError = signal<string | null>(null);
  readonly updated = output<AppointmentDto>();
  readonly cancel = output<void>();

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

  ngOnInit(): void {}

  openWith(appointment: AppointmentDto): void {
    this.appointment.set(appointment);
    this.actionError.set(null);
    this.open.set(true);
  }

  startAppointment(): void {
    const apt = this.appointment();
    if (!apt || this.acting()) return;
    this.acting.set(true);
    this.actionError.set(null);
    this.appointmentApi
      .startAppointment(apt.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.acting.set(false);
          this.appointment.set(updated);
          this.updated.emit(updated);
        },
        error: () => {
          this.acting.set(false);
          this.actionError.set("Impossible de démarrer la consultation.");
        },
      });
  }

  completeAppointment(): void {
    const apt = this.appointment();
    if (!apt || this.acting()) return;
    this.acting.set(true);
    this.actionError.set(null);
    this.appointmentApi
      .completeAppointment(apt.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.acting.set(false);
          this.appointment.set(updated);
          this.updated.emit(updated);
        },
        error: () => {
          this.acting.set(false);
          this.actionError.set("Impossible de terminer la consultation.");
        },
      });
  }
}
