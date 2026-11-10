import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ActiveConsultationStore } from '../active-consultation.store';
import type { ActiveConsultation, ConsultationStatus } from '../active-consultation.models';
import { ArtifactStore } from '../artifact.store';
import { ClinicalOrderStore } from '../clinical-order.store';
import { ClinicalRecordStore } from '../clinical-record.store';
import { ConsultationFinishStore } from '../consultation-finish.store';
import { MedicalRecordStore } from '../medical-record.store';
import { PrescriptionStore } from '../prescription.store';
import { UrgentCabinetClinicalStore } from '../urgent-cabinet-clinical.store';
import { ConsultationPage } from './consultation-page';

const ID = '11111111-1111-4111-8111-111111111111';

describe('ConsultationPage production workflow', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    TestBed.resetTestingModule();
  });

  it('attaches only a canonical consultation identifier', () => {
    const canonical = createPage(ID);
    expect(canonical.page.canonicalRoute).toBe(true);
    expect(canonical.finish.attach).toHaveBeenCalledWith(ID);

    TestBed.resetTestingModule();
    const legacy = createPage('new');
    expect(legacy.page.canonicalRoute).toBe(false);
    expect(legacy.finish.attach).not.toHaveBeenCalled();
  });

  it('derives finish eligibility from authoritative state and all dirty/busy domains', () => {
    const clean = createPage(ID);
    expect(clean.page.viewModel().canFinish).toBe(true);

    clean.clinical.dirty.set(true);
    expect(clean.page.hasUnsavedChanges()).toBe(true);
    expect(clean.page.viewModel().canFinish).toBe(false);

    clean.clinical.dirty.set(false);
    clean.orders.finalizingId.set('order-1');
    expect(clean.page.viewModel().canFinish).toBe(false);
  });

  it.each(['FINALIZING', 'COMPLETED', 'ABORTED'] as const)(
    'does not expose finish or save in terminal/non-editable status %s',
    (status) => {
      const { page } = createPage(ID, status);

      expect(page.viewModel().canFinish).toBe(false);
      expect(page.viewModel().canSave).toBe(false);
    },
  );

  it('routes save to the active clinical domain without copying domain state', async () => {
    const { page, prescription } = createPage(ID);
    prescription.dirty.set(true);
    page.handleWorkspaceAction({ kind: 'SET_SECTION', section: 'prescription' });

    page.handleWorkspaceAction({ kind: 'SAVE_ACTIVE' });
    await Promise.resolve();

    expect(prescription.save).toHaveBeenCalledOnce();
  });

  it('opens the compact readiness review before finishing', async () => {
    const { page, finish } = createPage(ID);

    page.handleWorkspaceAction({ kind: 'FINISH' });
    await Promise.resolve();

    expect(page.activeSection()).toBe('finalization');
    expect(finish.review).toHaveBeenCalledOnce();
    expect(finish.finish).not.toHaveBeenCalled();
  });

  it.each([
    ['MEDICATION_DECISION', 'note'],
    ['PRESCRIPTION_NOT_FINALIZED', 'prescription'],
    ['ORDER_NOT_FINALIZED', 'orders'],
    ['ARTIFACT_NOT_FINALIZED', 'documents'],
  ] as const)('routes missing readiness %s to %s', (code, section) => {
    const { page } = createPage(ID);

    page.resolveReadiness(code);

    expect(page.activeSection()).toBe(section);
  });

  it('opens the selected canonical order and certificate flows', () => {
    const { page, orders, artifacts } = createPage(ID);

    page.openAction('imaging');
    expect(page.activeSection()).toBe('orders');
    expect(orders.beginCreate).toHaveBeenCalledWith('IMAGING');

    page.openAction('sick-leave-certificate');
    expect(page.activeSection()).toBe('documents');
    expect(artifacts.begin).toHaveBeenCalledWith('SICK_LEAVE_CERTIFICATE');
  });

  it('prompts only when a clinical domain has unsaved state', () => {
    const { page, artifacts } = createPage(ID);
    const confirm = vi.fn().mockReturnValue(false);
    vi.stubGlobal('window', { confirm });

    expect(page.canDeactivate()).toBe(true);
    artifacts.dirty.set(true);
    expect(page.canDeactivate()).toBe(false);
    expect(confirm).toHaveBeenCalledOnce();
  });
});

function createPage(id: string, status: ConsultationStatus = 'IN_PROGRESS') {
  const consultation: ActiveConsultation = {
    consultationId: ID,
    sourceType: 'SCHEDULED_APPOINTMENT',
    sourceId: 'appointment-1',
    status,
    medicalAccessStatus: status === 'COMPLETED' ? 'EXPIRED' : 'ACTIVE',
    version: 4,
    startedAt: '2026-11-08T08:00:00Z',
    completedAt: status === 'COMPLETED' ? '2026-11-08T08:30:00Z' : null,
  };
  const domain = () => ({
    dirty: signal(false),
    saving: signal(false),
    failure: signal<string | null>(null),
    conflict: signal(false),
    save: vi.fn().mockResolvedValue(undefined),
  });
  const clinical = {
    ...domain(),
    authoritative: signal({ clinicalRecordVersion: 2, schemaVersion: 1, clinicalRecord: {} }),
  };
  const prescription = { ...domain(), finalizing: signal(false) };
  const orders = {
    ...domain(),
    finalizingId: signal<string | null>(null),
    beginCreate: vi.fn(),
  };
  const artifacts = { ...domain(), begin: vi.fn() };
  const finish = {
    consultation: signal<ActiveConsultation | null>(consultation),
    submitting: signal(false),
    failure: signal<string | null>(null),
    reviewing: signal(false),
    readiness: signal(null),
    attach: vi.fn().mockResolvedValue(undefined),
    review: vi.fn().mockResolvedValue(undefined),
    finish: vi.fn().mockResolvedValue(undefined),
  };
  const medicalRecord = {
    workspace: signal(null),
    loading: signal(false),
    failure: signal(null),
    attach: vi.fn(),
    clear: vi.fn(),
  };

  TestBed.configureTestingModule({
    providers: [
      { provide: Router, useValue: { navigate: vi.fn().mockResolvedValue(true) } },
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: convertToParamMap({ id }) } },
      },
      { provide: ActiveConsultationStore, useValue: { active: signal(consultation) } },
      { provide: ClinicalRecordStore, useValue: clinical },
      { provide: PrescriptionStore, useValue: prescription },
      { provide: ClinicalOrderStore, useValue: orders },
      { provide: ArtifactStore, useValue: artifacts },
      { provide: ConsultationFinishStore, useValue: finish },
      { provide: MedicalRecordStore, useValue: medicalRecord },
      { provide: UrgentCabinetClinicalStore, useValue: { protectedIntake: signal(null) } },
    ],
  });

  const page = TestBed.runInInjectionContext(() => new ConsultationPage());
  return { page, clinical, prescription, orders, artifacts, finish };
}
