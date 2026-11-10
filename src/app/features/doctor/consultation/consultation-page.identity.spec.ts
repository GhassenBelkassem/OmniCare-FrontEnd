import { Component, input, output, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OMNICARE_ICONS } from '../../../app.icons';
import { ActiveConsultationStore } from '../active-consultation.store';
import type { ActiveConsultation } from '../active-consultation.models';
import { ArtifactStore } from '../artifact.store';
import { ClinicalOrderStore } from '../clinical-order.store';
import { ClinicalRecordStore } from '../clinical-record.store';
import { ConsultationFinishStore } from '../consultation-finish.store';
import type { DoctorMedicalRecordWorkspace } from '../medical-record.models';
import { MedicalRecordStore } from '../medical-record.store';
import { PrescriptionStore } from '../prescription.store';
import { UrgentCabinetClinicalStore } from '../urgent-cabinet-clinical.store';
import { ClinicalAuthoring } from './clinical-authoring';
import { ClinicalOrders } from './clinical-orders';
import { ConsultationPage } from './consultation-page';
import { DoctorMedicalWorkspace } from './doctor-medical-workspace';
import { OfficialArtifacts } from './official-artifacts';
import { PrescriptionAuthoring } from './prescription-authoring';

const ID = '11111111-1111-4111-8111-111111111111';
const CHART = '0454ccd2-df3a-4544-9f15-2836b3302322';

@Component({ selector: 'app-clinical-authoring', template: '' })
class ClinicalAuthoringStub {
  readonly consultationId = input('');
  readonly actionRequested = output<string>();
}
@Component({ selector: 'app-prescription-authoring', template: '' })
class PrescriptionAuthoringStub {
  readonly consultationId = input('');
  readonly consultationStatus = input<string>('');
}
@Component({ selector: 'app-clinical-orders', template: '' })
class ClinicalOrdersStub {
  readonly consultationId = input('');
}
@Component({ selector: 'app-official-artifacts', template: '' })
class OfficialArtifactsStub {
  readonly consultationId = input('');
}
@Component({ selector: 'app-doctor-medical-workspace', template: '' })
class DoctorMedicalWorkspaceStub {
  readonly consultation = input<ActiveConsultation | null>(null);
}

const externalConsultation: ActiveConsultation = {
  consultationId: ID,
  sourceType: 'SCHEDULED_APPOINTMENT',
  sourceId: 'appointment-1',
  status: 'IN_PROGRESS',
  // Custody is not a grant: the projection stays NONE for an external patient.
  medicalAccessStatus: 'NONE',
  version: 0,
  startedAt: '2026-11-10T08:00:00Z',
  completedAt: null,
  access: { mode: 'EXTERNAL_OWNER' },
  patient: {
    chartId: CHART,
    patientType: 'EXTERNAL',
    firstName: 'mechergui',
    lastName: 'marwa',
    fullName: 'mechergui marwa',
    ageYears: 20,
    ageApproximate: true,
    sex: 'M',
    dateOfBirth: null,
  },
};

const restrictedOmniCare: ActiveConsultation = {
  ...externalConsultation,
  access: { mode: 'OMNICARE_RESTRICTED' },
  patient: {
    ...externalConsultation.patient!,
    chartId: '22222222-2222-4222-8222-222222222222',
    patientType: 'OMNICARE',
    firstName: 'Salma',
    lastName: 'Trabelsi',
    fullName: 'Salma Trabelsi',
    ageYears: 34,
    ageApproximate: false,
    sex: 'F',
    dateOfBirth: '1992-03-04',
  },
};

const ownerWorkspace: DoctorMedicalRecordWorkspace = {
  consultation: { consultationId: ID, status: 'IN_PROGRESS', medicalAccessStatus: 'NONE', version: 0 },
  access: {
    state: 'ACTIVE',
    mode: 'EXTERNAL_OWNER',
    expiresAt: null,
    sections: {
      ESSENTIAL_INFORMATION: 'AUTHORIZED',
      CURRENT_MEDICATIONS: 'AUTHORIZED',
      CONSULTATION_SUMMARIES: 'AUTHORIZED',
      DOCUMENTS: 'DEFERRED',
    },
  },
  essentialInformation: { bloodType: 'A+', allergies: ['pénicilline'], criticalConditions: ['asthme'] },
  currentMedications: [],
  consultationSummaries: { items: [], nextCursor: null },
  documents: { state: 'DEFERRED' },
};

describe('ConsultationPage patient identity and medical context', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('shows the external patient in the header with age, sex and tag, and no reference', () => {
    const { element } = render(externalConsultation);
    const strip = element.querySelector('.patient-strip')!.textContent!.replace(/\s+/gu, ' ');

    expect(element.querySelector('.patient-strip h2')!.textContent!.trim()).toBe('mechergui marwa');
    expect(element.querySelector('.patient-avatar')!.textContent!.trim()).toBe('MM');
    expect(strip).toContain('environ 20 ans');
    expect(strip).toContain('Homme');
    expect(strip).toContain('Patient externe');
    expect(strip).not.toContain('Identité patient non disponible');
    expect(strip).not.toContain('Référence');
    expect(strip).not.toContain('Aucun accès médical');
    expect(element.querySelector('a.patient-strip__link')!.getAttribute('href')).toBe(`/doctor/patient/${CHART}`);
  });

  it('loads the medical context for an external owner although no grant exists', () => {
    const { element, medicalRecord } = render(externalConsultation, ownerWorkspace);
    const context = element.querySelector('.patient-context')!.textContent!;

    expect(medicalRecord.attach).toHaveBeenCalledWith(ID);
    expect(medicalRecord.clear).not.toHaveBeenCalled();
    expect(context).toContain('pénicilline');
    expect(context).toContain('asthme');
    expect(context).not.toContain('Historique non partagé');
    expect(context).not.toContain('Non partagé');
    expect(context).not.toContain('QR');
  });

  it('never shows an access message to an external owner while loading or on failure', () => {
    const loading = render(externalConsultation);
    expect(loading.element.querySelector('.patient-context')!.textContent).toContain('Chargement du dossier médical');

    TestBed.resetTestingModule();
    const failed = render(externalConsultation, null, 'MRS_UNAVAILABLE');
    const text = failed.element.querySelector('.patient-context')!.textContent!;
    expect(text).toContain('Le dossier médical n’a pas pu être chargé.');
    expect(text).not.toContain('Historique non partagé');
    expect(failed.element.textContent).not.toContain('Aucun accès médical');
  });

  it('keeps the OmniCare restricted view unchanged and never loads the context', () => {
    const { element, medicalRecord } = render(restrictedOmniCare);
    const strip = element.querySelector('.patient-strip')!.textContent!;
    const context = element.querySelector('.patient-context')!.textContent!;

    expect(medicalRecord.attach).not.toHaveBeenCalled();
    expect(medicalRecord.clear).toHaveBeenCalled();
    expect(strip).toContain('Salma Trabelsi');
    expect(strip).toContain('Patient OmniCare');
    expect(strip).toContain('Aucun accès médical');
    expect(context).toContain('Résumé autorisé en lecture seule. La saisie de la consultation reste disponible sans partage QR.');
    expect(context).toContain('Historique non partagé pour ce contexte de soins.');
  });

  it('falls back to the grant projection when the server sends no access mode', () => {
    const legacy: ActiveConsultation = {
      ...restrictedOmniCare,
      access: null,
      patient: null,
      medicalAccessStatus: 'ACTIVE',
    };
    const { element, medicalRecord } = render(legacy);

    expect(medicalRecord.attach).toHaveBeenCalledWith(ID);
    expect(element.querySelector('.patient-strip h2')!.textContent!.trim()).toBe('Patient');
    expect(element.querySelector('.patient-strip')!.textContent).toContain('Accès médical actif');
  });
});

function render(
  consultation: ActiveConsultation,
  workspace: DoctorMedicalRecordWorkspace | null = null,
  failure: string | null = null,
) {
  const domain = () => ({
    dirty: signal(false),
    saving: signal(false),
    failure: signal<string | null>(null),
    conflict: signal(false),
    save: vi.fn().mockResolvedValue(undefined),
  });
  const medicalRecord = {
    workspace: signal(workspace),
    loading: signal(false),
    failure: signal(failure),
    attach: vi.fn(),
    clear: vi.fn(),
    refresh: vi.fn(),
  };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideNzIcons(OMNICARE_ICONS),
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: ID }) } } },
      { provide: ActiveConsultationStore, useValue: { active: signal(consultation) } },
      {
        provide: ClinicalRecordStore,
        useValue: { ...domain(), authoritative: signal({ clinicalRecordVersion: 0, schemaVersion: 3, clinicalRecord: {} }) },
      },
      { provide: PrescriptionStore, useValue: { ...domain(), finalizing: signal(false) } },
      { provide: ClinicalOrderStore, useValue: { ...domain(), finalizingId: signal<string | null>(null), beginCreate: vi.fn() } },
      { provide: ArtifactStore, useValue: { ...domain(), begin: vi.fn() } },
      { provide: MedicalRecordStore, useValue: medicalRecord },
      { provide: UrgentCabinetClinicalStore, useValue: { protectedIntake: signal(null) } },
    ],
  });
  const finish = {
    consultation: signal<ActiveConsultation | null>(consultation),
    submitting: signal(false),
    failure: signal<string | null>(null),
    reviewing: signal(false),
    readiness: signal(null),
    attach: vi.fn().mockResolvedValue(undefined),
    refresh: vi.fn().mockResolvedValue(undefined),
    review: vi.fn().mockResolvedValue(undefined),
    finish: vi.fn().mockResolvedValue(undefined),
  };
  TestBed.overrideComponent(ConsultationPage, {
    remove: {
      imports: [ClinicalAuthoring, PrescriptionAuthoring, ClinicalOrders, OfficialArtifacts, DoctorMedicalWorkspace],
      providers: [ConsultationFinishStore],
    },
    add: {
      imports: [
        ClinicalAuthoringStub,
        PrescriptionAuthoringStub,
        ClinicalOrdersStub,
        OfficialArtifactsStub,
        DoctorMedicalWorkspaceStub,
      ],
      // ConsultationFinishStore is provided by the page component itself.
      providers: [{ provide: ConsultationFinishStore, useValue: finish }],
    },
  });
  const fixture = TestBed.createComponent(ConsultationPage);
  fixture.detectChanges();
  TestBed.tick();
  fixture.detectChanges();
  return { element: fixture.nativeElement as HTMLElement, medicalRecord };
}
