import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';

import {
  OcButton,
  OcCard,
  OcAvatar,
  OcEmptyState,
  OcStatusBadge,
  OcPageHeader,
} from '../../../shared/ui';
import { BookingRequestDetailPanel } from '../scheduled-care/booking-request-detail-panel';
import { ScheduledCareApiService } from '../scheduled-care/scheduled-care-api.service';
import { ScheduledCareFacade } from '../scheduled-care/scheduled-care.facade';
import type { DoctorScheduledCareItem } from '../scheduled-care/scheduled-care.models';
import { formatScheduledInstant } from '../scheduled-care/scheduled-care-time';

@Component({
  selector: 'app-requests-page',
  imports: [
    OcPageHeader,
    OcButton,
    OcAvatar,
    OcCard,
    OcEmptyState,
    OcStatusBadge,
    BookingRequestDetailPanel,
  ],
  templateUrl: './requests-page.html',
  styleUrl: './requests-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestsPage {
  private readonly route = inject(ActivatedRoute, { optional: true });
  private readonly scheduledCareApi = inject(ScheduledCareApiService);
  private readonly scheduledCare = inject(ScheduledCareFacade);
  private readonly destroyRef = inject(DestroyRef);

  readonly requestPanel = viewChild.required<BookingRequestDetailPanel>('requestPanel');

  readonly appointmentRequests = signal<readonly DoctorScheduledCareItem[]>([]);
  readonly appointmentsLoading = signal(false);
  readonly appointmentsError = signal<string | null>(null);

  readonly pendingAppointments = computed(
    () => this.appointmentRequests().filter((r) => r.status === 'PENDING_DOCTOR').length,
  );

  constructor() {
    this.loadAppointments();
    let observedProjectionEpoch = this.scheduledCare.projectionInvalidationEpoch();
    effect(() => {
      const epoch = this.scheduledCare.projectionInvalidationEpoch();
      if (epoch === observedProjectionEpoch) return;
      observedProjectionEpoch = epoch;
      this.loadAppointments(true);
    });
    afterNextRender(() => {
      const requestId = this.route?.snapshot.queryParamMap.get('requestId');
      if (requestId) this.requestPanel().openWith(requestId);
    });
  }

  openRequestDetail(request: DoctorScheduledCareItem): void {
    if (request.requestId) this.requestPanel().openWith(request.requestId);
  }

  loadAppointments(silent = false): void {
    if (!silent) this.appointmentsLoading.set(true);
    this.appointmentsError.set(null);
    const today = new Date();
    const from = new Date(today);
    from.setDate(from.getDate() - 1);
    const to = new Date(today);
    to.setDate(to.getDate() + 60);
    const fromStr = from.toISOString();
    const toStr = to.toISOString();

    this.scheduledCareApi
      .getDoctorScheduledCare(fromStr, toStr)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (agenda) => {
          this.appointmentRequests.set(
            agenda.items.filter((item) => item.resourceType === 'BOOKING_REQUEST'),
          );
          this.appointmentsLoading.set(false);
        },
        error: () => {
          this.appointmentsLoading.set(false);
          this.appointmentsError.set('Impossible de charger les demandes de rendez-vous.');
        },
      });
  }

  retryAppointments(): void {
    this.loadAppointments();
  }

  appointmentStatusLabel(status: string): string {
    switch (status) {
      case 'PENDING_DOCTOR':
        return 'Réponse attendue';
      case 'PENDING_PATIENT_TIME_CONFIRMATION':
        return 'Réponse patient attendue';
      case 'FULFILLED':
        return 'Confirmée';
      case 'CANCELLED_BY_PATIENT':
        return 'Annulée par le patient';
      case 'CANCELLED_BY_DOCTOR':
        return 'Refusée';
      case 'EXPIRED':
        return 'Expirée';
      default:
        return status;
    }
  }

  appointmentStatusOc(status: string): 'pending' | 'confirmed' | 'cancelled' | 'expired' {
    switch (status) {
      case 'FULFILLED':
        return 'confirmed';
      case 'EXPIRED':
        return 'expired';
      case 'CANCELLED_BY_PATIENT':
      case 'CANCELLED_BY_DOCTOR':
        return 'cancelled';
      default:
        return 'pending';
    }
  }

  trackByAppointmentId(_index: number, request: DoctorScheduledCareItem): string {
    return request.requestId ?? `${request.resourceType}:${request.sortAt}`;
  }

  scheduledTime(request: DoctorScheduledCareItem): string {
    return formatScheduledInstant(request.start, request.timezone, { year: undefined });
  }
}
