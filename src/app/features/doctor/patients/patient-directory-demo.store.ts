import { Injectable, computed, signal } from '@angular/core';

import { PracticePatientDto } from '../practice-patient-api.models';
import {
  DEMO_PATIENT_DIRECTORY,
  DemoPatientRecord,
  demoPatientFullName,
} from './patient-directory-demo.fixtures';

@Injectable({ providedIn: 'root' })
export class PatientDirectoryDemoStore {
  readonly addedPatients = signal<readonly DemoPatientRecord[]>([]);
  readonly patients = computed(() => [...this.addedPatients(), ...DEMO_PATIENT_DIRECTORY]);

  add(patient: PracticePatientDto): DemoPatientRecord {
    const created: DemoPatientRecord = {
      id: patient.id,
      firstName: patient.firstName,
      lastName: patient.lastName,
      dateOfBirth: patient.dateOfBirth ?? '1990-01-01',
      sex: patient.sex ?? 'autre',
      phone: patient.phone,
      email: patient.email,
      address: patient.address,
      insuranceNumber: `DEMO-${this.addedPatients().length + 1}`,
      source: patient.source,
      linkage: patient.linkedOmniCareUserId
        ? 'LINKED'
        : patient.possibleOmniCareMatch
          ? 'POSSIBLE'
          : 'UNLINKED',
      category: patient.linkedOmniCareUserId ? 'LINKED' : 'CABINET',
      lastConsultation: null,
      nextAppointment: null,
      createdAt: patient.createdAt,
    };
    this.addedPatients.update((patients) => [created, ...patients]);
    return created;
  }

  find(id: string): DemoPatientRecord | null {
    return this.patients().find((patient) => patient.id === id) ?? null;
  }

  createdMessage(patient: DemoPatientRecord): string {
    return `${demoPatientFullName(patient)} a été ajouté à la démo.`;
  }
}
