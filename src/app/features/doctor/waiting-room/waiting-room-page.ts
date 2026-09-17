import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit, OnDestroy } from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  OcPageHeader,
  OcCard,
  OcButton,
  OcStatusBadge,
  OcAvatar,
  OcEmptyState,
  OcMetricCard,
} from '../../../shared/ui';

type PatientStatus = 'waiting' | 'arrived' | 'in_consultation' | 'no_show';

interface WaitingPatient {
  id: string;
  name: string;
  initials: string;
  appointmentTime: string;
  waitMinutes: number;
  status: PatientStatus;
  appointmentType: string;
}

@Component({
  selector: 'oc-waiting-room-page',
  imports: [
    DatePipe,
    OcPageHeader,
    OcCard,
    OcButton,
    OcStatusBadge,
    OcAvatar,
    OcEmptyState,
    OcMetricCard,
  ],
  templateUrl: './waiting-room-page.html',
  styleUrl: './waiting-room-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WaitingRoomPage implements OnInit, OnDestroy {
  private refreshInterval: ReturnType<typeof setInterval> | null = null;

  autoRefreshActive = signal(true);
  lastRefresh = signal(new Date());
  refreshCountdown = signal(30);

  patients = signal<WaitingPatient[]>([
    { id: '1', name: 'Marie Dupont', initials: 'MD', appointmentTime: '08:00', waitMinutes: 45, status: 'waiting', appointmentType: 'Cabinet' },
    { id: '2', name: 'Jean Martin', initials: 'JM', appointmentTime: '08:30', waitMinutes: 30, status: 'waiting', appointmentType: 'Urgent' },
    { id: '3', name: 'Sophie Leroy', initials: 'SL', appointmentTime: '09:00', waitMinutes: 15, status: 'arrived', appointmentType: 'Suivi' },
    { id: '4', name: 'Pierre Moreau', initials: 'PM', appointmentTime: '09:30', waitMinutes: 0, status: 'in_consultation', appointmentType: 'Cabinet' },
    { id: '5', name: 'Claire Bernard', initials: 'CB', appointmentTime: '09:45', waitMinutes: 0, status: 'in_consultation', appointmentType: 'Urgent' },
    { id: '6', name: 'Lucas Petit', initials: 'LP', appointmentTime: '10:00', waitMinutes: 5, status: 'arrived', appointmentType: 'Cabinet' },
    { id: '7', name: 'Emma Richard', initials: 'ER', appointmentTime: '10:15', waitMinutes: 60, status: 'no_show', appointmentType: 'Suivi' },
    { id: '8', name: 'Hugo Durand', initials: 'HD', appointmentTime: '10:30', waitMinutes: 0, status: 'waiting', appointmentType: 'Cabinet' },
    { id: '9', name: 'Léa Garcia', initials: 'LG', appointmentTime: '10:45', waitMinutes: 0, status: 'waiting', appointmentType: 'Urgent' },
  ]);

  waitingPatients = computed(() =>
    this.patients().filter((p) => p.status === 'waiting')
  );

  arrivedPatients = computed(() =>
    this.patients().filter((p) => p.status === 'arrived')
  );

  consultationPatients = computed(() =>
    this.patients().filter((p) => p.status === 'in_consultation')
  );

  noShowPatients = computed(() =>
    this.patients().filter((p) => p.status === 'no_show')
  );

  totalWaiting = computed(() =>
    this.patients().filter((p) => p.status === 'waiting' || p.status === 'arrived').length
  );

  avgWaitTime = computed(() => {
    const active = this.patients().filter((p) => p.status !== 'no_show');
    if (active.length === 0) return 0;
    return Math.round(active.reduce((sum, p) => sum + p.waitMinutes, 0) / active.length);
  });

  longestWait = computed(() => {
    const active = this.patients().filter((p) => p.status !== 'no_show');
    if (active.length === 0) return 0;
    return Math.max(...active.map((p) => p.waitMinutes));
  });

  ngOnInit(): void {
    this.startAutoRefresh();
  }

  ngOnDestroy(): void {
    this.stopAutoRefresh();
  }

  checkIn(patientId: string): void {
    this.patients.update((patients) =>
      patients.map((p) => (p.id === patientId ? { ...p, status: 'arrived' as PatientStatus } : p))
    );
  }

  startConsultation(patientId: string): void {
    this.patients.update((patients) =>
      patients.map((p) => (p.id === patientId ? { ...p, status: 'in_consultation' as PatientStatus } : p))
    );
  }

  markNoShow(patientId: string): void {
    this.patients.update((patients) =>
      patients.map((p) => (p.id === patientId ? { ...p, status: 'no_show' as PatientStatus } : p))
    );
  }

  getWaitClass(minutes: number): string {
    if (minutes >= 45) return 'waiting-room-page__wait--critical';
    if (minutes >= 20) return 'waiting-room-page__wait--warning';
    return 'waiting-room-page__wait--ok';
  }

  private startAutoRefresh(): void {
    this.refreshInterval = setInterval(() => {
      this.refreshCountdown.update((c) => {
        if (c <= 1) {
          this.lastRefresh.set(new Date());
          return 30;
        }
        return c - 1;
      });
    }, 1000);
  }

  private stopAutoRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }
}
