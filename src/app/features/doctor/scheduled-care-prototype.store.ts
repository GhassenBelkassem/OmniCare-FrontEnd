import { Injectable, computed, signal } from '@angular/core';

import {
  AppointmentPrototype,
  BookingRequestPrototype,
  CabinetPrototype,
  ScheduledCareRecordPrototype,
  SlotPrototype,
  activeSlot,
} from './scheduled-care-prototype.models';

const HOUR_MS = 60 * 60 * 1000;

export function slotsOverlapInCabinet(left: SlotPrototype, right: SlotPrototype): boolean {
  return (
    left.cabinetId === right.cabinetId &&
    new Date(left.start).getTime() < new Date(right.end).getTime() &&
    new Date(right.start).getTime() < new Date(left.end).getTime()
  );
}

function futureLocal(days: number, hour: number, minute = 0): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, minute, 0, 0);
  return date;
}

function slot(
  id: string,
  cabinetId: string,
  days: number,
  hour: number,
  duration: number,
): SlotPrototype {
  const start = futureLocal(days, hour);
  return {
    id,
    cabinetId,
    start: start.toISOString(),
    end: new Date(start.getTime() + duration * 60_000).toISOString(),
  };
}

function doctorDeadline(createdAt: Date, requestedStart: Date): string {
  return new Date(
    Math.min(createdAt.getTime() + 24 * HOUR_MS, requestedStart.getTime() - 4 * HOUR_MS),
  ).toISOString();
}

const CABINETS: readonly CabinetPrototype[] = [
  {
    id: 'cabinet-lac-2',
    name: 'Cabinet Lac 2',
    address: 'Rue du Lac de Constance, Les Berges du Lac 2',
    city: 'Tunis',
  },
  {
    id: 'cabinet-ariana',
    name: 'Cabinet Ariana',
    address: '18 avenue Hédi Nouira',
    city: 'Ariana',
  },
];

function initialRecords(): readonly ScheduledCareRecordPrototype[] {
  const now = new Date();
  const requestedOne = slot('slot-request-mariem', CABINETS[0].id, 2, 9, 30);
  const requestedTwo = slot('slot-request-sami', CABINETS[1].id, 3, 15, 20);
  const proposedTwo = slot('slot-proposed-sami', CABINETS[1].id, 3, 16, 20);
  const confirmed = slot('slot-confirmed-ahmed', CABINETS[0].id, 1, 10, 30);
  const createdOne = new Date(now.getTime() - 35 * 60_000);
  const createdTwo = new Date(now.getTime() - 80 * 60_000);

  const pendingDoctor: BookingRequestPrototype = {
    kind: 'BOOKING_REQUEST',
    id: 'scheduled-request-mariem',
    patient: {
      type: 'FAMILY_MEMBER',
      familyMemberId: 'prototype-family-mariem',
      displayName: 'Mariem Ben Amor',
      relationshipLabel: 'Enfant',
    },
    doctorName: 'Dr Amine Ben Salah',
    doctorSpecialty: 'Médecine générale',
    cabinet: CABINETS[0],
    requestedSlot: requestedOne,
    proposedSlot: null,
    status: 'PENDING_DOCTOR',
    createdAt: createdOne.toISOString(),
    responseDeadline: doctorDeadline(createdOne, new Date(requestedOne.start)),
    patientResponseDeadline: null,
    cancelledAt: null,
    cancellationReason: null,
    lateCancellation: false,
    intake: {
      status: 'NOT_SUBMITTED',
      bodyAreas: [],
      description: null,
      painIntensity: null,
      submittedAt: null,
    },
  };

  const pendingPatient: BookingRequestPrototype = {
    kind: 'BOOKING_REQUEST',
    id: 'scheduled-request-sami',
    patient: {
      type: 'SELF',
      familyMemberId: null,
      displayName: 'Sami Trabelsi',
      relationshipLabel: 'Lui-même',
    },
    doctorName: 'Dr Amine Ben Salah',
    doctorSpecialty: 'Médecine générale',
    cabinet: CABINETS[1],
    requestedSlot: requestedTwo,
    proposedSlot: proposedTwo,
    status: 'PENDING_PATIENT_TIME_CONFIRMATION',
    createdAt: createdTwo.toISOString(),
    responseDeadline: doctorDeadline(createdTwo, new Date(requestedTwo.start)),
    patientResponseDeadline: new Date(now.getTime() + 6 * HOUR_MS).toISOString(),
    cancelledAt: null,
    cancellationReason: null,
    lateCancellation: false,
    intake: {
      status: 'NOT_SUBMITTED',
      bodyAreas: [],
      description: null,
      painIntensity: null,
      submittedAt: null,
    },
  };

  const appointment: AppointmentPrototype = {
    kind: 'APPOINTMENT',
    id: 'scheduled-appointment-ahmed',
    patient: {
      type: 'SELF',
      familyMemberId: null,
      displayName: 'Ahmed Gharbi',
      relationshipLabel: 'Lui-même',
    },
    doctorName: 'Dr Amine Ben Salah',
    doctorSpecialty: 'Médecine générale',
    cabinet: CABINETS[0],
    requestedSlot: confirmed,
    proposedSlot: null,
    status: 'CONFIRMED',
    createdAt: new Date(now.getTime() - 3 * HOUR_MS).toISOString(),
    confirmedAt: new Date(now.getTime() - 2 * HOUR_MS).toISOString(),
    responseDeadline: new Date(now.getTime() - HOUR_MS).toISOString(),
    patientResponseDeadline: null,
    cancelledAt: null,
    cancellationReason: null,
    lateCancellation: false,
    intake: {
      status: 'SUBMITTED',
      bodyAreas: ['Épaule droite'],
      description: 'Douleur apparue progressivement après un effort.',
      painIntensity: 4,
      submittedAt: new Date(now.getTime() - HOUR_MS).toISOString(),
    },
  };

  return [pendingDoctor, pendingPatient, appointment];
}

@Injectable({ providedIn: 'root' })
export class ScheduledCarePrototypeStore {
  /** P2-02 only: no value in this store is sent to an API. */
  readonly prototypeOnly = true;
  private readonly enabledState = signal(false);
  readonly enabled = this.enabledState.asReadonly();
  readonly cabinets = computed(() => (this.enabled() ? CABINETS : []));
  private readonly recordsState = signal<readonly ScheduledCareRecordPrototype[]>([]);
  readonly records = this.recordsState.asReadonly();

  readonly pendingDoctor = computed(() =>
    this.records().filter((record) => record.status === 'PENDING_DOCTOR'),
  );
  readonly pendingPatient = computed(() =>
    this.records().filter((record) => record.status === 'PENDING_PATIENT_TIME_CONFIRMATION'),
  );
  readonly confirmed = computed(() =>
    this.records().filter(
      (record): record is AppointmentPrototype => record.kind === 'APPOINTMENT',
    ),
  );
  readonly activeCalendarRecords = computed(() =>
    this.records().filter(
      (record) =>
        record.status === 'PENDING_DOCTOR' ||
        record.status === 'PENDING_PATIENT_TIME_CONFIRMATION' ||
        record.status === 'CONFIRMED',
    ),
  );

  readonly freeSlots = computed<readonly SlotPrototype[]>(() => {
    if (!this.enabled()) return [];
    const candidates = [
      slot('lac-2-free-1', CABINETS[0].id, 2, 10, 30),
      slot('lac-2-free-2', CABINETS[0].id, 2, 11, 30),
      slot('lac-2-free-3', CABINETS[0].id, 4, 9, 30),
      slot('ariana-free-1', CABINETS[1].id, 3, 16, 20),
      slot('ariana-free-2', CABINETS[1].id, 3, 17, 20),
      slot('ariana-free-3', CABINETS[1].id, 5, 15, 20),
    ];
    const held = this.activeCalendarRecords().map(activeSlot);
    return candidates.filter(
      (candidate) => !held.some((occupied) => slotsOverlapInCabinet(occupied, candidate)),
    );
  });

  /** Explicitly enters the local P2 review context. Real routes never call this. */
  enablePrototype(): void {
    if (this.enabled()) return;
    this.recordsState.set(initialRecords());
    this.enabledState.set(true);
  }

  disablePrototype(): void {
    this.recordsState.set([]);
    this.enabledState.set(false);
  }

  record(id: string): ScheduledCareRecordPrototype | null {
    return this.records().find((record) => record.id === id) ?? null;
  }

  availableSlots(cabinetId: string): readonly SlotPrototype[] {
    return this.freeSlots().filter((candidate) => candidate.cabinetId === cabinetId);
  }

  accept(id: string): void {
    this.recordsState.update((records) =>
      records.map((record) => {
        if (record.id !== id || record.status !== 'PENDING_DOCTOR') return record;
        const appointment: AppointmentPrototype = {
          ...record,
          kind: 'APPOINTMENT',
          status: 'CONFIRMED',
          confirmedAt: new Date().toISOString(),
        };
        return appointment;
      }),
    );
  }

  propose(id: string, replacement: SlotPrototype): void {
    const current = this.record(id);
    if (
      !current ||
      current.status !== 'PENDING_DOCTOR' ||
      replacement.cabinetId !== current.cabinet.id ||
      !this.availableSlots(current.cabinet.id).some(
        (candidate) =>
          candidate.cabinetId === replacement.cabinetId &&
          candidate.start === replacement.start &&
          candidate.end === replacement.end,
      )
    ) {
      return;
    }
    this.recordsState.update((records) =>
      records.map((record) => {
        if (record.id !== id || record.status !== 'PENDING_DOCTOR') return record;
        const request: BookingRequestPrototype = {
          ...record,
          proposedSlot: replacement,
          status: 'PENDING_PATIENT_TIME_CONFIRMATION',
          patientResponseDeadline: new Date(Date.now() + 6 * HOUR_MS).toISOString(),
        };
        return request;
      }),
    );
  }

  decline(id: string, reason: string): void {
    const value = reason.trim();
    if (!value) return;
    this.cancelByDoctor(id, value);
  }

  cancelByDoctor(id: string, reason: string): void {
    const value = reason.trim();
    if (!value) return;
    this.recordsState.update((records) =>
      records.map((record) => {
        if (
          record.id !== id ||
          (record.status !== 'PENDING_DOCTOR' && record.status !== 'CONFIRMED')
        ) {
          return record;
        }
        const request: BookingRequestPrototype = {
          ...record,
          kind: 'BOOKING_REQUEST',
          status: 'CANCELLED_BY_DOCTOR',
          cancelledAt: new Date().toISOString(),
          cancellationReason: value,
          lateCancellation:
            new Date(activeSlot(record).start).getTime() - Date.now() < 24 * HOUR_MS,
        };
        return request;
      }),
    );
  }

  expire(id: string): void {
    this.recordsState.update((records) =>
      records.map((record) => {
        if (
          record.id !== id ||
          (record.status !== 'PENDING_DOCTOR' &&
            record.status !== 'PENDING_PATIENT_TIME_CONFIRMATION')
        ) {
          return record;
        }
        const request: BookingRequestPrototype = {
          ...record,
          kind: 'BOOKING_REQUEST',
          status: 'EXPIRED',
        };
        return request;
      }),
    );
  }
}
