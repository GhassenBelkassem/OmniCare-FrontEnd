/** Test-only fakes for the consultation page (imported by specs only). */
import { signal } from '@angular/core';
import { Subject, of } from 'rxjs';
import { vi } from 'vitest';

import { ActiveConsultationApiService } from '../../active-consultation-api.service';
import { RealtimeService } from '../../../../core/realtime/realtime.service';
import type { ScheduledCareEvent } from '../../../../core/realtime/live-event.models';
import { PracticePatientApiService } from '../../practice-patient-api.service';
import { PracticeLocationApiService } from '../../settings/practice-location-api.service';
import type { ActiveConsultation, ConsultationAccessMode } from '../../active-consultation.models';
import { ActiveConsultationStore } from '../../active-consultation.store';
import { AppointmentApiService } from '../../appointment-api.service';
import { ArtifactApiService } from '../../artifact-api.service';
import type { ArtifactResponse } from '../../artifact.models';
import { ClinicalOrderApiService } from '../../clinical-order-api.service';
import type { ClinicalOrder } from '../../clinical-order.models';
import { ClinicalRecordApiService } from '../../clinical-record-api.service';
import { EMPTY_CLINICAL_RECORD, type ClinicalRecordPayload, type ClinicalRecordResponse } from '../../clinical-record.models';
import type { DoctorMedicalRecordWorkspace } from '../../medical-record.models';
import { MedicalRecordStore } from '../../medical-record.store';
import { PatientChartApiService } from '../../patient-chart/patient-chart-api.service';
import type { PatientChartDto } from '../../patient-chart/patient-chart-api.models';
import { PrescriptionApiService } from '../../prescription-api.service';
import type { PrescriptionResponse } from '../../prescription.models';

export const CONSULTATION_ID = '1b7c8d96-0000-4000-8000-000000000001';
export const CHART_ID = '2c8d9e07-0000-4000-8000-000000000002';

export function consultation(patch: Partial<ActiveConsultation> = {}, mode: ConsultationAccessMode = 'EXTERNAL_OWNER'): ActiveConsultation {
  return {
    consultationId: CONSULTATION_ID,
    sourceType: 'SCHEDULED_APPOINTMENT',
    sourceId: '4878955f-0000-4000-8000-000000000003',
    status: 'IN_PROGRESS',
    medicalAccessStatus: 'ACTIVE',
    version: 3,
    startedAt: '2026-11-10T09:05:00Z',
    completedAt: null,
    access: { mode },
    patient: {
      chartId: CHART_ID, patientType: 'EXTERNAL', firstName: 'Marwa', lastName: 'Mechergui', fullName: 'Marwa Mechergui',
      ageYears: 20, ageApproximate: true, sex: 'F', dateOfBirth: null,
    },
    ...patch,
  };
}

export function record(patch: Partial<ClinicalRecordPayload> = {}, version = 1): ClinicalRecordResponse {
  return { clinicalRecordVersion: version, schemaVersion: 4, clinicalRecord: { ...EMPTY_CLINICAL_RECORD, ...patch } };
}

export const COMPLETE_NOTE: Partial<ClinicalRecordPayload> = {
  chiefComplaint: 'Fièvre',
  diagnoses: [{ system: 'LOCAL', code: '', label: 'Angine', status: 'PROVISIONAL' }],
  medicationDecision: 'MEDICATION_PRESCRIBED',
  followUp: { required: true, recommendedAt: null, decision: 'FOLLOW_UP_AS_NEEDED' },
};

export function prescription(patch: Partial<PrescriptionResponse> = {}): PrescriptionResponse {
  return {
    prescriptionId: null, prescriptionVersion: 0, clinicalRecordVersion: 1, schemaVersion: 3, status: 'NONE', finalized: false,
    signedAt: null, signatureAlgorithm: null, medicationDecision: null, prescription: null, ...patch,
  };
}

export const DRAFT_PRESCRIPTION = prescription({
  prescriptionId: 'rx-1', prescriptionVersion: 2, status: 'DRAFT',
  prescription: {
    generalInstructions: null,
    medications: [{
      itemId: '11111111-1111-4111-8111-111111111111', replacesItemId: null, medicationCode: null, name: 'Amoxicilline',
      strength: null, dose: { amount: 1, unit: 'G' }, route: 'ORAL', frequency: { timesPerDay: 2, text: null },
      duration: { value: 1, unit: 'WEEK' }, quantity: null, instructions: null,
    }],
  },
});

export function order(patch: Partial<ClinicalOrder> = {}): ClinicalOrder {
  return {
    clinicalOrderId: 'order-1', consultationId: CONSULTATION_ID, category: 'LAB', status: 'DRAFT', clinicalOrderVersion: 1,
    schemaVersion: 1, definition: { requestedExamination: 'NFS', requestedStudy: null, targetSpecialty: null }, ...patch,
  };
}

export function certificate(patch: Partial<ArtifactResponse> = {}): ArtifactResponse {
  return {
    artifactId: 'artifact-1', consultationId: CONSULTATION_ID, artifactType: 'MEDICAL_CERTIFICATE', artifactVersion: 1,
    status: 'DRAFT', sourceResourceId: null, sourceResourceVersion: null, definition: { certificate: { statement: 'Apte.' } },
    renderStatus: 'WAITING_FOR_COMPLETION', renderVersion: 0, checksumSha256: null, sizeBytes: null, pageCount: null,
    verificationReference: null, signedAt: null, createdAt: '2026-11-10T09:10:00Z', updatedAt: '2026-11-10T09:10:00Z', ...patch,
  };
}

export function workspace(patch: Partial<DoctorMedicalRecordWorkspace> = {}): DoctorMedicalRecordWorkspace {
  return {
    consultation: { consultationId: CONSULTATION_ID, status: 'IN_PROGRESS', medicalAccessStatus: 'ACTIVE', version: 3 },
    access: {
      state: 'ACTIVE', mode: 'EXTERNAL_OWNER', expiresAt: null,
      sections: { ESSENTIAL_INFORMATION: 'AUTHORIZED', CURRENT_MEDICATIONS: 'AUTHORIZED', CONSULTATION_SUMMARIES: 'AUTHORIZED', DOCUMENTS: 'DEFERRED' },
    },
    essentialInformation: { bloodType: null, allergies: [], criticalConditions: [], allergiesStatus: 'UNKNOWN', conditionsStatus: 'UNKNOWN' },
    currentMedications: [],
    consultationSummaries: { items: [], nextCursor: null },
    documents: { state: 'DEFERRED' },
    ...patch,
  };
}

export interface Fakes {
  readonly consultations: {
    get: ReturnType<typeof vi.fn>; finish: ReturnType<typeof vi.fn>; finishReadiness: ReturnType<typeof vi.fn>; abort: ReturnType<typeof vi.fn>;
    followUpAvailability: ReturnType<typeof vi.fn>; saveFollowUpSlot: ReturnType<typeof vi.fn>;
    clearFollowUpSlot: ReturnType<typeof vi.fn>; rebookFollowUp: ReturnType<typeof vi.fn>;
    requestAccess: ReturnType<typeof vi.fn>; cancelAccessRequest: ReturnType<typeof vi.fn>;
  };
  /** The doctor's cabinets (follow-up slot picker). */
  readonly locations: { list: ReturnType<typeof vi.fn> };
  /** Live events (G-1 D2: CLINICAL_ACCESS_CHANGED). */
  readonly realtime: { scheduledCareEvents$: Subject<ScheduledCareEvent> };
  readonly clinical: { read: ReturnType<typeof vi.fn>; save: ReturnType<typeof vi.fn> };
  readonly prescriptions: { read: ReturnType<typeof vi.fn>; save: ReturnType<typeof vi.fn>; finalize: ReturnType<typeof vi.fn>; discard: ReturnType<typeof vi.fn> };
  readonly orders: { list: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn>; finalize: ReturnType<typeof vi.fn>; discard: ReturnType<typeof vi.fn> };
  readonly artifacts: { list: ReturnType<typeof vi.fn>; createCertificate: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn>; finalize: ReturnType<typeof vi.fn>; discard: ReturnType<typeof vi.fn> };
  readonly appointments: { getAppointment: ReturnType<typeof vi.fn> };
  readonly medicalRecord: {
    workspace: ReturnType<typeof signal<DoctorMedicalRecordWorkspace | null>>;
    failure: ReturnType<typeof signal<string | null>>;
    loading: ReturnType<typeof signal<boolean>>;
    attach: ReturnType<typeof vi.fn>; clear: ReturnType<typeof vi.fn>; refresh: ReturnType<typeof vi.fn>;
  };
  readonly active: { refresh: ReturnType<typeof vi.fn> };
  /** Patient chart endpoints, used by the « Dossier patient » panel. */
  readonly chart: {
    getChart: ReturnType<typeof vi.fn>; getMedicalSummary: ReturnType<typeof vi.fn>; getConsultationPage: ReturnType<typeof vi.fn>;
    getConsultationDetail: ReturnType<typeof vi.fn>; getMedications: ReturnType<typeof vi.fn>;
    getDocuments: ReturnType<typeof vi.fn>; getHistory: ReturnType<typeof vi.fn>; downloadArtifact: ReturnType<typeof vi.fn>;
  };
  /** Every API call, in order. */
  readonly log: string[];
}

export interface FakeOptions {
  readonly consultation?: ActiveConsultation;
  readonly record?: ClinicalRecordResponse;
  readonly prescription?: PrescriptionResponse;
  readonly orders?: readonly ClinicalOrder[];
  readonly artifacts?: readonly ArtifactResponse[];
  readonly workspace?: DoctorMedicalRecordWorkspace | null;
}

/** A free follow-up slot, two days after the harness's « today » (Thursday 13 Nov 2026, 10:20 in Tunis). */
export const FOLLOW_UP_SLOT = { start: '2026-11-13T09:20:00Z', end: '2026-11-13T09:40:00Z', durationMinutes: 20 };

export function createFakes(options: FakeOptions = {}): Fakes {
  const log: string[] = [];
  const logged = <T>(name: string, value: () => T) => vi.fn((..._args: unknown[]) => {
    log.push(name);
    return value();
  });
  const current = options.consultation ?? consultation();
  return {
    log,
    consultations: {
      get: logged('consultation.get', () => of(current)),
      finish: logged('consultation.finish', () => of({ ...current, status: 'COMPLETED', version: current.version + 1 })),
      finishReadiness: logged('consultation.readiness', () => of({
        ready: true, clinicalRecordSaved: true, diagnosisReady: true, medicationDecisionReady: true, followUpReady: true,
        prescriptionReady: true, ordersReady: true, artifactsReady: true, missing: [],
      })),
      abort: logged('consultation.abort', () => of({ ...current, status: 'ABORTED', version: current.version + 1 })),
      followUpAvailability: logged('followUp.availability', () => of({
        doctorId: 'doctor-1', practiceLocationId: 'cabinet-1', timezone: 'Africa/Tunis', generatedAt: '2026-11-11T08:00:00Z',
        slots: [FOLLOW_UP_SLOT],
      })),
      saveFollowUpSlot: vi.fn((_id: string, slot: { start: string; end: string; practiceLocationId: string }) => {
        log.push('followUp.saveSlot');
        return of({ ...slot, locationName: 'Cabinet El Menzah' });
      }),
      clearFollowUpSlot: logged('followUp.clearSlot', () => of(undefined)),
      requestAccess: logged('access.request', () => of({
        request: { requestId: 'request-1', status: 'PENDING', version: 0, createdAt: '2026-11-11T08:05:00Z', respondedAt: null },
        used: 1, max: 3, canRequest: false,
      })),
      cancelAccessRequest: logged('access.cancel', () => of({
        request: { requestId: 'request-1', status: 'CANCELLED', version: 1, createdAt: '2026-11-11T08:05:00Z', respondedAt: '2026-11-11T08:06:00Z' },
        used: 1, max: 3, canRequest: true,
      })),
      rebookFollowUp: logged('followUp.rebook', () => of({
        status: 'CONFIRMED', appointmentId: 'appointment-9', start: FOLLOW_UP_SLOT.start, end: FOLLOW_UP_SLOT.end,
        locationName: 'Cabinet El Menzah', proposalExpiresAt: null,
      })),
    },
    realtime: { scheduledCareEvents$: new Subject<ScheduledCareEvent>() },
    locations: {
      list: logged('locations.list', () => of([{ id: 'cabinet-1', name: 'Cabinet El Menzah', active: true, primary: true }])),
    },
    clinical: {
      read: logged('note.read', () => of(options.record ?? record())),
      save: vi.fn((_id: string, version: number, payload: ClinicalRecordPayload) => {
        log.push('note.save');
        return of({ clinicalRecordVersion: version + 1, schemaVersion: 4, clinicalRecord: payload });
      }),
    },
    prescriptions: {
      read: logged('prescription.read', () => of(options.prescription ?? prescription())),
      save: vi.fn((_id: string, version: number, content: unknown) => {
        log.push('prescription.save');
        return of(prescription({ prescriptionId: 'rx-1', prescriptionVersion: version + 1, status: 'DRAFT', prescription: content as PrescriptionResponse['prescription'] }));
      }),
      finalize: vi.fn((_id: string, version: number) => {
        log.push('prescription.finalize');
        return of({ ...(options.prescription ?? DRAFT_PRESCRIPTION), prescriptionVersion: version + 1, status: 'ACTIVE' as const, finalized: true });
      }),
      discard: logged('prescription.discard', () => of(prescription({ prescriptionVersion: 3 }))),
    },
    orders: {
      list: logged('orders.list', () => of({ orders: options.orders ?? [] })),
      create: logged('order.create', () => of(order())),
      update: logged('order.update', () => of(order({ clinicalOrderVersion: 2 }))),
      finalize: vi.fn((_id: string, value: ClinicalOrder) => {
        log.push('order.finalize');
        return of({ ...value, status: 'FINALIZED' as const });
      }),
      discard: logged('order.discard', () => of(undefined)),
    },
    artifacts: {
      list: logged('artifacts.list', () => of({ artifacts: options.artifacts ?? [] })),
      createCertificate: logged('artifact.create', () => of(certificate())),
      update: logged('artifact.update', () => of(certificate({ artifactVersion: 2 }))),
      finalize: vi.fn((_id: string, value: ArtifactResponse) => {
        log.push('artifact.finalize');
        return of({ ...value, status: 'FINALIZED' as const });
      }),
      discard: logged('artifact.discard', () => of(undefined)),
    },
    appointments: { getAppointment: vi.fn(() => of({ startTime: '2026-11-10T09:00:00Z' })) },
    medicalRecord: {
      workspace: signal(options.workspace === undefined ? workspace() : options.workspace),
      failure: signal(null),
      loading: signal(false),
      attach: vi.fn(), clear: vi.fn(), refresh: vi.fn(() => Promise.resolve()),
    },
    active: { refresh: vi.fn(() => Promise.resolve()) },
    chart: {
      getChart: logged('chart.get', () => of(chartDto())),
      getMedicalSummary: logged('chart.summary', () => of({
        editable: false, version: 1, essentialInformationShared: true, treatmentsShared: true, bloodType: 'O+',
        allergies: [], conditions: [], allergiesStatus: 'NONE_KNOWN', conditionsStatus: 'UNKNOWN', treatments: [],
      })),
      getConsultationPage: logged('chart.consultations', () => of({
        view: 'CLINICAL', nextCursor: null, total: 1,
        items: [{ id: CONSULTATION_ID, date: '2026-11-10T09:05:00Z', status: 'IN_PROGRESS', doctor: { name: 'Dr Sami Ben Ali', specialty: null }, clinicalAvailable: false, reason: null, diagnosisSummary: null }],
      })),
      getConsultationDetail: logged('chart.consultation', () => of(null)),
      getMedications: logged('chart.medications', () => of({ state: 'current', activeCount: 0, items: [] })),
      // The server would allow an upload: the panel must still not offer one.
      getDocuments: logged('chart.documents', () => of({ canUpload: true, items: [], nextCursor: null })),
      getHistory: logged('chart.history', () => of({ clinicalIncluded: true, clinicalUnavailable: false, items: [] })),
      downloadArtifact: vi.fn(),
    },
  };
}

export function chartDto(): PatientChartDto {
  return {
    id: CHART_ID,
    patientType: 'EXTERNAL',
    identity: {
      firstName: 'Marwa', lastName: 'Mechergui', fullName: 'Marwa Mechergui', ageYears: 20, ageApproximate: true, sex: 'F',
      dateOfBirth: null, phone: null, email: null, address: null, practiceIdentifier: null,
    },
    access: { mode: 'EXTERNAL_OWNER', clinical: true, editable: true, grantExpiresAt: null, verificationUnavailable: false },
    medicalRecord: { status: 'READY' },
    schedulable: true,
    nextAppointment: null,
    startableAppointment: null,
    lastConsultation: null,
    counts: { consultations: 0, documents: 0, history: 0 },
  };
}

export function fakeProviders(fakes: Fakes) {
  return [
    { provide: PatientChartApiService, useValue: fakes.chart },
    { provide: ActiveConsultationApiService, useValue: fakes.consultations },
    { provide: ClinicalRecordApiService, useValue: fakes.clinical },
    { provide: PrescriptionApiService, useValue: fakes.prescriptions },
    { provide: ClinicalOrderApiService, useValue: fakes.orders },
    { provide: ArtifactApiService, useValue: fakes.artifacts },
    { provide: AppointmentApiService, useValue: fakes.appointments },
    { provide: MedicalRecordStore, useValue: fakes.medicalRecord },
    { provide: ActiveConsultationStore, useValue: fakes.active },
    { provide: PracticeLocationApiService, useValue: fakes.locations },
    { provide: RealtimeService, useValue: fakes.realtime },
    // The booking drawer's practice-patient path is never used in follow-up mode.
    { provide: PracticePatientApiService, useValue: {} },
  ];
}
