import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ActiveConsultation } from '../active-consultation.models';
import type { DoctorMedicalRecordWorkspace } from '../medical-record.models';
import { MedicalRecordStore } from '../medical-record.store';
import { DoctorMedicalWorkspace } from './doctor-medical-workspace';

const ID = '11111111-1111-4111-8111-111111111111';

const external: ActiveConsultation = {
  consultationId: ID,
  sourceType: 'SCHEDULED_APPOINTMENT',
  sourceId: 'appointment-1',
  status: 'IN_PROGRESS',
  medicalAccessStatus: 'NONE',
  version: 0,
  startedAt: '2026-11-10T08:00:00Z',
  access: { mode: 'EXTERNAL_OWNER' },
};

const workspace: DoctorMedicalRecordWorkspace = {
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
  essentialInformation: { bloodType: null, allergies: [], criticalConditions: [] },
  currentMedications: [],
  consultationSummaries: { items: [], nextCursor: null },
  documents: { state: 'DEFERRED' },
};

@Component({
  imports: [DoctorMedicalWorkspace],
  template: '<app-doctor-medical-workspace [consultation]="consultation()" />',
})
class Host {
  readonly consultation = signal<ActiveConsultation>(external);
}

describe('DoctorMedicalWorkspace access display', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('shows an external owner the record with no access or sharing message', () => {
    const { text, store } = render(external, workspace);

    expect(store.attach).toHaveBeenCalledWith(ID);
    expect(text).toContain('Dossier de votre patient');
    expect(text).toContain('Informations essentielles');
    expect(text).toContain('Aucune consultation antérieure.');
    expect(text).not.toContain('Partage du dossier requis');
    expect(text).not.toContain('Accès historique');
    expect(text).not.toContain('non partagée');
    expect(text).not.toContain('MRS');
    expect(text).not.toContain('jalon');
  });

  it('keeps the OmniCare view without a grant unchanged', () => {
    const omniCare: ActiveConsultation = { ...external, access: { mode: 'OMNICARE_RESTRICTED' } };
    const { text, store } = render(omniCare, null);

    expect(store.attach).not.toHaveBeenCalled();
    expect(text).toContain('Partage du dossier requis');
    expect(text).toContain('Accès historique NONE');
  });
});

function render(consultation: ActiveConsultation, value: DoctorMedicalRecordWorkspace | null) {
  const store = {
    workspace: signal(value),
    loading: signal(false),
    failure: signal<string | null>(null),
    attach: vi.fn(),
    clear: vi.fn(),
    refresh: vi.fn(),
  };
  TestBed.configureTestingModule({ providers: [{ provide: MedicalRecordStore, useValue: store }] });
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.consultation.set(consultation);
  fixture.detectChanges();
  TestBed.tick();
  fixture.detectChanges();
  return { text: (fixture.nativeElement as HTMLElement).textContent ?? '', store };
}
