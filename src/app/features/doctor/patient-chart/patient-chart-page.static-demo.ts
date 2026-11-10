import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, Injectable, inject } from '@angular/core';
import { type Observable, of, throwError } from 'rxjs';

import type { DemoPatientRecord } from '../patients/patient-directory-demo.fixtures';
import { PatientDirectoryDemoStore } from '../patients/patient-directory-demo.store';
import type {
  PatientChartConsultationsDto,
  PatientChartDocumentsDto,
  PatientChartDto,
  PatientChartHistoryDto,
  PatientChartMedicalSummaryDto,
} from './patient-chart-api.models';
import { PatientChartApiService } from './patient-chart-api.service';
import { PatientChartPage as ProductionPatientChartPage } from './patient-chart-page';

/**
 * In-memory chart API for the static demo: fictional administrative data only, no clinical
 * content. Linked demo patients render in the restricted OmniCare mode.
 */
@Injectable()
export class DemoPatientChartApi {
  private readonly store = inject(PatientDirectoryDemoStore);

  getChart(patientId: string): Observable<PatientChartDto> {
    const patient = this.store.find(patientId);
    if (!patient) return throwError(() => new HttpErrorResponse({ status: 404 }));
    const omniCare = patient.linkage === 'LINKED';
    return of({
      id: patient.id,
      patientType: omniCare ? 'OMNICARE' : 'EXTERNAL',
      identity: {
        firstName: patient.firstName,
        lastName: patient.lastName,
        fullName: `${patient.firstName} ${patient.lastName}`,
        ageYears: ageOn(patient.dateOfBirth),
        ageApproximate: false,
        sex: patient.sex === 'autre' ? 'OTHER' : patient.sex,
        dateOfBirth: patient.dateOfBirth,
        phone: patient.phone,
        email: patient.email,
        address: patient.address,
        practiceIdentifier: null,
      },
      access: {
        mode: omniCare ? 'OMNICARE_RESTRICTED' : 'EXTERNAL_OWNER',
        clinical: !omniCare,
        editable: false,
        grantExpiresAt: null,
        verificationUnavailable: false,
      },
      medicalRecord: { status: 'READY' },
      schedulable: false,
      nextAppointment: patient.nextAppointment
        ? { id: `${patient.id}-next`, startTime: patient.nextAppointment, endTime: null, status: 'CONFIRMED', version: 0 }
        : null,
      startableAppointment: null,
      lastConsultation: patient.lastConsultation
        ? { id: `${patient.id}-last`, date: patient.lastConsultation, status: 'COMPLETED' }
        : null,
      counts: {
        consultations: patient.lastConsultation ? 1 : 0,
        documents: omniCare ? null : 0,
        history: null,
      },
    });
  }

  getMedicalSummary(): Observable<PatientChartMedicalSummaryDto> {
    return of({
      editable: false,
      version: 0,
      essentialInformationShared: true,
      treatmentsShared: true,
      bloodType: null,
      allergies: [],
      conditions: [],
      treatments: [],
    });
  }

  getConsultations(patientId: string): Observable<PatientChartConsultationsDto> {
    const patient = this.store.find(patientId);
    const items = patient?.lastConsultation
      ? [{ id: `${patient.id}-last`, date: patient.lastConsultation, status: 'COMPLETED' }]
      : [];
    return of({ view: 'ADMINISTRATIVE', items });
  }

  getDocuments(): Observable<PatientChartDocumentsDto> {
    return of({ canUpload: false, items: [], nextCursor: null });
  }

  getHistory(patientId: string): Observable<PatientChartHistoryDto> {
    const patient = this.store.find(patientId);
    return of({
      clinicalIncluded: false,
      clinicalUnavailable: false,
      items: patient ? demoHistory(patient) : [],
    });
  }
}

function demoHistory(patient: DemoPatientRecord): PatientChartHistoryDto['items'] {
  const items: PatientChartHistoryDto['items'][number][] = [];
  if (patient.nextAppointment) {
    items.push({
      id: `${patient.id}-booked`,
      kind: 'APPOINTMENT_BOOKED',
      occurredAt: patient.createdAt,
      appointmentStart: patient.nextAppointment,
      label: null,
      targetType: null,
      targetId: null,
    });
  }
  items.push({
    id: `${patient.id}-created`,
    kind: 'PATIENT_CREATED',
    occurredAt: patient.createdAt,
    appointmentStart: null,
    label: null,
    targetType: null,
    targetId: null,
  });
  return items;
}

function ageOn(dateOfBirth: string): number {
  const [year = 0, month = 1, day = 1] = dateOfBirth.split('-').map(Number);
  const beforeBirthday = month > 11 || (month === 11 && day > 10);
  return 2026 - year - (beforeBirthday ? 1 : 0);
}

@Component({
  selector: 'app-patient-chart-demo-page',
  imports: [ProductionPatientChartPage],
  providers: [{ provide: PatientChartApiService, useClass: DemoPatientChartApi }],
  template: `<app-patient-chart-page />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientChartPage {}
