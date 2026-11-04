import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ArtifactStore } from '../artifact.store';
import type { ArtifactResponse, CertificateDefinition } from '../artifact.models';
import { ClinicalOrderStore } from '../clinical-order.store';
import type { ClinicalOrder } from '../clinical-order.models';
import { PrescriptionStore } from '../prescription.store';
import type { PrescriptionResponse } from '../prescription.models';
import { OfficialArtifacts } from './official-artifacts';

const CONSULTATION = '11111111-1111-4111-8111-111111111111';
const SOURCE = '22222222-2222-4222-8222-222222222222';
const LAB: ClinicalOrder = { clinicalOrderId: SOURCE, consultationId: CONSULTATION, category: 'LAB',
  status: 'FINALIZED', clinicalOrderVersion: 2, schemaVersion: 1,
  definition: { requestedExamination: 'Synthetic examination', requestedStudy: null, targetSpecialty: null } };
const LAB_ARTIFACT: ArtifactResponse = { artifactId: '33333333-3333-4333-8333-333333333333',
  consultationId: CONSULTATION, artifactType: 'LAB_ORDER', artifactVersion: 1, status: 'DRAFT',
  sourceResourceId: SOURCE, sourceResourceVersion: 2, definition: { source: {} },
  renderStatus: 'WAITING_FOR_COMPLETION', renderVersion: 1, checksumSha256: null, sizeBytes: null,
  pageCount: null, verificationReference: null, signedAt: null,
  createdAt: '2026-10-27T10:00:00Z', updatedAt: '2026-10-27T10:00:00Z' };
const ACTIVE_PRESCRIPTION: PrescriptionResponse = { prescriptionId: '44444444-4444-4444-8444-444444444444',
  prescriptionVersion: 1, clinicalRecordVersion: 2, schemaVersion: 2, status: 'ACTIVE', finalized: true,
  signedAt: '2026-10-27T10:00:00Z', signatureAlgorithm: 'ED25519_SHA256',
  medicationDecision: 'MEDICATION_PRESCRIBED', prescription: { medications: [], generalInstructions: null } };

describe('OfficialArtifacts', () => {
  let fixture: ComponentFixture<OfficialArtifacts>;
  const artifacts = signal<readonly ArtifactResponse[]>([]);
  const orders = signal<readonly ClinicalOrder[]>([LAB]);
  const prescription = signal<PrescriptionResponse | null>(ACTIVE_PRESCRIPTION);
  const saving = signal(false);
  const loading = signal(false);
  const failure = signal<string | null>(null);
  const createSource = vi.fn();
  const begin = vi.fn();
  const artifactStore = {
    artifacts, saving, loading, failure, editorId: signal<string | null>(null), draft: signal<CertificateDefinition>({}),
    dirty: signal(false), newerVersionAvailable: signal(false), attach: vi.fn(), clear: vi.fn(), begin,
    change: vi.fn(), save: vi.fn(), edit: vi.fn(), finalize: vi.fn(), download: vi.fn(), createSource,
  };

  beforeEach(async () => {
    artifacts.set([]); orders.set([LAB]); prescription.set(ACTIVE_PRESCRIPTION); saving.set(false); loading.set(false); failure.set(null);
    createSource.mockReset(); begin.mockReset(); artifactStore.attach.mockReset(); artifactStore.clear.mockReset();
    await TestBed.configureTestingModule({ imports: [OfficialArtifacts], providers: [
      { provide: ArtifactStore, useValue: artifactStore },
      { provide: ClinicalOrderStore, useValue: { orders } },
      { provide: PrescriptionStore, useValue: { authoritative: prescription } },
    ] }).compileComponents();
    fixture = TestBed.createComponent(OfficialArtifacts);
    fixture.componentRef.setInput('consultationId', CONSULTATION);
    fixture.detectChanges(); TestBed.flushEffects(); fixture.detectChanges();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('enables a finalized LAB source and passes its exact id and version once', async () => {
    let complete!: () => void;
    createSource.mockImplementation(() => { saving.set(true); return new Promise<void>((resolve) => { complete = () => {
      artifacts.set([LAB_ARTIFACT]); saving.set(false); resolve();
    }; }); });
    const button = findButton('Créer le PDF laboratoire');
    expect(button.disabled).toBe(false);
    button.click(); button.click();
    expect(createSource).toHaveBeenCalledTimes(1);
    expect(createSource).toHaveBeenCalledWith('LAB_ORDER', SOURCE, 2);
    complete(); await fixture.whenStable(); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Ordre laboratoire');
    expect(findOptionalButton('Créer le PDF laboratoire')).toBeUndefined();
  });

  it('displays an existing LAB artifact and does not offer duplicate creation', () => {
    artifacts.set([LAB_ARTIFACT]); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Ordre laboratoire');
    expect(findOptionalButton('Créer le PDF laboratoire')).toBeUndefined();
    expect(createSource).not.toHaveBeenCalled();
  });

  it('does not offer source creation before the authoritative artifact list loads', () => {
    loading.set(true); fixture.detectChanges();
    expect(findOptionalButton('Créer le PDF laboratoire')).toBeUndefined();
    expect(findOptionalButton('Créer le PDF ordonnance')).toBeUndefined();
  });

  it('keeps a non-finalized LAB source unavailable with an explanation', () => {
    orders.set([{ ...LAB, status: 'DRAFT' }]); fixture.detectChanges();
    expect(findOptionalButton('Créer le PDF laboratoire')).toBeUndefined();
    expect(fixture.nativeElement.textContent).toContain('Finalisez l’ordre de laboratoire');
  });

  it('enables an ACTIVE signed prescription source and hides a non-finalized one', () => {
    const button = findButton('Créer le PDF ordonnance');
    expect(button.disabled).toBe(false);
    button.click();
    expect(createSource).toHaveBeenCalledWith('PRESCRIPTION', ACTIVE_PRESCRIPTION.prescriptionId,
      ACTIVE_PRESCRIPTION.prescriptionVersion);
    createSource.mockClear();
    prescription.set({ ...ACTIVE_PRESCRIPTION, status: 'DRAFT', finalized: false, signedAt: null,
      signatureAlgorithm: null }); fixture.detectChanges();
    expect(findOptionalButton('Créer le PDF ordonnance')).toBeUndefined();
    expect(createSource).not.toHaveBeenCalled();
  });

  it('shows a safe backend failure and keeps certificate authoring paths unchanged', () => {
    createSource.mockImplementation(() => { failure.set('ARTIFACT_SOURCE_NOT_FINALIZED'); return Promise.resolve(); });
    findButton('Créer le PDF laboratoire').click(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain('ARTIFACT_SOURCE_NOT_FINALIZED');
    findButton('Certificat médical').click(); findButton('Congé maladie').click();
    expect(begin.mock.calls).toEqual([['MEDICAL_CERTIFICATE'], ['SICK_LEAVE_CERTIFICATE']]);
  });

  function findButton(label: string): HTMLButtonElement {
    const button = findOptionalButton(label); if (button === undefined) throw new Error(`Missing button: ${label}`); return button;
  }
  function findOptionalButton(label: string): HTMLButtonElement | undefined {
    return Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
      .find((button) => button.textContent?.trim() === label);
  }
});
