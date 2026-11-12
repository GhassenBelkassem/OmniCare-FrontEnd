import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzModalModule } from 'ng-zorro-antd/modal';

import { OcAvatar, OcButton, OcIcon, OcStatusTag, patientAgeLabel } from '../../../shared/ui';
import { ActiveConsultationStore } from '../active-consultation.store';
import type { DoctorReasonCode, DoctorScheduledCareItem } from './scheduled-care.models';
import { ScheduledCareFacade } from './scheduled-care.facade';
import { formatScheduledInstant, formatScheduledRange } from './scheduled-care-time';

@Component({
  selector: 'app-scheduled-appointment-detail-panel',
  imports: [
    NgTemplateOutlet,
    NzDrawerModule,
    NzModalModule,
    OcAvatar,
    OcButton,
    OcIcon,
    OcStatusTag,
    RouterLink,
  ],
  template: `
    @if (presentation() === 'drawer') {
      <nz-drawer
        [nzVisible]="open()"
        nzTitle="Détails du rendez-vous"
        nzPlacement="right"
        [nzWidth]="'min(390px, 100vw)'"
        [nzClosable]="true"
        [nzMaskClosable]="!care.commandLoading() && !consultations.starting()"
        [nzKeyboard]="!care.commandLoading() && !consultations.starting()"
        [nzFooter]="detailFooter"
        nzWrapClassName="scheduled-detail-drawer"
        (nzOnClose)="close()"
      >
        <ng-container *nzDrawerContent>
          <ng-container [ngTemplateOutlet]="detailContent" />
        </ng-container>
      </nz-drawer>
    } @else {
      <nz-modal
        [nzVisible]="open()"
        nzTitle="Détails du rendez-vous"
        [nzClosable]="true"
        [nzMaskClosable]="!care.commandLoading() && !consultations.starting()"
        [nzKeyboard]="!care.commandLoading() && !consultations.starting()"
        [nzWidth]="'min(640px, calc(100vw - 32px))'"
        [nzFooter]="detailFooter"
        (nzOnCancel)="close()"
      >
        <ng-template nzModalContent>
          <ng-container [ngTemplateOutlet]="detailContent" />
        </ng-template>
      </nz-modal>
    }

    <ng-template #detailContent>
      @if (care.appointmentLoading()) {
        <div class="scheduled-detail__state" role="status">Chargement du rendez-vous…</div>
      } @else if (care.appointmentError(); as error) {
        <div class="scheduled-detail__failure">
          <p class="scheduled-detail__error" role="alert">{{ error }}</p>
          <oc-button variant="secondary" size="small" (click)="retryAppointment()">
            Réessayer
          </oc-button>
        </div>
      } @else if (care.activeAppointment(); as appointment) {
        <div
          class="scheduled-detail scheduled-appointment-detail"
          [class.scheduled-appointment-detail--modal]="presentation() === 'modal'"
        >
          <header class="scheduled-appointment-detail__hero">
            <div class="scheduled-appointment-detail__identity">
              <oc-avatar [name]="appointment.subject.displayName" size="large" />
              <div>
                <span class="scheduled-appointment-detail__eyebrow">Patient</span>
                <p class="scheduled-appointment-detail__name">
                  {{ appointment.subject.displayName }}
                </p>
                <p class="scheduled-appointment-detail__identity-meta">
                  <span>{{ relationshipLabel(appointment.subject.relationship) }}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {{
                      patientAge(
                        appointment.practicePatient?.dateOfBirth,
                        appointment.slot.start,
                        appointment.slot.timezone
                      )
                    }}
                  </span>
                </p>
              </div>
            </div>
            <div class="scheduled-appointment-detail__hero-actions">
              @if (statusCode()) { <oc-status-tag [status]="statusCode()" /> }
              @if (appointment.practicePatient; as patient) {
                <a
                  class="scheduled-appointment-detail__profile-link scheduled-appointment-detail__profile-link--button"
                  [routerLink]="['/doctor', 'patient', patient.practicePatientId]"
                  (click)="prepareProfileNavigation($event)"
                >
                  Voir le profil patient
                </a>
              }
            </div>
          </header>

          <section
            class="scheduled-appointment-detail__schedule"
            aria-label="Date et heure du rendez-vous"
          >
            <span
              class="scheduled-appointment-detail__eyebrow scheduled-appointment-detail__icon-label"
            >
              <oc-icon name="calendar" />
              Date et heure
            </span>
            <p class="scheduled-appointment-detail__schedule-value">
              {{
                formatRange(appointment.slot.start, appointment.slot.end, appointment.slot.timezone)
              }}
            </p>
            <p class="scheduled-appointment-detail__schedule-meta">
              {{ appointment.slot.durationMinutes }} min · {{ appointment.cabinet.timezone }}
            </p>
          </section>

          <section
            class="scheduled-appointment-detail__section"
            aria-labelledby="appointmentAdministrativeDetails"
          >
            <h3 id="appointmentAdministrativeDetails">Informations du rendez-vous</h3>
            <dl class="scheduled-appointment-detail__grid">
              <div>
                <dt>Professionnel</dt>
                <dd>{{ appointment.doctor.displayName }}</dd>
              </div>
              <div>
                <dt>Spécialité</dt>
                <dd>{{ appointment.doctor.specialty || 'Non renseignée' }}</dd>
              </div>
              <div>
                <dt>Cabinet</dt>
                <dd>{{ appointment.cabinet.name }}</dd>
              </div>
              <div class="scheduled-appointment-detail__wide">
                <dt>Adresse</dt>
                <dd>{{ cabinetAddress() }}</dd>
              </div>
            </dl>
          </section>

          <section
            class="scheduled-appointment-detail__section"
            aria-labelledby="appointmentPatientDetails"
          >
            <div class="scheduled-appointment-detail__section-heading">
              <h3 id="appointmentPatientDetails">À propos du patient</h3>
              @if (appointment.practicePatient; as patient) {
                <a
                  class="scheduled-appointment-detail__profile-link"
                  [routerLink]="['/doctor', 'patient', patient.practicePatientId]"
                  (click)="prepareProfileNavigation($event)"
                >
                  Voir le profil patient
                </a>
              }
            </div>
            @if (appointment.practicePatient; as patient) {
              <dl class="scheduled-appointment-detail__grid">
                <div>
                  <dt>Téléphone</dt>
                  <dd>{{ patient.phone || 'Non renseigné' }}</dd>
                </div>
                <div>
                  <dt>E-mail</dt>
                  <dd>{{ patient.email || 'Non renseigné' }}</dd>
                </div>
                <div>
                  <dt>Sexe</dt>
                  <dd>{{ sexLabel(patient.sex) }}</dd>
                </div>
                <div>
                  <dt>Date de naissance</dt>
                  <dd>{{ formatBirthDate(patient.dateOfBirth) }}</dd>
                </div>
                <div class="scheduled-appointment-detail__wide">
                  <dt>Adresse</dt>
                  <dd>{{ patient.address || 'Non renseignée' }}</dd>
                </div>
              </dl>
            } @else {
              <p class="scheduled-appointment-detail__unavailable">
                Les informations administratives ne sont pas reliées à un profil patient de la
                pratique.
              </p>
            }
          </section>

          <section
            class="scheduled-appointment-detail__section"
            aria-labelledby="appointmentConsultationReason"
          >
            <h3 id="appointmentConsultationReason">Motif de consultation</h3>
            <p class="scheduled-appointment-detail__reason">
              {{ appointment.consultationReason || 'Non renseigné' }}
            </p>
          </section>

          <section
            class="scheduled-appointment-detail__section"
            aria-labelledby="appointmentBillingDetails"
          >
            <h3 id="appointmentBillingDetails">Confirmation et tarif</h3>
            <dl class="scheduled-appointment-detail__grid">
              <div>
                <dt>Confirmé le</dt>
                <dd>{{ formatInstant(appointment.confirmedAt, appointment.slot.timezone) }}</dd>
              </div>
              <div>
                <dt>Tarif</dt>
                <dd class="scheduled-appointment-detail__price">
                  @if (appointment.quotedPrice; as price) {
                    {{ formatPrice(price.amount, price.currency) }}
                  } @else {
                    Non renseigné
                  }
                </dd>
              </div>
              @if (appointment.cancellation; as cancellation) {
                <div>
                  <dt>Annulé par</dt>
                  <dd>{{ cancellation.actor }}</dd>
                </div>
                <div>
                  <dt>Motif d'annulation</dt>
                  <dd>{{ reasonLabel(cancellation.reasonCode) }}</dd>
                </div>
              }
            </dl>
          </section>

          @if (showCancel() && appointment.availableActions.includes('CANCEL_APPOINTMENT')) {
            <section class="scheduled-detail__choice">
              <label>
                <span class="scheduled-detail__label">Motif obligatoire</span>
                <select
                  [value]="cancelReason()"
                  (change)="setCancelReason($any($event.target).value)"
                >
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
          } @else if (hasConflictingConsultation()) {
            <p class="scheduled-detail__error" role="alert">
              Une autre consultation est déjà en cours. Ce rendez-vous n’a pas été
              démarré.
            </p>
          }
          @if (consultations.error(); as error) {
            <p class="scheduled-detail__error" role="alert">{{ error }}</p>
          }
        </div>
      } @else {
        <div class="scheduled-detail__state">Aucun rendez-vous à afficher.</div>
      }
    </ng-template>

    <ng-template #detailFooter>
      <div class="scheduled-detail__actions">
        @if (activeConsultationForAppointment(); as active) {
          <oc-button
            variant="primary"
            size="small"
            [disabled]="care.commandLoading() || consultations.starting()"
            (click)="continueConsultation(active.consultationId)"
            >Continuer ce rendez-vous</oc-button
          >
        } @else if (canStart()) {
          <oc-button
            variant="primary"
            size="small"
            [loading]="consultations.starting()"
            [disabled]="care.commandLoading()"
            (click)="startConsultation()"
            >Démarrer la consultation</oc-button
          >
        }
        @if (care.activeAppointment()?.availableActions?.includes('CANCEL_APPOINTMENT')) {
          @if (!showCancel()) {
            <oc-button
              variant="secondary"
              size="small"
              [disabled]="care.commandLoading()"
              (click)="showCancel.set(true)"
              >Annuler le rendez-vous</oc-button
            >
          } @else {
            <oc-button
              variant="secondary"
              size="small"
              [loading]="care.commandLoading()"
              [disabled]="cancelReason() === ''"
              (click)="submitCancel()"
              >Confirmer l’annulation</oc-button
            >
          }
        }
        <oc-button
          variant="secondary"
          size="small"
          [disabled]="care.commandLoading()"
          (click)="close()"
          >Fermer</oc-button
        >
      </div>
    </ng-template>
  `,
  styleUrl: './scheduled-care-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class ScheduledAppointmentDetailPanel {
  readonly presentation = input<'modal' | 'drawer'>('modal');
  readonly care = inject(ScheduledCareFacade);
  readonly consultations = inject(ActiveConsultationStore);
  private readonly router = inject(Router);
  readonly open = signal(false);
  private readonly appointmentId = signal<string | null>(null);
  readonly showCancel = signal(false);
  readonly cancelReason = signal<DoctorReasonCode | ''>('');
  readonly reasons: readonly { code: DoctorReasonCode; label: string }[] = [
    { code: 'CABINET_UNAVAILABLE', label: 'Cabinet indisponible' },
    { code: 'DOCTOR_UNAVAILABLE', label: 'Médecin indisponible' },
    { code: 'SCHEDULE_CONFLICT', label: 'Conflit d’agenda' },
  ];
  readonly statusCode = computed(() => this.care.activeAppointment()?.status ?? '');
  readonly canStart = computed(
    () =>
      this.care.activeAppointment()?.status === 'CONFIRMED' &&
      this.care.activeAppointment()?.version !== null &&
      this.consultations.active() === null &&
      !this.consultations.loading() &&
      this.consultations.error() === null,
  );
  readonly activeConsultationForAppointment = computed(() => {
    const appointment = this.care.activeAppointment();
    const active = this.consultations.active();
    return appointment !== null && active?.sourceType === 'SCHEDULED_APPOINTMENT' &&
      active.sourceId === appointment.appointmentId
      ? active
      : null;
  });
  readonly hasConflictingConsultation = computed(
    () => this.consultations.active() !== null && this.activeConsultationForAppointment() === null,
  );

  openWith(appointment: DoctorScheduledCareItem | string): void {
    const appointmentId = typeof appointment === 'string' ? appointment : appointment.appointmentId;
    if (appointmentId === null) return;
    this.showCancel.set(false);
    this.cancelReason.set('');
    this.consultations.clearStartError();
    this.appointmentId.set(appointmentId);
    this.open.set(true);
    this.care.openAppointment(
      appointmentId,
      typeof appointment === 'string' ? null : appointment,
    );
  }
  close(): void {
    if (this.care.commandLoading() || this.consultations.starting()) return;
    this.open.set(false);
    this.care.closeAppointment();
  }
  retryAppointment(): void {
    const appointmentId = this.appointmentId();
    if (appointmentId) this.care.openAppointment(appointmentId);
  }
  prepareProfileNavigation(event: MouseEvent): void {
    if (this.care.commandLoading() || this.consultations.starting()) {
      event.preventDefault();
      return;
    }
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
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
    if (appointment?.status !== 'CONFIRMED' || appointment.version === null) return;
    const outcome = await this.consultations.startScheduledAppointment(
      appointment.appointmentId,
      appointment.version,
    );
    if (outcome.kind === 'STARTED' || outcome.kind === 'RECOVERED') {
      this.open.set(false);
      this.care.closeAppointment();
      await this.router.navigate(['/doctor', 'consultation', outcome.consultation.consultationId]);
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
  cabinetAddress(): string {
    const cabinet = this.care.activeAppointment()?.cabinet;
    if (!cabinet) return 'Non renseignée';
    return (
      [cabinet.address, cabinet.city, cabinet.governorate].filter(Boolean).join(', ') ||
      'Non renseignée'
    );
  }
  relationshipLabel(value: string | null): string {
    if (!value || value === 'SELF') return 'Patient';
    return value;
  }
  patientAge(dateOfBirth: string | null | undefined, at: string, timezone: string): string {
    return patientAgeLabel(dateOfBirth, at, timezone) ?? 'Âge non renseigné';
  }
  formatBirthDate(value: string | null | undefined): string {
    if (!value) return 'Non renseignée';
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isNaN(date.getTime())
      ? 'Non renseignée'
      : new Intl.DateTimeFormat('fr-TN', { dateStyle: 'long', timeZone: 'UTC' }).format(date);
  }
  sexLabel(value: string | null | undefined): string {
    if (value === 'F') return 'Femme';
    if (value === 'M') return 'Homme';
    return value?.trim() || 'Non renseigné';
  }
  formatPrice(amount: number, currency: string): string {
    try {
      return new Intl.NumberFormat('fr-TN', {
        style: 'currency',
        currency,
        maximumFractionDigits: 3,
      }).format(amount);
    } catch {
      return `${amount.toLocaleString('fr-TN')} ${currency}`;
    }
  }
  formatInstant = formatScheduledInstant;
  formatRange = formatScheduledRange;
}

function isDoctorReason(value: string): value is DoctorReasonCode {
  return (
    value === 'CABINET_UNAVAILABLE' ||
    value === 'DOCTOR_UNAVAILABLE' ||
    value === 'SCHEDULE_CONFLICT'
  );
}
