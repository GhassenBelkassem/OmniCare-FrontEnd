import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NzModalModule } from 'ng-zorro-antd/modal';

import { OcAvatar, OcButton, OcStatusBadge } from '../../../shared/ui';
import { ActiveConsultationStore } from '../active-consultation.store';
import type { DoctorReasonCode } from './scheduled-care.models';
import { ScheduledCareFacade } from './scheduled-care.facade';
import { formatScheduledInstant, formatScheduledRange } from './scheduled-care-time';

@Component({
  selector: 'app-scheduled-appointment-detail-panel',
  imports: [NzModalModule, OcAvatar, OcButton, OcStatusBadge],
  template: `
    <nz-modal
      [nzVisible]="open()"
      nzTitle="Détails du rendez-vous"
      [nzClosable]="true"
      [nzMaskClosable]="!care.commandLoading() && !consultations.starting()"
      [nzKeyboard]="!care.commandLoading() && !consultations.starting()"
      [nzWidth]="500"
      (nzOnCancel)="close()"
    >
      <ng-template nzModalContent>
        @if (care.appointmentLoading()) {
          <div class="scheduled-detail__state" role="status">Chargement du rendez-vous…</div>
        } @else if (care.appointmentError(); as error) {
          <div class="scheduled-detail__error" role="alert">{{ error }}</div>
        } @else if (care.activeAppointment(); as appointment) {
          <div class="scheduled-detail">
            <div class="scheduled-detail__subject">
              <oc-avatar [name]="appointment.subject.displayName" size="large" />
              <div>
                <p class="scheduled-detail__name">{{ appointment.subject.displayName }}</p>
                <p class="scheduled-detail__secondary">{{ appointment.subject.relationship || 'Patient' }}</p>
              </div>
              <oc-status-badge [status]="statusBadge()" [customLabel]="statusLabel()" />
            </div>
            <dl class="scheduled-detail__grid">
              <div><dt>Rendez-vous</dt><dd>{{ appointment.appointmentId }}</dd></div>
              <div><dt>Version</dt><dd>{{ appointment.version }}</dd></div>
              <div class="scheduled-detail__wide"><dt>Demande source</dt><dd>{{ appointment.sourceBookingRequestId }}</dd></div>
              <div><dt>Médecin</dt><dd>{{ appointment.doctor.displayName }}</dd></div>
              <div><dt>Spécialité</dt><dd>{{ appointment.doctor.specialty || '—' }}</dd></div>
              <div class="scheduled-detail__wide"><dt>Créneau</dt><dd>{{ formatRange(appointment.slot.start, appointment.slot.end, appointment.slot.timezone) }}</dd></div>
              <div><dt>Cabinet</dt><dd>{{ appointment.cabinet.name }}</dd></div>
              <div><dt>Ville</dt><dd>{{ appointment.cabinet.city }}</dd></div>
              <div><dt>Confirmé le</dt><dd>{{ formatInstant(appointment.confirmedAt, appointment.slot.timezone) }}</dd></div>
              @if (appointment.quotedPrice; as price) {
                <div><dt>Tarif</dt><dd>{{ price.amount.toLocaleString('fr-FR') }} {{ price.currency }}</dd></div>
              }
              @if (appointment.cancellation; as cancellation) {
                <div><dt>Annulé par</dt><dd>{{ cancellation.actor }}</dd></div>
                <div><dt>Motif</dt><dd>{{ reasonLabel(cancellation.reasonCode) }}</dd></div>
              }
            </dl>
            @if (showCancel() && appointment.availableActions.includes('CANCEL_APPOINTMENT')) {
              <section class="scheduled-detail__choice">
                <label>
                  <span class="scheduled-detail__label">Motif obligatoire</span>
                  <select [value]="cancelReason()" (change)="setCancelReason($any($event.target).value)">
                    <option value="">Sélectionner un motif</option>
                    @for (reason of reasons; track reason.code) {
                      <option [value]="reason.code">{{ reason.label }}</option>
                    }
                  </select>
                </label>
              </section>
            }
            @if (care.commandError(); as error) {
              <p class="scheduled-detail__error" role="alert">{{ error }}</p>
            }
            @if (consultations.startError(); as error) {
              <p class="scheduled-detail__error" role="alert">{{ error }}</p>
            }
            @if (consultations.error(); as error) {
              <p class="scheduled-detail__error" role="alert">{{ error }}</p>
            }
          </div>
        }
      </ng-template>
      <ng-template nzModalFooter>
        @if (consultations.active(); as active) {
          <oc-button
            variant="primary"
            size="small"
            [disabled]="care.commandLoading() || consultations.starting()"
            (click)="continueConsultation(active.consultationId)"
          >Continuer la consultation</oc-button>
        } @else if (canStart()) {
          <oc-button
            variant="primary"
            size="small"
            [loading]="consultations.starting()"
            [disabled]="care.commandLoading()"
            (click)="startConsultation()"
          >Démarrer la consultation</oc-button>
        }
        @if (care.activeAppointment()?.availableActions?.includes('CANCEL_APPOINTMENT')) {
          @if (!showCancel()) {
            <oc-button variant="secondary" size="small" [disabled]="care.commandLoading()" (click)="showCancel.set(true)">Annuler le rendez-vous</oc-button>
          } @else {
            <oc-button variant="secondary" size="small" [loading]="care.commandLoading()" [disabled]="cancelReason() === ''" (click)="submitCancel()">Confirmer l’annulation</oc-button>
          }
        }
        <oc-button variant="secondary" size="small" [disabled]="care.commandLoading()" (click)="close()">Fermer</oc-button>
      </ng-template>
    </nz-modal>
  `,
  styleUrl: './scheduled-care-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScheduledAppointmentDetailPanel {
  readonly care = inject(ScheduledCareFacade);
  readonly consultations = inject(ActiveConsultationStore);
  private readonly router = inject(Router);
  readonly open = signal(false);
  readonly showCancel = signal(false);
  readonly cancelReason = signal<DoctorReasonCode | ''>('');
  readonly reasons: readonly { code: DoctorReasonCode; label: string }[] = [
    { code: 'CABINET_UNAVAILABLE', label: 'Cabinet indisponible' },
    { code: 'DOCTOR_UNAVAILABLE', label: 'Médecin indisponible' },
    { code: 'SCHEDULE_CONFLICT', label: 'Conflit d’agenda' },
  ];
  readonly statusLabel = computed(() => {
    switch (this.care.activeAppointment()?.status) {
      case 'CONFIRMED': return 'Confirmé';
      case 'IN_PROGRESS': return 'En cours';
      case 'COMPLETED': return 'Terminé';
      case 'CANCELLED': return 'Annulé';
      case 'NO_SHOW': return 'Absent';
      default: return '';
    }
  });
  readonly statusBadge = computed<'pending' | 'confirmed' | 'cancelled' | 'in-progress'>(() => {
    const status = this.care.activeAppointment()?.status;
    if (status === 'IN_PROGRESS') return 'in-progress';
    if (status === 'COMPLETED') return 'confirmed';
    if (status === 'CANCELLED') return 'cancelled';
    return 'pending';
  });
  readonly canStart = computed(
    () => this.care.activeAppointment()?.status === 'CONFIRMED' &&
      this.consultations.active() === null &&
      !this.consultations.loading() &&
      this.consultations.error() === null,
  );

  openWith(appointmentId: string): void {
    this.showCancel.set(false);
    this.cancelReason.set('');
    this.consultations.clearStartError();
    this.open.set(true);
    this.care.openAppointment(appointmentId);
  }
  close(): void {
    if (this.care.commandLoading() || this.consultations.starting()) return;
    this.open.set(false);
    this.care.closeAppointment();
  }
  setCancelReason(value: string): void {
    this.cancelReason.set(isDoctorReason(value) ? value : '');
  }
  submitCancel(): void {
    const reason = this.cancelReason();
    if (reason) this.care.cancelAppointment(reason);
  }
  async startConsultation(): Promise<void> {
    const appointment = this.care.activeAppointment();
    if (appointment?.status !== 'CONFIRMED') return;
    const outcome = await this.consultations.startScheduledAppointment(
      appointment.appointmentId,
      appointment.version,
    );
    if (outcome.kind === 'STARTED' || outcome.kind === 'RECOVERED') {
      this.open.set(false);
      this.care.closeAppointment();
      await this.router.navigate([
        '/doctor',
        'consultation',
        outcome.consultation.consultationId,
      ]);
    }
  }
  async continueConsultation(consultationId: string): Promise<void> {
    this.open.set(false);
    this.care.closeAppointment();
    await this.router.navigate(['/doctor', 'consultation', consultationId]);
  }
  reasonLabel(code: string): string {
    return this.reasons.find((reason) => reason.code === code)?.label ?? code;
  }
  formatInstant = formatScheduledInstant;
  formatRange = formatScheduledRange;
}

function isDoctorReason(value: string): value is DoctorReasonCode {
  return value === 'CABINET_UNAVAILABLE' || value === 'DOCTOR_UNAVAILABLE' || value === 'SCHEDULE_CONFLICT';
}
