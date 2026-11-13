import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';

import { OcAvatar, OcButton } from '../../../shared/ui';
import { ActiveConsultationStore } from '../active-consultation.store';
import { ScheduledCareFacade } from '../scheduled-care/scheduled-care.facade';
import { formatScheduledInstant, formatScheduledRange } from '../scheduled-care/scheduled-care-time';
import type {
  AvailabilitySlot,
  DoctorReasonCode,
  DoctorScheduledCareItem,
} from '../scheduled-care/scheduled-care.models';
import { isFollowUpItem } from './calendar-event.adapter';
import { CalendarPreferencesStore } from './calendar-preferences.store';
import { patientLabel } from './calendar-privacy';
import { TUNIS_TIME_ZONE } from './calendar-time';
import { presentCalendarItem } from './calendar-presentation';

type PanelMode = 'appointment' | 'request';

const REASONS: readonly { code: DoctorReasonCode; label: string }[] = [
  { code: 'CABINET_UNAVAILABLE', label: 'Cabinet indisponible' },
  { code: 'DOCTOR_UNAVAILABLE', label: 'Médecin indisponible' },
  { code: 'SCHEDULE_CONFLICT', label: 'Conflit d’agenda' },
];

/**
 * Side panel of the doctor calendar: one appointment or one booking request.
 *
 * It reuses the existing facade and stores (nothing is called that did not exist), and follows
 * « Mode discret » (initials, reason and phone digits hidden). No keyboard shortcut triggers any
 * action here. « Déplacer », « Message » and « Marquer absent » are deliberately not rendered:
 * the back end does not offer them yet.
 */
@Component({
  selector: 'app-calendar-detail-panel',
  imports: [NzDrawerModule, OcAvatar, OcButton, RouterLink],
  template: `
    <nz-drawer
      [nzVisible]="open()"
      [nzTitle]="mode() === 'request' ? 'Détails de la demande' : 'Détails du rendez-vous'"
      nzPlacement="right"
      [nzWidth]="'min(390px, 100vw)'"
      [nzClosable]="true"
      [nzMaskClosable]="!busy()"
      [nzKeyboard]="!busy()"
      [nzFooter]="footer"
      nzWrapClassName="omnicare-calendar cal-panel-wrap"
      (nzOnClose)="close()"
    >
      <ng-container *nzDrawerContent>
        @if (mode() === 'request') {
          @if (care.requestLoading()) {
            <p class="cal-panel__state" role="status">Chargement de la demande…</p>
          } @else if (care.requestError(); as error) {
            <p class="cal-panel__error" role="alert">{{ error }}</p>
          } @else if (care.activeRequest(); as request) {
            <div class="cal-panel">
              <header class="cal-panel__hero">
                <oc-avatar [name]="shownName()" size="large" />
                <div class="cal-panel__identity">
                  <p class="cal-panel__name">{{ shownName() }}</p>
                  <p class="cal-panel__meta">
                    {{ request.subject.relationship || (request.subject.subjectType === 'SELF' ? 'Patient' : 'Proche') }}
                  </p>
                </div>
                <span class="cal-panel__chip" [class]="state().cssClass">{{ state().labelFr }}</span>
              </header>

              <dl class="cal-panel__grid">
                <div class="cal-panel__wide">
                  <dt>Horaire demandé</dt>
                  <dd>{{ range(request.originalRequestedSlot.start, request.originalRequestedSlot.end, request.cabinet.timezone) }}</dd>
                </div>
                @if (request.proposedSlot; as proposal) {
                  <div class="cal-panel__wide">
                    <dt>Horaire proposé</dt>
                    <dd>{{ range(proposal.start, proposal.end, request.cabinet.timezone) }}</dd>
                  </div>
                }
                <div><dt>Cabinet</dt><dd>{{ request.cabinet.name }}</dd></div>
                <div>
                  <dt>Réponse avant le</dt>
                  <dd>{{ instant(request.responseDeadline, request.cabinet.timezone) }}</dd>
                </div>
              </dl>

              @if (showProposal() && request.availableActions.includes('PROPOSE_NEW_TIME')) {
                <section class="cal-panel__choice" aria-label="Proposer un autre horaire">
                  <div class="cal-panel__choice-head">
                    <strong>Horaires libres dans ce cabinet</strong>
                    <oc-button variant="quiet" size="small" (click)="care.loadProposalAvailability()">
                      Actualiser
                    </oc-button>
                  </div>
                  @if (care.availabilityLoading()) {
                    <p role="status">Chargement des horaires…</p>
                  } @else if (care.availabilityError(); as error) {
                    <p class="cal-panel__error" role="alert">{{ error }}</p>
                  } @else if (care.availability().length === 0) {
                    <p>Aucun horaire libre sur cette période.</p>
                  } @else {
                    <label>
                      <span class="cal-panel__label">Nouvel horaire</span>
                      <select [value]="selectedSlotKey()" (change)="selectedSlotKey.set($any($event.target).value)">
                        <option value="">Choisir un horaire</option>
                        @for (slot of care.availability(); track slot.start + slot.end) {
                          <option [value]="slot.start + '|' + slot.end">
                            {{ range(slot.start, slot.end, care.availabilityTimezone()) }}
                          </option>
                        }
                      </select>
                    </label>
                  }
                </section>
              }

              @if (showDecline() && request.availableActions.includes('DECLINE_REQUEST')) {
                <section class="cal-panel__choice" aria-label="Motif du refus">
                  <label>
                    <span class="cal-panel__label">Motif du refus (obligatoire)</span>
                    <select [value]="declineReason()" (change)="setDeclineReason($any($event.target).value)">
                      <option value="">Choisir un motif</option>
                      @for (reason of reasons; track reason.code) {
                        <option [value]="reason.code">{{ reason.label }}</option>
                      }
                    </select>
                  </label>
                  <p class="cal-panel__hint">Le patient sera prévenu du refus.</p>
                </section>
              }

              @if (care.commandError(); as error) {
                <p class="cal-panel__error" role="alert">{{ error }}</p>
              }
            </div>
          }
        } @else {
          @if (care.appointmentLoading()) {
            <p class="cal-panel__state" role="status">Chargement du rendez-vous…</p>
          } @else if (care.appointmentError(); as error) {
            <div>
              <p class="cal-panel__error" role="alert">{{ error }}</p>
              <oc-button variant="secondary" size="small" (click)="retryAppointment()">Réessayer</oc-button>
            </div>
          } @else if (care.activeAppointment(); as appointment) {
            <div class="cal-panel">
              <header class="cal-panel__hero">
                <oc-avatar [name]="shownName()" size="large" />
                <div class="cal-panel__identity">
                  <p class="cal-panel__name">{{ shownName() }}</p>
                  <p class="cal-panel__meta">
                    {{ appointment.subject.relationship && appointment.subject.relationship !== 'SELF' ? appointment.subject.relationship : 'Patient' }}
                  </p>
                </div>
                <span class="cal-panel__chip" [class]="state().cssClass">{{ state().labelFr }}</span>
              </header>

              <dl class="cal-panel__grid">
                <div class="cal-panel__wide">
                  <dt>Date et heure</dt>
                  <dd>
                    {{ range(appointment.slot.start, appointment.slot.end, appointment.slot.timezone) }}
                    · {{ appointment.slot.durationMinutes }} min
                  </dd>
                </div>
                <div class="cal-panel__wide"><dt>Cabinet</dt><dd>{{ appointment.cabinet.name }}</dd></div>
                <div class="cal-panel__wide">
                  <dt>Motif de consultation</dt>
                  <dd>
                    @if (discreet()) {
                      <span class="cal-panel__masked">Masqué (mode discret)</span>
                    } @else {
                      {{ appointment.consultationReason || 'Non renseigné' }}
                    }
                  </dd>
                </div>
                @if (phone(); as number) {
                  <div class="cal-panel__wide">
                    <dt>Téléphone</dt>
                    <dd>
                      @if (discreet()) {
                        <span class="cal-panel__masked">Masqué (mode discret)</span>
                      } @else {
                        {{ number }}
                      }
                    </dd>
                  </div>
                }
              </dl>

              @if (showCancel() && appointment.availableActions.includes('CANCEL_APPOINTMENT')) {
                <section class="cal-panel__choice" aria-label="Motif de l’annulation">
                  <label>
                    <span class="cal-panel__label">Motif de l’annulation (obligatoire)</span>
                    <select [value]="cancelReason()" (change)="setCancelReason($any($event.target).value)">
                      <option value="">Choisir un motif</option>
                      @for (reason of reasons; track reason.code) {
                        <option [value]="reason.code">{{ reason.label }}</option>
                      }
                    </select>
                  </label>
                </section>
              }

              @if (care.commandError(); as error) {
                <p class="cal-panel__error" role="alert">{{ error }}</p>
              }
              @if (consultations.startError(); as error) {
                <p class="cal-panel__error" role="alert">{{ error }}</p>
              } @else if (hasConflictingConsultation()) {
                <p class="cal-panel__error" role="alert">
                  Une autre consultation est déjà en cours. Ce rendez-vous n’a pas été démarré.
                </p>
              }
              @if (consultations.error(); as error) {
                <p class="cal-panel__error" role="alert">{{ error }}</p>
              }
            </div>
          } @else {
            <p class="cal-panel__state">Aucun rendez-vous à afficher.</p>
          }
        }
      </ng-container>
    </nz-drawer>

    <ng-template #footer>
      <div class="cal-panel__actions">
        @if (mode() === 'request') {
          @if (care.activeRequest(); as request) {
            @if (request.availableActions.includes('ACCEPT_REQUEST')) {
              <oc-button variant="primary" size="small" [loading]="care.commandLoading()" (click)="care.acceptRequest()">
                Accepter
              </oc-button>
            }
            @if (request.availableActions.includes('PROPOSE_NEW_TIME')) {
              @if (!showProposal()) {
                <oc-button variant="secondary" size="small" [disabled]="care.commandLoading()" (click)="openProposal()">
                  Proposer un autre horaire
                </oc-button>
              } @else {
                <oc-button variant="primary" size="small" [loading]="care.commandLoading()" [disabled]="selectedSlot() === null" (click)="submitProposal()">
                  Envoyer la proposition
                </oc-button>
              }
            }
            @if (request.availableActions.includes('DECLINE_REQUEST')) {
              @if (!showDecline()) {
                <oc-button variant="secondary" size="small" [disabled]="care.commandLoading()" (click)="openDecline()">
                  Refuser
                </oc-button>
              } @else {
                <oc-button variant="secondary" size="small" [loading]="care.commandLoading()" [disabled]="declineReason() === ''" (click)="submitDecline()">
                  Confirmer le refus
                </oc-button>
              }
            }
          }
        } @else if (care.activeAppointment(); as appointment) {
          @if (activeConsultationForAppointment(); as active) {
            <oc-button variant="primary" size="small" [disabled]="busy()" (click)="continueConsultation(active.consultationId)">
              Continuer ce rendez-vous
            </oc-button>
          } @else if (canStart()) {
            <oc-button variant="primary" size="small" [loading]="consultations.starting()" [disabled]="care.commandLoading()" (click)="startConsultation()">
              Démarrer la consultation
            </oc-button>
          }
          @if (appointment.practicePatient; as patient) {
            <a
              class="cal-panel__link-button"
              [routerLink]="['/doctor', 'patient', patient.practicePatientId]"
              (click)="beforeLeaving($event)"
            >
              Voir le dossier
            </a>
          }
          @if (telHref(); as href) {
            <a class="cal-panel__link-button" [href]="href">Appeler</a>
          }
          @if (appointment.availableActions.includes('CANCEL_APPOINTMENT')) {
            @if (!showCancel()) {
              <oc-button variant="secondary" size="small" [disabled]="care.commandLoading()" (click)="showCancel.set(true)">
                Annuler le rendez-vous
              </oc-button>
            } @else {
              <oc-button variant="secondary" size="small" [loading]="care.commandLoading()" [disabled]="cancelReason() === ''" (click)="submitCancel()">
                Confirmer l’annulation
              </oc-button>
            }
          }
        }
        <oc-button variant="secondary" size="small" [disabled]="busy()" (click)="close()">Fermer</oc-button>
      </div>
    </ng-template>
  `,
  styleUrl: './calendar-detail-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class CalendarDetailPanel {
  readonly care = inject(ScheduledCareFacade);
  readonly consultations = inject(ActiveConsultationStore);
  private readonly preferences = inject(CalendarPreferencesStore);
  private readonly router = inject(Router);

  readonly reasons = REASONS;
  readonly open = signal(false);
  readonly mode = signal<PanelMode>('appointment');
  readonly showCancel = signal(false);
  readonly cancelReason = signal<DoctorReasonCode | ''>('');
  readonly showProposal = signal(false);
  readonly showDecline = signal(false);
  readonly declineReason = signal<DoctorReasonCode | ''>('');
  readonly selectedSlotKey = signal('');
  private readonly overview = signal<DoctorScheduledCareItem | null>(null);
  private readonly appointmentId = signal<string | null>(null);

  readonly discreet = this.preferences.discreet;
  readonly busy = computed(() => this.care.commandLoading() || this.consultations.starting());

  /** Patient name as shown: full name, or initials in « Mode discret ». */
  readonly shownName = computed(() => {
    const name =
      this.mode() === 'request'
        ? this.care.activeRequest()?.subject.displayName
        : this.care.activeAppointment()?.subject.displayName;
    return patientLabel(name, this.discreet());
  });

  /** Calendar state (label and colours), the same mapping as the cards. */
  readonly state = computed(() => {
    const overview = this.overview();
    if (this.mode() === 'request') {
      const request = this.care.activeRequest();
      return presentCalendarItem({
        resourceType: 'BOOKING_REQUEST',
        status: request?.status ?? '',
        subject: { subjectType: request?.subject.subjectType ?? 'SELF' },
      } as unknown as DoctorScheduledCareItem);
    }
    const appointment = this.care.activeAppointment();
    return presentCalendarItem(
      {
        resourceType: 'APPOINTMENT',
        status: appointment?.status ?? '',
        end: appointment?.slot.end ?? '',
        subject: { subjectType: appointment?.subject.subjectType ?? 'SELF' },
      } as unknown as DoctorScheduledCareItem,
      // A confirmed appointment already over and never started reads « Non clôturé » (fix 5).
      { isFollowUp: overview !== null && isFollowUpItem(overview), nowMs: Date.now() },
    );
  });

  /** Phone number of the patient when the appointment carries one. */
  readonly phone = computed(() => {
    const value = this.care.activeAppointment()?.practicePatient?.phone?.trim();
    return value ? value : null;
  });

  /** `tel:` link, only when a usable number exists. The digits are never shown in « Mode discret ». */
  readonly telHref = computed(() => {
    const digits = this.phone()?.replace(/[^\d+]/g, '') ?? '';
    return /\d/.test(digits) ? `tel:${digits}` : null;
  });

  readonly selectedSlot = computed<AvailabilitySlot | null>(() => {
    const key = this.selectedSlotKey();
    return this.care.availability().find((slot) => `${slot.start}|${slot.end}` === key) ?? null;
  });

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
    return appointment !== null &&
      active?.sourceType === 'SCHEDULED_APPOINTMENT' &&
      active.sourceId === appointment.appointmentId
      ? active
      : null;
  });
  readonly hasConflictingConsultation = computed(
    () => this.consultations.active() !== null && this.activeConsultationForAppointment() === null,
  );

  /** Times are always shown in Tunis, whatever zone the backend snapshot or the browser reports. */
  readonly instant = (value: string, _zone?: string): string =>
    formatScheduledInstant(value, TUNIS_TIME_ZONE);
  readonly range = (start: string, end: string, _zone?: string): string =>
    formatScheduledRange(start, end, TUNIS_TIME_ZONE);

  constructor() {
    // A slot that disappears from the refreshed list can no longer be selected.
    effect(() => {
      const selected = this.selectedSlotKey();
      const slots = this.care.availability();
      if (selected && !slots.some((slot) => `${slot.start}|${slot.end}` === selected)) {
        this.selectedSlotKey.set('');
      }
    });
  }

  /** Opens an appointment (the clicked agenda item, or just its id from a deep link). */
  openWith(appointment: DoctorScheduledCareItem | string): void {
    const id = typeof appointment === 'string' ? appointment : appointment.appointmentId;
    if (id === null) return;
    this.resetChoices();
    this.mode.set('appointment');
    this.consultations.clearStartError();
    this.overview.set(typeof appointment === 'string' ? null : appointment);
    this.appointmentId.set(id);
    this.open.set(true);
    this.care.openAppointment(id, typeof appointment === 'string' ? null : appointment);
  }

  /** Opens a booking request. */
  openRequest(request: DoctorScheduledCareItem | string): void {
    const id = typeof request === 'string' ? request : request.requestId;
    if (id === null) return;
    this.resetChoices();
    this.mode.set('request');
    this.overview.set(null);
    this.open.set(true);
    this.care.openRequest(id);
  }

  close(): void {
    if (this.busy()) return;
    this.open.set(false);
    if (this.mode() === 'request') this.care.closeRequest();
    else this.care.closeAppointment();
  }

  retryAppointment(): void {
    const id = this.appointmentId();
    if (id) this.care.openAppointment(id);
  }

  setCancelReason(value: string): void {
    this.cancelReason.set(asReason(value));
  }

  submitCancel(): void {
    const reason = this.cancelReason();
    if (reason) this.care.cancelAppointment(reason);
  }

  openProposal(): void {
    this.showDecline.set(false);
    this.showProposal.set(true);
    this.care.loadProposalAvailability();
  }

  submitProposal(): void {
    const slot = this.selectedSlot();
    if (slot) this.care.proposeTime(slot);
  }

  openDecline(): void {
    this.showProposal.set(false);
    this.showDecline.set(true);
  }

  setDeclineReason(value: string): void {
    this.declineReason.set(asReason(value));
  }

  /** « Refuser » is confirmed in two steps and always needs a reason. */
  submitDecline(): void {
    const reason = this.declineReason();
    if (reason) this.care.declineRequest(reason);
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

  /** Leaves the panel when the record link is followed (not while a command is running). */
  beforeLeaving(event: MouseEvent): void {
    if (this.busy()) {
      event.preventDefault();
      return;
    }
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    this.open.set(false);
    this.care.closeAppointment();
  }

  private resetChoices(): void {
    this.showCancel.set(false);
    this.cancelReason.set('');
    this.showProposal.set(false);
    this.showDecline.set(false);
    this.declineReason.set('');
    this.selectedSlotKey.set('');
  }
}

function asReason(value: string): DoctorReasonCode | '' {
  return value === 'CABINET_UNAVAILABLE' ||
    value === 'DOCTOR_UNAVAILABLE' ||
    value === 'SCHEDULE_CONFLICT'
    ? value
    : '';
}
