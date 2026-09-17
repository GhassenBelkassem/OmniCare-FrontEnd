import { ChangeDetectionStrategy, Component, inject, input, output, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { OcAvatar, OcButton } from '../../../shared/ui';
import { OcDetailPanel } from '../../../shared/ui';
import { ApiErrorBody } from '../../../core/auth/auth.models';
import { UrgentOfferDto } from '../appointment-api.models';
import { DoctorUrgentApiService } from '../doctor-urgent-api.service';

@Component({
  selector: 'app-urgent-request-detail-panel',
  imports: [OcDetailPanel, OcAvatar, OcButton],
  template: `
    <oc-detail-panel
      [open]="open()"
      title="Demande urgente"
      (closed)="open.set(false)"
    >
      <div class="urgent-detail">
        <div class="urgent-detail__patient">
          <oc-avatar [name]="offer()?.patientName ?? ''" size="large" />
          <div>
            <p class="urgent-detail__name">{{ offer()?.patientName }}</p>
            <p class="urgent-detail__status">{{ statusLabel() }}</p>
          </div>
        </div>

        <div class="urgent-detail__grid">
          @if (offer()?.notes; as notes) {
            <div class="urgent-detail__field urgent-detail__field--full">
              <span class="urgent-detail__label">Motif</span>
              <p class="urgent-detail__value">{{ notes }}</p>
            </div>
          }
          <div class="urgent-detail__field">
            <span class="urgent-detail__label">Envoyee le</span>
            <span class="urgent-detail__value">{{ offer()?.sentAt }}</span>
          </div>
          <div class="urgent-detail__field">
            <span class="urgent-detail__label">Preference</span>
            <span class="urgent-detail__value">{{ visitLabel() }}</span>
          </div>
        </div>

        @if (arrived()) {
          <div class="urgent-detail__arrived-banner">
            <span class="urgent-detail__arrived-icon" aria-hidden="true"></span>
            <span>Arrivee confirmeee — Vous pouvez demarrer la consultation.</span>
          </div>
        }
        @if (actionError(); as error) {
          <p class="urgent-detail__error" role="alert">{{ error }}</p>
        }
      </div>

      <div ocDetailActions>
        @if (localStatus() === 'PENDING') {
          <oc-button variant="primary" size="small" [loading]="actionLoading()" (click)="onAccept()">
            Disponible
          </oc-button>
          <oc-button variant="secondary" size="small" [loading]="actionLoading()" (click)="onDecline()">
            Refuser
          </oc-button>
        }
        @if (localStatus() === 'ACCEPTED' && !arrived()) {
          @if (offer()?.requestStatus === 'MATCHED') {
            @if (showDirections()) {
              <oc-button
                variant="secondary"
                size="small"
                leadingIcon="environment"
                (click)="openDirections()"
              >
                Itineraire
              </oc-button>
            }
            <oc-button
              variant="primary"
              size="small"
              leadingIcon="check-circle"
              [loading]="arriving()"
              (click)="onArrive()"
            >
              Marquer arrivee
            </oc-button>
          } @else {
            <span class="urgent-detail__waiting" role="status">
              En attente du choix du patient
            </span>
          }
        }
        @if (arrived()) {
          <oc-button variant="primary" size="small" (click)="startConsultation()">
            Demarrer la consultation
          </oc-button>
        }
      </div>
    </oc-detail-panel>
  `,
  styleUrl: './urgent-request-detail-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UrgentRequestDetailPanel {
  private readonly router = inject(Router);
  private readonly urgentApi = inject(DoctorUrgentApiService);

  readonly open = signal(false);
  readonly offer = signal<UrgentOfferDto | null>(null);
  readonly localStatus = signal<'PENDING' | 'ACCEPTED' | 'DECLINED' | 'ARRIVED'>('PENDING');
  readonly arrived = signal(false);
  readonly actionLoading = signal(false);
  readonly arriving = signal(false);
  readonly actionError = signal<string | null>(null);

  readonly accepted = output<UrgentOfferDto>();
  readonly declined = output<UrgentOfferDto>();
  readonly arrivedEvent = output<UrgentOfferDto>();

  readonly statusLabel = computed(() => {
    switch (this.localStatus()) {
      case 'PENDING': return 'En attente de reponse';
      case 'ACCEPTED': return this.arrived() ? 'Arrive — Pret pour consultation' : 'Acceptee — En route';
      case 'DECLINED': return 'Refusee';
      case 'ARRIVED': return 'Arrivee confirmeee';
      default: return '';
    }
  });

  readonly showDirections = computed(() => {
    const pref = this.offer()?.visitPreference;
    return pref === 'HOME_VISIT' || pref === 'EITHER';
  });

  readonly visitLabel = computed(() => {
    const pref = this.offer()?.visitPreference;
    if (pref === 'HOME_VISIT') return 'A domicile';
    if (pref === 'CABINET_VISIT') return 'Au cabinet';
    if (pref === 'EITHER') return 'Domicile ou cabinet';
    return 'Non precise';
  });

  openWith(offer: UrgentOfferDto): void {
    this.offer.set(offer);
    this.localStatus.set(offer.status === 'ACCEPTED' ? 'ACCEPTED' : offer.status === 'DECLINED' ? 'DECLINED' : 'PENDING');
    this.arrived.set(false);
    this.actionError.set(null);
    this.open.set(true);
  }

  onAccept(): void {
    const o = this.offer();
    if (!o) return;
    this.actionLoading.set(true);
    this.actionError.set(null);
    this.urgentApi.accept(o.offerId).subscribe({
      next: () => {
        this.localStatus.set('ACCEPTED');
        this.actionLoading.set(false);
        this.accepted.emit(o);
      },
      error: (error) => {
        this.actionLoading.set(false);
        this.actionError.set(messageFrom(error, "Impossible d'accepter l'offre."));
      },
    });
  }

  onDecline(): void {
    const o = this.offer();
    if (!o) return;
    this.actionLoading.set(true);
    this.actionError.set(null);
    this.urgentApi.decline(o.offerId).subscribe({
      next: () => {
        this.localStatus.set('DECLINED');
        this.actionLoading.set(false);
        this.declined.emit(o);
      },
      error: (error) => {
        this.actionLoading.set(false);
        this.actionError.set(messageFrom(error, 'Impossible de refuser la demande.'));
      },
    });
  }

  onArrive(): void {
    const o = this.offer();
    if (!o) return;
    this.arriving.set(true);
    this.actionError.set(null);
    this.urgentApi.arrive(o.requestId).subscribe({
      next: () => {
        this.arrived.set(true);
        this.arriving.set(false);
        this.arrivedEvent.emit(o);
      },
      error: (error) => {
        this.arriving.set(false);
        this.actionError.set(
          messageFrom(error, "Impossible de signaler l'arrivee. La demande n'est peut-etre pas encore confirmee par le patient."),
        );
      },
    });
  }

  startConsultation(): void {
    void this.router.navigate(['/doctor', 'consultation', 'new'], {
      queryParams: { source: 'urgent' },
    });
    this.open.set(false);
  }

  openDirections(): void {
    const o = this.offer();
    if (!o) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${o.patientLatitude},${o.patientLongitude}`;
    window.open(url, '_blank', 'noopener');
  }
}

function messageFrom(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse) {
    const body = error.error as ApiErrorBody | null;
    return body?.message ?? fallback;
  }
  return fallback;
}
