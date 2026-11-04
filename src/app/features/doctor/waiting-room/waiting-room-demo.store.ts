import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { DestroyRef, Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';

import {
  DEMO_PRACTICE_PATIENTS,
  DEMO_WAITING_ROOM_PATIENTS,
  DEMO_WAITING_ROOM_TIME,
  DemoPracticePatient,
  DemoQueueStatus,
  DemoWaitingRoomPatient,
  compareQueueOrder,
  minutesFromTime,
  timeFromMinutes,
  waitingMinutes,
} from './waiting-room-demo.fixtures';

const STORAGE_KEY = 'omnicare.static-demo.waiting-room.v2';
const STORAGE_VERSION = 2;

interface PersistedWaitingRoomState {
  readonly version: number;
  readonly clockTime: string;
  readonly patients: readonly DemoWaitingRoomPatient[];
}

export interface QueueActionResult {
  readonly ok: boolean;
  readonly message: string;
  readonly patientId?: string;
}

export interface TemporaryWalkInInput {
  readonly name: string;
  readonly phone: string;
}

@Injectable()
export class WaitingRoomDemoStore {
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private readonly storage = this.resolveStorage();
  private readonly initialState = this.readPersistedState();
  private readonly patientsState = signal<readonly DemoWaitingRoomPatient[]>(
    this.initialState?.patients ?? this.freshPatients(),
  );
  private readonly clockTimeState = signal(this.initialState?.clockTime ?? DEMO_WAITING_ROOM_TIME);

  readonly patients = this.patientsState.asReadonly();
  readonly clockTime = this.clockTimeState.asReadonly();
  readonly waitingQueue = computed(() =>
    this.patientsState()
      .filter(
        (patient) =>
          patient.queueStatus === 'WAITING' && patient.appointmentStatus !== 'NO_SHOW',
      )
      .sort(compareQueueOrder),
  );
  readonly suggestedPatient = computed(() => this.waitingQueue()[0] ?? null);
  readonly activeConsultation = computed(
    () =>
      this.patientsState().find((patient) => patient.queueStatus === 'IN_CONSULTATION') ?? null,
  );
  readonly activeCall = computed(
    () => this.patientsState().find((patient) => patient.queueStatus === 'CALLED') ?? null,
  );

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      const timer = this.document.defaultView?.setInterval(() => this.advanceClock(1), 60_000);
      if (timer !== undefined) {
        this.destroyRef.onDestroy(() => this.document.defaultView?.clearInterval(timer));
      }
    }
  }

  waitMinutes(patient: DemoWaitingRoomPatient): number | null {
    return waitingMinutes(patient, this.clockTimeState());
  }

  queuePosition(patientId: string): number | null {
    const index = this.waitingQueue().findIndex((patient) => patient.id === patientId);
    return index === -1 ? null : index + 1;
  }

  advanceClock(minutes: number): void {
    this.clockTimeState.update((time) => timeFromMinutes(minutesFromTime(time) + minutes));
    this.persist();
  }

  markArrived(patientId: string): QueueActionResult {
    const patient = this.findPatient(patientId);
    if (!patient || patient.appointmentStatus === 'NO_SHOW' || patient.queueStatus !== 'EXPECTED') {
      return this.invalid('Ce patient ne peut pas être enregistré comme arrivé dans son état actuel.');
    }
    return this.transition(patient, 'WAITING', 'Arrivée enregistrée', {
      checkedInAt: this.clockTimeState(),
      calledAt: null,
    });
  }

  callNext(): QueueActionResult {
    const next = this.suggestedPatient();
    if (!next) return this.invalid('Aucun patient enregistré comme présent ne peut être appelé.');
    return this.callPatient(next.id);
  }

  callPatient(patientId: string): QueueActionResult {
    const patient = this.findPatient(patientId);
    if (!patient || !['WAITING', 'MISSED_CALL'].includes(patient.queueStatus)) {
      return this.invalid('Seul un patient présent et en attente peut être appelé.');
    }
    const activeCall = this.activeCall();
    if (activeCall && activeCall.id !== patient.id) {
      return this.invalid(`${activeCall.name} est déjà appelé. Traitez cet appel avant d’en lancer un autre.`);
    }
    return this.transition(patient, 'CALLED', 'Patient appelé', {
      calledAt: this.clockTimeState(),
    });
  }

  startConsultation(patientId: string): QueueActionResult {
    const patient = this.findPatient(patientId);
    if (!patient || patient.queueStatus !== 'CALLED') {
      return this.invalid('Le patient doit d’abord être appelé avant de démarrer la consultation.');
    }
    const active = this.activeConsultation();
    if (active && active.id !== patient.id) {
      return this.invalid(`Une consultation est déjà en cours avec ${active.name}.`);
    }
    return this.transition(patient, 'IN_CONSULTATION', 'Consultation démarrée', {
      consultationStartedAt: this.clockTimeState(),
    });
  }

  continueConsultation(patientId: string): QueueActionResult {
    const patient = this.findPatient(patientId);
    if (!patient || patient.queueStatus !== 'IN_CONSULTATION') {
      return this.invalid('Aucune consultation simulée active pour ce patient.');
    }
    return {
      ok: true,
      patientId,
      message: `Consultation simulée de ${patient.name} reprise localement.`,
    };
  }

  completeConsultation(patientId: string): QueueActionResult {
    const patient = this.findPatient(patientId);
    if (!patient || patient.queueStatus !== 'IN_CONSULTATION') {
      return this.invalid('Seule une consultation active peut être terminée.');
    }
    return this.transition(patient, 'COMPLETED', 'Consultation terminée', {
      appointmentStatus: 'COMPLETED',
      completedAt: this.clockTimeState(),
    });
  }

  markMissedCall(patientId: string): QueueActionResult {
    const patient = this.findPatient(patientId);
    if (!patient || patient.queueStatus !== 'CALLED') {
      return this.invalid('Le statut « absent à l’appel » nécessite un appel en cours.');
    }
    return this.transition(patient, 'MISSED_CALL', 'Absent à l’appel');
  }

  requeue(patientId: string): QueueActionResult {
    const patient = this.findPatient(patientId);
    if (!patient || !['CALLED', 'MISSED_CALL'].includes(patient.queueStatus)) {
      return this.invalid('Ce patient ne peut pas être remis en attente dans son état actuel.');
    }
    return this.transition(patient, 'WAITING', 'Remis en attente', { calledAt: null });
  }

  confirmNoShow(patientId: string): QueueActionResult {
    const patient = this.findPatient(patientId);
    if (
      !patient ||
      patient.walkIn ||
      patient.appointmentStatus !== 'CONFIRMED' ||
      patient.queueStatus !== 'EXPECTED'
    ) {
      return this.invalid('La non-présentation ne peut être confirmée que pour un rendez-vous attendu.');
    }
    return this.updatePatient(patient, 'Non-présentation confirmée manuellement', {
      appointmentStatus: 'NO_SHOW',
    });
  }

  markLeft(patientId: string): QueueActionResult {
    const patient = this.findPatient(patientId);
    if (!patient || !['WAITING', 'CALLED', 'MISSED_CALL'].includes(patient.queueStatus)) {
      return this.invalid('Seul un patient présent dans la file peut être marqué comme parti.');
    }
    return this.transition(patient, 'LEFT', 'Patient parti du cabinet', {
      leftAt: this.clockTimeState(),
    });
  }

  addExistingWalkIn(practicePatientId: string): QueueActionResult {
    const practicePatient = DEMO_PRACTICE_PATIENTS.find(({ id }) => id === practicePatientId);
    if (!practicePatient) return this.invalid('Sélectionnez un patient fictif de la pratique.');
    if (this.patientsState().some(({ id }) => id === `walk-in-${practicePatient.id}`)) {
      return this.invalid(`${practicePatient.name} est déjà présent dans la file de démonstration.`);
    }
    return this.addWalkIn(this.patientFromPractice(practicePatient));
  }

  addTemporaryWalkIn(input: TemporaryWalkInInput): QueueActionResult {
    const name = input.name.trim();
    const phone = input.phone.trim();
    if (name.length < 2 || phone.length < 6) {
      return this.invalid('Renseignez un nom et un numéro de téléphone valides.');
    }
    const id = `walk-in-temp-${this.clockTimeState().replace(':', '')}-${this.patientsState().length}`;
    return this.addWalkIn({
      id,
      name,
      age: 0,
      birthDate: 'Non renseignée',
      gender: 'Non renseigné',
      insuranceNumber: 'Temporaire · démo',
      phone,
      email: 'Non renseigné',
      address: 'Non renseignée',
      appointmentTime: null,
      checkedInAt: this.clockTimeState(),
      calledAt: null,
      consultationStartedAt: null,
      completedAt: null,
      leftAt: null,
      cabinet: 'Cabinet principal',
      appointmentType: 'Sans rendez-vous',
      appointmentStatus: 'CONFIRMED',
      queueStatus: 'WAITING',
      walkIn: true,
      events: [],
    });
  }

  reset(): QueueActionResult {
    this.patientsState.set(this.freshPatients());
    this.clockTimeState.set(DEMO_WAITING_ROOM_TIME);
    this.storage?.removeItem(STORAGE_KEY);
    return { ok: true, message: 'La salle d’attente fictive a été réinitialisée.' };
  }

  private addWalkIn(patient: DemoWaitingRoomPatient): QueueActionResult {
    const event = this.createEvent(patient, 'Patient sans rendez-vous enregistré');
    const withEvent = { ...patient, events: [...patient.events, event] };
    this.patientsState.update((patients) => [...patients, withEvent]);
    this.persist();
    return {
      ok: true,
      patientId: patient.id,
      message: `${patient.name} a été ajouté à la file sans créer de rendez-vous.`,
    };
  }

  private patientFromPractice(patient: DemoPracticePatient): DemoWaitingRoomPatient {
    return {
      ...patient,
      id: `walk-in-${patient.id}`,
      appointmentTime: null,
      checkedInAt: this.clockTimeState(),
      calledAt: null,
      consultationStartedAt: null,
      completedAt: null,
      leftAt: null,
      cabinet: 'Cabinet principal',
      appointmentType: 'Sans rendez-vous',
      appointmentStatus: 'CONFIRMED',
      queueStatus: 'WAITING',
      walkIn: true,
      events: [],
    };
  }

  private transition(
    patient: DemoWaitingRoomPatient,
    queueStatus: DemoQueueStatus,
    label: string,
    changes: Partial<DemoWaitingRoomPatient> = {},
  ): QueueActionResult {
    return this.updatePatient(patient, label, { ...changes, queueStatus });
  }

  private updatePatient(
    patient: DemoWaitingRoomPatient,
    label: string,
    changes: Partial<DemoWaitingRoomPatient>,
  ): QueueActionResult {
    const event = this.createEvent(patient, label);
    this.patientsState.update((patients) =>
      patients.map((candidate) =>
        candidate.id === patient.id
          ? { ...candidate, ...changes, events: [...candidate.events, event] }
          : candidate,
      ),
    );
    this.persist();
    return { ok: true, patientId: patient.id, message: `${label} pour ${patient.name}.` };
  }

  private createEvent(patient: DemoWaitingRoomPatient, label: string) {
    return {
      id: `${patient.id}-${this.clockTimeState().replace(':', '')}-${patient.events.length}`,
      at: this.clockTimeState(),
      label,
    };
  }

  private findPatient(patientId: string): DemoWaitingRoomPatient | undefined {
    return this.patientsState().find(({ id }) => id === patientId);
  }

  private invalid(message: string): QueueActionResult {
    return { ok: false, message };
  }

  private freshPatients(): readonly DemoWaitingRoomPatient[] {
    return structuredClone(DEMO_WAITING_ROOM_PATIENTS);
  }

  private resolveStorage(): Storage | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    try {
      return this.document.defaultView?.localStorage ?? null;
    } catch {
      return null;
    }
  }

  private readPersistedState(): PersistedWaitingRoomState | null {
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<PersistedWaitingRoomState>;
      if (
        parsed.version !== STORAGE_VERSION ||
        typeof parsed.clockTime !== 'string' ||
        !Array.isArray(parsed.patients)
      ) {
        return null;
      }
      return parsed as PersistedWaitingRoomState;
    } catch {
      return null;
    }
  }

  private persist(): void {
    try {
      this.storage?.setItem(
        STORAGE_KEY,
        JSON.stringify({
          version: STORAGE_VERSION,
          clockTime: this.clockTimeState(),
          patients: this.patientsState(),
        } satisfies PersistedWaitingRoomState),
      );
    } catch {
      // Storage can be unavailable in privacy mode; the in-memory demo remains functional.
    }
  }
}
