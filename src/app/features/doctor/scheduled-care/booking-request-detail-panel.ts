import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { NzModalModule } from 'ng-zorro-antd/modal';

import { OcAvatar, OcButton, OcStatusBadge } from '../../../shared/ui';
import type { AvailabilitySlot, DoctorReasonCode } from './scheduled-care.models';
import { ScheduledCareFacade } from './scheduled-care.facade';
import { formatScheduledInstant, formatScheduledRange } from './scheduled-care-time';

@Component({
  selector: 'app-booking-request-detail-panel',
  imports: [NzModalModule, OcAvatar, OcButton, OcStatusBadge],
  template: `
    <nz-modal
      [nzVisible]="open()"
      nzTitle="Détails de la demande"
      [nzClosable]="true"
      [nzMaskClosable]="!care.commandLoading()"
      [nzKeyboard]="!care.commandLoading()"
      [nzWidth]="520"
      (nzOnCancel)="close()"
    >
      <ng-template nzModalContent>
        @if (care.requestLoading()) {
          <div class="scheduled-detail__state" role="status">Chargement de la demande…</div>
        } @else if (care.requestError(); as error) {
          <div class="scheduled-detail__error" role="alert">{{ error }}</div>
        } @else if (care.activeRequest(); as request) {
          <div class="scheduled-detail">
            <div class="scheduled-detail__subject">
              <oc-avatar [name]="request.subject.displayName" size="large" />
              <div>
                <p class="scheduled-detail__name">{{ request.subject.displayName }}</p>
                <p class="scheduled-detail__secondary">
                  {{ request.subject.relationship || subjectLabel(request.subject.subjectType) }}
                </p>
              </div>
              <oc-status-badge [status]="statusBadge()" [customLabel]="statusLabel()" />
            </div>

            <dl class="scheduled-detail__grid">
              <div><dt>Demande</dt><dd>{{ request.requestId }}</dd></div>
              <div><dt>Version</dt><dd>{{ request.version }}</dd></div>
              <div><dt>Cabinet</dt><dd>{{ request.cabinet.name }}</dd></div>
              <div><dt>Adresse</dt><dd>{{ cabinetAddress() }}</dd></div>
              <div class="scheduled-detail__wide">
                <dt>Créneau demandé</dt>
                <dd>{{ formatRange(request.originalRequestedSlot.start, request.originalRequestedSlot.end, request.cabinet.timezone) }}</dd>
              </div>
              @if (request.proposedSlot; as proposal) {
                <div class="scheduled-detail__wide">
                  <dt>Créneau proposé</dt>
                  <dd>{{ formatRange(proposal.start, proposal.end, request.cabinet.timezone) }}</dd>
                </div>
              }
              <div class="scheduled-detail__wide">
                <dt>Créneau actif</dt>
                <dd>{{ formatRange(request.activeSlot.start, request.activeSlot.end, request.cabinet.timezone) }}</dd>
              </div>
              <div><dt>Réponse avant</dt><dd>{{ formatInstant(request.responseDeadline, request.cabinet.timezone) }}</dd></div>
              @if (request.patientResponseDeadline; as deadline) {
                <div><dt>Réponse patient avant</dt><dd>{{ formatInstant(deadline, request.cabinet.timezone) }}</dd></div>
              }
              @if (request.confirmedAppointmentId; as appointmentId) {
                <div class="scheduled-detail__wide"><dt>Rendez-vous confirmé</dt><dd>{{ appointmentId }}</dd></div>
              }
              @if (request.cancellation; as cancellation) {
                <div><dt>Annulée par</dt><dd>{{ cancellation.actor }}</dd></div>
                <div><dt>Motif</dt><dd>{{ reasonLabel(cancellation.reasonCode) }}</dd></div>
              }
              @if (request.expiredAt; as expiredAt) {
                <div><dt>Expirée le</dt><dd>{{ formatInstant(expiredAt, request.cabinet.timezone) }}</dd></div>
                <div><dt>Motif</dt><dd>{{ request.expiryReason || 'Délai dépassé' }}</dd></div>
              }
              @if (request.slotReleased) {
                <div class="scheduled-detail__wide"><dt>Réservation du créneau</dt><dd>Libérée</dd></div>
              }
            </dl>

            @if (showProposal() && request.availableActions.includes('PROPOSE_NEW_TIME')) {
              <section class="scheduled-detail__choice" aria-label="Proposer un créneau">
                <div class="scheduled-detail__choice-heading">
                  <strong>Créneau disponible dans ce cabinet</strong>
                  <oc-button variant="quiet" size="small" (click)="refreshSlots()">Actualiser</oc-button>
                </div>
                @if (care.availabilityLoading()) {
                  <p role="status">Chargement des créneaux…</p>
                } @else if (care.availabilityError(); as error) {
                  <p class="scheduled-detail__error" role="alert">{{ error }}</p>
                } @else {
                  <label>
                    <span class="scheduled-detail__label">Nouveau créneau</span>
                    <select [value]="selectedSlotKey()" (change)="selectSlot($any($event.target).value)">
                      <option value="">Sélectionner un créneau</option>
                      @for (slot of care.availability(); track slot.start + slot.end) {
                        <option [value]="slot.start + '|' + slot.end">
                          {{ formatRange(slot.start, slot.end, care.availabilityTimezone()) }}
                        </option>
                      }
                    </select>
                  </label>
                  @if (care.availability().length === 0) {
                    <p>Aucun créneau disponible sur cette période.</p>
                  }
                }
              </section>
            }

            @if (showDecline() && request.availableActions.includes('DECLINE_REQUEST')) {
              <section class="scheduled-detail__choice" aria-label="Motif de refus">
                <label>
                  <span class="scheduled-detail__label">Motif obligatoire</span>
                  <select [value]="declineReason()" (change)="setDeclineReason($any($event.target).value)">
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
          </div>
        }
      </ng-template>
      <ng-template nzModalFooter>
        @if (care.activeRequest(); as request) {
          @if (request.availableActions.includes('ACCEPT_REQUEST')) {
            <oc-button variant="primary" size="small" [loading]="care.commandLoading()" (click)="care.acceptRequest()">
              Accepter
            </oc-button>
          }
          @if (request.availableActions.includes('PROPOSE_NEW_TIME')) {
            @if (!showProposal()) {
              <oc-button variant="secondary" size="small" [disabled]="care.commandLoading()" (click)="openProposal()">
                Proposer un autre créneau
              </oc-button>
            } @else {
              <oc-button variant="primary" size="small" [loading]="care.commandLoading()" [disabled]="selectedSlot() === null" (click)="submitProposal()">
                Envoyer la proposition
              </oc-button>
            }
          }
          @if (request.availableActions.includes('DECLINE_REQUEST')) {
            @if (!showDecline()) {
              <oc-button variant="secondary" size="small" [disabled]="care.commandLoading()" (click)="showDecline.set(true)">
                Refuser
              </oc-button>
            } @else {
              <oc-button variant="secondary" size="small" [loading]="care.commandLoading()" [disabled]="declineReason() === ''" (click)="submitDecline()">
                Confirmer le refus
              </oc-button>
            }
          }
        }
        <oc-button variant="secondary" size="small" [disabled]="care.commandLoading()" (click)="close()">Fermer</oc-button>
      </ng-template>
    </nz-modal>
  `,
  styleUrl: './scheduled-care-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookingRequestDetailPanel {
  readonly care = inject(ScheduledCareFacade);
  readonly open = signal(false);
  readonly showProposal = signal(false);
  readonly showDecline = signal(false);
  readonly selectedSlotKey = signal('');
  readonly declineReason = signal<DoctorReasonCode | ''>('');
  readonly reasons: readonly { code: DoctorReasonCode; label: string }[] = [
    { code: 'CABINET_UNAVAILABLE', label: 'Cabinet indisponible' },
    { code: 'DOCTOR_UNAVAILABLE', label: 'Médecin indisponible' },
    { code: 'SCHEDULE_CONFLICT', label: 'Conflit d’agenda' },
  ];

  readonly selectedSlot = computed<AvailabilitySlot | null>(() => {
    const key = this.selectedSlotKey();
    return this.care.availability().find((slot) => `${slot.start}|${slot.end}` === key) ?? null;
  });
  readonly statusLabel = computed(() => requestStatusLabel(this.care.activeRequest()?.status));
  readonly statusBadge = computed<'pending' | 'confirmed' | 'cancelled' | 'expired'>(() => {
    const status = this.care.activeRequest()?.status;
    if (status === 'FULFILLED') return 'confirmed';
    if (status === 'EXPIRED') return 'expired';
    if (status?.startsWith('CANCELLED')) return 'cancelled';
    return 'pending';
  });
  readonly cabinetAddress = computed(() => {
    const cabinet = this.care.activeRequest()?.cabinet;
    return cabinet ? [cabinet.address, cabinet.city, cabinet.governorate].filter(Boolean).join(', ') : '—';
  });

  constructor() {
    effect(() => {
      const selected = this.selectedSlotKey();
      const slots = this.care.availability();
      if (selected && !slots.some((slot) => `${slot.start}|${slot.end}` === selected)) {
        this.selectedSlotKey.set('');
      }
    });
  }

  openWith(requestId: string): void {
    this.showProposal.set(false);
    this.showDecline.set(false);
    this.selectedSlotKey.set('');
    this.declineReason.set('');
    this.open.set(true);
    this.care.openRequest(requestId);
  }

  close(): void {
    if (this.care.commandLoading()) return;
    this.open.set(false);
    this.care.closeRequest();
  }

  openProposal(): void {
    this.showDecline.set(false);
    this.showProposal.set(true);
    this.care.loadProposalAvailability();
  }

  refreshSlots(): void {
    this.care.loadProposalAvailability();
  }

  selectSlot(value: string): void {
    this.selectedSlotKey.set(value);
  }

  setDeclineReason(value: string): void {
    this.declineReason.set(isDoctorReason(value) ? value : '');
  }

  submitProposal(): void {
    const slot = this.selectedSlot();
    if (slot) this.care.proposeTime(slot);
  }

  submitDecline(): void {
    const reason = this.declineReason();
    if (reason) this.care.declineRequest(reason);
  }

  formatInstant = formatScheduledInstant;
  formatRange = formatScheduledRange;
  subjectLabel(subjectType: string): string {
    return subjectType === 'SELF' ? 'Patient' : 'Proche';
  }
  reasonLabel(code: string): string {
    return this.reasons.find((reason) => reason.code === code)?.label ?? code;
  }
}

function requestStatusLabel(status: string | undefined): string {
  switch (status) {
    case 'PENDING_DOCTOR': return 'Réponse attendue';
    case 'PENDING_PATIENT_TIME_CONFIRMATION': return 'Réponse patient attendue';
    case 'FULFILLED': return 'Rendez-vous confirmé';
    case 'CANCELLED_BY_PATIENT': return 'Annulée par le patient';
    case 'CANCELLED_BY_DOCTOR': return 'Refusée';
    case 'EXPIRED': return 'Expirée';
    default: return status ?? '';
  }
}

function isDoctorReason(value: string): value is DoctorReasonCode {
  return value === 'CABINET_UNAVAILABLE' || value === 'DOCTOR_UNAVAILABLE' || value === 'SCHEDULE_CONFLICT';
}
