import { Injectable, computed, signal } from '@angular/core';
import { Subscription, interval } from 'rxjs';

import {
  ConsultationDraft,
  MockConsultation,
  MockMedicalRecord,
  MockPatient,
  MockPatientCreateDto,
  MockPatientMatch,
  MockPrescriptionLine,
  MockVitals,
  UrgentRequest,
} from './doctor-mock.models';

const MOCK_TODAY_ISO = '2026-08-06';

export function emptyVitals(): MockVitals {
  return { systolicBP: null, diastolicBP: null, heartRate: null, temperature: null, weight: null };
}

export function blankDraft(consultation: MockConsultation): ConsultationDraft {
  return {
    diagnosis: consultation.diagnosis,
    treatment: consultation.treatment,
    vitals: consultation.vitals,
    prescriptionLines: consultation.prescriptionLines,
    scribeText: '',
    ordonnanceText: '',
  };
}

export function hasDraftContent(draft: ConsultationDraft): boolean {
  if (draft.diagnosis.trim() || draft.treatment.trim()) return true;
  if (draft.scribeText.trim() || draft.ordonnanceText.trim()) return true;
  if (Object.values(draft.vitals).some((value) => value !== null)) return true;
  return draft.prescriptionLines.some((line) =>
    [line.drugName, line.dosage, line.timing, line.duration].some((field) => field.trim()),
  );
}

export function ageFromDob(dob: string, todayIso = MOCK_TODAY_ISO): number {
  const birth = new Date(`${dob}T00:00:00`);
  const today = new Date(`${todayIso}T00:00:00`);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDayEarlier = today.getMonth() < birth.getMonth()
    || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());
  if (monthDayEarlier) age -= 1;
  return Math.max(age, 0);
}

@Injectable({ providedIn: 'root' })
export class DoctorMockService {
  private patients: MockPatient[] = [
    { id: 'p-1', name: 'Sami Trabelsi', dob: '1985-03-14', phone: '+216 20 111 222' },
    { id: 'p-2', name: 'Nadia Chaabane', dob: '1979-08-02', phone: '+216 21 333 444' },
    { id: 'p-3', name: 'Karim Jaziri', dob: '1992-11-23', phone: '+216 22 555 666' },
    { id: 'p-4', name: 'Mouna Gharbi', dob: '1988-05-09', phone: '+216 23 777 888' },
    { id: 'p-5', name: 'Youssef Amri', dob: '1966-01-30', phone: '+216 24 999 000' },
    { id: 'p-6', name: 'Leila Mansour', dob: '1990-12-17', phone: '+216 25 111 333' },
    { id: 'p-7', name: 'Amin Baccar', dob: '1974-06-25', phone: '+216 26 222 444' },
    { id: 'p-8', name: 'Rim Ferchichi', dob: '1983-09-11', phone: '+216 27 333 555' },
    { id: 'p-9', name: 'Hatem Beldi', dob: '1958-04-06', phone: '+216 28 444 666' },
    { id: 'p-10', name: 'Sarra Mejri', dob: '1995-02-21', phone: '+216 29 555 777' },
    { id: 'p-11', name: 'Fares Jomaa', dob: '1970-07-13', phone: '+216 50 123 456' },
    { id: 'p-12', name: 'Hedi Bouazizi', dob: '1982-10-05', phone: '+216 98 111 222' },
    { id: 'p-13', name: 'Sofiene Hamdi', dob: '1991-06-18', phone: '+216 55 444 333' },
  ];

  private readonly consultations: MockConsultation[] = [
    active('c-1', 'p-1', '2026-08-06 09:00', 'qr', 'Consultation generale'),
    active('c-2', 'p-2', '2026-08-06 09:30', 'qr', 'Controle tension'),
    active('c-3', 'p-3', '2026-08-06 10:15', 'qr', 'Fievre'),
    active('c-4', 'p-4', '2026-08-06 11:00', 'qr', 'Premiere consultation'),
    active('c-5', 'p-5', '2026-08-06 14:30', 'qr', 'Renouvellement ordonnance'),
    active('c-14', 'p-12', '2026-08-06', 'urgent', 'Douleur abdominale a domicile'),
    active('c-15', 'p-13', '2026-08-06', 'manual', 'Consultation'),
    closed('c-12', 'p-1', '2026-08-06 09:00', 'qr', 'Rhino-pharyngite aigue', 'Repos, hydratation, paracetamol si fievre.', vitals(120, 80, 72, 36.8, 74), [
      line('Paracetamol', '1000 mg', '3x/jour', '5 jours'),
    ]),
    closed('c-13', 'p-2', '2026-08-06 09:30', 'qr', 'HTA controlee', 'Poursuivre le traitement antihypertenseur.', vitals(128, 82, 70, 36.5, 68), [
      line('Amlodipine', '5 mg', '1x/jour le matin', 'en continu'),
    ]),
    closed('c-6', 'p-6', '2026-08-05 16:00', 'qr', 'Arret de travail 3 jours', 'Repos et surveillance.', vitals(118, 76, 66, 36.7, 61), []),
    closed('c-7', 'p-7', '2026-08-05 11:30', 'qr', 'Diabete type 2, equilibre', 'Poursuivre metformine, controle glycemique.', vitals(130, 84, 74, 36.6, 86), [
      line('Metformine', '850 mg', '2x/jour', 'en continu'),
    ]),
    closed('c-8', 'p-8', '2026-08-04 15:15', 'qr', 'Conjonctivite virale', 'Lavage oculaire, gouttes lubrifiantes.', emptyVitals(), []),
    closed('c-9', 'p-9', '2026-08-02 20:40', 'urgent', 'Angoisse, ECG normal', 'Surveillance cardiologique ambulatoire.', vitals(124, 78, 88, 36.9, 90), []),
    closed('c-10', 'p-10', '2026-07-29 10:45', 'qr', 'Rhinite allergique', 'Antihistaminique si besoin.', vitals(116, 74, 64, 36.5, 58), [
      line('Cetirizine', '10 mg', '1x/jour le soir', '15 jours'),
    ]),
    closed('c-11', 'p-11', '2026-07-18 08:30', 'qr', 'Bilan biologique dans les normes', 'Controle dans un an.', vitals(122, 78, 68, 36.6, 82), []),
  ];

  private readonly drafts = new Map<string, ConsultationDraft>();

  private readonly urgentRequestState = signal<UrgentRequest | null>(null);
  private readonly urgentCountdownState = signal(0);
  private urgentCountdownSubscription: Subscription | null = null;

  readonly urgentRequest = this.urgentRequestState.asReadonly();
  readonly urgentCountdown = this.urgentCountdownState.asReadonly();

  readonly urgentPending = computed(() => this.urgentRequestState() !== null);

  recordFor(consultationId: string, source: 'urgent' | undefined): MockMedicalRecord {
    if (source === 'urgent') {
      return { patient: patientById(this.patients, 'p-12'), pastConsultations: [] };
    }
    const consultation = this.consultations.find((candidate) => candidate.id === consultationId);
    const patient = consultation
      ? patientById(this.patients, consultation.patientId)
      : null;
    if (!consultation || !patient) {
      return { patient: adHocPatient(), pastConsultations: [] };
    }
    const pastConsultations = this.consultations
      .filter((candidate) => candidate.patientId === patient.id
        && candidate.status === 'closed'
        && candidate.id !== consultationId)
      .map((candidate) => ({
        id: candidate.id,
        date: candidate.dateLabel,
        diagnosisLabel: candidate.diagnosis || 'Consultation',
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
    return { patient, pastConsultations };
  }

  consultationFor(consultationId: string): MockConsultation {
    const existing = this.consultations.find((candidate) => candidate.id === consultationId);
    if (existing) return existing;
    const created = active(consultationId, adHocPatient().id, MOCK_TODAY_ISO, 'qr', 'Consultation');
    this.consultations.push(created);
    return created;
  }

  consultationIdForPatient(patientId: string): string {
    const existing = this.consultations.find((candidate) => candidate.patientId === patientId
      && candidate.status === 'active');
    if (existing) return existing.id;
    const patient = patientById(this.patients, patientId);
    const created = active(`cons-${patientId}`, patient.id, MOCK_TODAY_ISO, 'manual', 'Consultation');
    this.consultations.push(created);
    return created.id;
  }

  findPatients(query: string): readonly MockPatientMatch[] {
    const term = query.trim().toLocaleLowerCase();
    if (!term) return [];
    return this.patients
      .filter((patient) => patient.name.toLocaleLowerCase().includes(term)
        || patient.phone.toLocaleLowerCase().includes(term))
      .map((patient) => ({ id: patient.id, name: patient.name, phone: patient.phone }));
  }

  patientById(id: string): MockPatient | undefined {
    return this.patients.find((patient) => patient.id === id);
  }

  createPatient(dto: MockPatientCreateDto): string {
    const id = `p-${Date.now()}`;
    this.patients.push({
      id,
      name: `${dto.firstName} ${dto.lastName}`,
      dob: dto.dateOfBirth,
      phone: dto.phone,
    });
    return id;
  }

  draftFor(consultationId: string): ConsultationDraft | null {
    return this.drafts.get(consultationId) ?? null;
  }

  updateDraft(consultationId: string, draft: ConsultationDraft): void {
    this.drafts.set(consultationId, draft);
  }

  clearDraft(consultationId: string): void {
    this.drafts.delete(consultationId);
  }

  closeConsultation(consultationId: string, draft: ConsultationDraft): void {
    const index = this.consultations.findIndex((candidate) => candidate.id === consultationId);
    if (index === -1) return;
    this.consultations[index] = {
      ...this.consultations[index],
      status: 'closed',
      diagnosis: draft.diagnosis,
      treatment: draft.treatment,
      vitals: draft.vitals,
      prescriptionLines: [...draft.prescriptionLines],
    };
    this.clearDraft(consultationId);
  }

  simulateIncomingRequest(): void {
    if (this.urgentRequestState()) return;
    this.urgentRequestState.set({
      id: `urgent-${Date.now()}`,
      patientName: 'Hedi Bouazizi',
      distance: '2.4 km',
      location: 'Nabeul, Tunisie',
      reason: 'Douleur abdominale aigue',
    });
    this.startUrgentCountdown(30);
  }

  acceptUrgent(): void {
    this.dismissUrgent();
  }

  declineUrgent(): void {
    this.dismissUrgent();
  }

  private startUrgentCountdown(seconds: number): void {
    this.stopUrgentCountdown();
    this.urgentCountdownState.set(seconds);
    this.urgentCountdownSubscription = interval(1000).subscribe(() => {
      this.urgentCountdownState.update((current) => {
        const next = current - 1;
        if (next <= 0) this.dismissUrgent();
        return Math.max(next, 0);
      });
    });
  }

  private dismissUrgent(): void {
    this.stopUrgentCountdown();
    this.urgentRequestState.set(null);
    this.urgentCountdownState.set(0);
  }

  private stopUrgentCountdown(): void {
    this.urgentCountdownSubscription?.unsubscribe();
    this.urgentCountdownSubscription = null;
  }
}

function active(
  id: string,
  patientId: string,
  dateLabel: string,
  source: MockConsultation['source'],
  diagnosis: string,
): MockConsultation {
  return {
    id,
    patientId,
    status: 'active',
    dateLabel,
    source,
    diagnosis,
    treatment: '',
    vitals: emptyVitals(),
    prescriptionLines: [],
  };
}

function closed(
  id: string,
  patientId: string,
  dateLabel: string,
  source: MockConsultation['source'],
  diagnosis: string,
  treatment: string,
  vitals: MockVitals,
  prescriptionLines: MockPrescriptionLine[],
): MockConsultation {
  return {
    id,
    patientId,
    status: 'closed',
    dateLabel,
    source,
    diagnosis,
    treatment,
    vitals,
    prescriptionLines,
  };
}

function vitals(
  systolicBP: number,
  diastolicBP: number,
  heartRate: number,
  temperature: number,
  weight: number,
): MockVitals {
  return { systolicBP, diastolicBP, heartRate, temperature, weight };
}

function line(drugName: string, dosage: string, timing: string, duration: string): MockPrescriptionLine {
  return { id: nextLineId(), drugName, dosage, timing, duration };
}

let nextLineIdValue = 100;
function nextLineId(): number {
  nextLineIdValue += 1;
  return nextLineIdValue;
}

function patientById(patients: readonly MockPatient[], id: string): MockPatient {
  return patients.find((patient) => patient.id === id) ?? adHocPatient();
}

function adHocPatient(): MockPatient {
  return { id: 'p-adhoc', name: 'Patient sans dossier', dob: '1980-01-01', phone: '—' };
}
