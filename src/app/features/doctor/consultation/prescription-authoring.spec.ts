import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Subject, of, throwError } from 'rxjs';

import { AuthTokenStore } from '../../../core/auth/auth-token.store';
import type { AuthenticatedUser } from '../../../core/auth/auth.models';
import type { ScheduledCareEvent } from '../../../core/realtime/live-event.models';
import { RealtimeService } from '../../../core/realtime/realtime.service';
import { ClinicalRecordStore } from '../clinical-record.store';
import { PrescriptionApiService } from '../prescription-api.service';
import type { PrescriptionContent, PrescriptionResponse } from '../prescription.models';
import { PrescriptionStore } from '../prescription.store';
import { PrescriptionAuthoring } from './prescription-authoring';

const CONSULTATION_ID = '11111111-1111-4111-8111-111111111111';
const NONE: PrescriptionResponse = {
  prescriptionId: null,
  prescriptionVersion: 0,
  clinicalRecordVersion: 2,
  schemaVersion: 2,
  status: 'NONE',
  finalized: false,
  signedAt: null,
  signatureAlgorithm: null,
  medicationDecision: 'MEDICATION_PRESCRIBED',
  prescription: null,
};
const MEDICATION: PrescriptionContent['medications'][number] = {
  itemId: '22222222-2222-4222-8222-222222222222',
  replacesItemId: null,
  medicationCode: null,
  name: 'Synthetic medicine',
  strength: null,
  dose: { amount: 1, unit: 'mg' },
  route: 'ORAL',
  frequency: { timesPerDay: 1, text: null },
  duration: null,
  quantity: null,
  instructions: null,
};

describe('PrescriptionAuthoring', () => {
  const user = signal<AuthenticatedUser | null>({ id: 'doctor-1', role: 'DOCTOR', mustChangePassword: false });
  let fixture: ComponentFixture<PrescriptionAuthoring>;
  let save: ReturnType<typeof vi.fn>;
  let store: PrescriptionStore;

  afterEach(() => TestBed.resetTestingModule());

  it('shows the editor for IN_PROGRESS, MEDICATION_PRESCRIBED and NONE/version 0', async () => {
    await setup(NONE, 'MEDICATION_PRESCRIBED');

    expect(text()).toContain('version 0');
    expect(button('Ajouter un médicament')).not.toBeNull();
    expect(button('Enregistrer')).not.toBeNull();
  });

  it('creates version 0 once and renders the authoritative DRAFT v1', async () => {
    await setup(NONE, 'MEDICATION_PRESCRIBED');
    save.mockImplementation((_id, _version, prescription: PrescriptionContent) => of({
      ...NONE,
      prescriptionId: '33333333-3333-4333-8333-333333333333',
      prescriptionVersion: 1,
      status: 'DRAFT',
      prescription,
    }));

    button('Ajouter un médicament')!.click();
    fixture.detectChanges();
    button('Enregistrer')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(
      CONSULTATION_ID,
      0,
      expect.objectContaining({ medications: [expect.objectContaining({ dose: { amount: 1, unit: 'mg' }, route: 'ORAL' })] }),
      expect.stringMatching(/^prescription-save:/),
    );
    expect(text()).toContain('version 1');
    expect(store.authoritative()?.status).toBe('DRAFT');
  });

  it('does not offer authoring for NO_MEDICATION', async () => {
    await setup({ ...NONE, medicationDecision: 'NO_MEDICATION' }, 'NO_MEDICATION');

    expect(button('Ajouter un médicament')).toBeNull();
    expect(button('Enregistrer')).toBeNull();
    expect(text()).toContain('Aucune prescription à rédiger');
  });

  it('keeps a DRAFT editable', async () => {
    await setup(draft(), 'MEDICATION_PRESCRIBED');

    expect((fixture.nativeElement.querySelector('fieldset') as HTMLFieldSetElement).disabled).toBe(false);
    expect(button('Ajouter un médicament')).not.toBeNull();
    expect(button('Enregistrer')).not.toBeNull();
  });

  it('renders an ACTIVE prescription read-only', async () => {
    await setup({ ...draft(), status: 'ACTIVE', finalized: true }, 'MEDICATION_PRESCRIBED');

    expect((fixture.nativeElement.querySelector('fieldset') as HTMLFieldSetElement).disabled).toBe(true);
    expect(button('Ajouter un médicament')).toBeNull();
    expect(button('Enregistrer')).toBeNull();
  });

  it.each(['FINALIZING', 'COMPLETED', 'ABORTED'] as const)('does not author while the consultation is %s', async (status) => {
    await setup(NONE, 'MEDICATION_PRESCRIBED', status);

    expect(button('Ajouter un médicament')).toBeNull();
    expect(button('Enregistrer')).toBeNull();
  });

  it('shows a safe backend error and preserves the draft', async () => {
    await setup(NONE, 'MEDICATION_PRESCRIBED');
    save.mockReturnValue(throwError(() => new HttpErrorResponse({
      status: 503,
      error: { code: 'MRS_UNAVAILABLE', message: 'internal detail must not render' },
    })));
    button('Ajouter un médicament')!.click();
    fixture.detectChanges();

    button('Enregistrer')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain('L’opération a échoué');
    expect(text()).not.toContain('internal detail must not render');
    expect(store.draft().medications).toHaveLength(1);
  });

  it('does not duplicate Save while the first request is pending', async () => {
    await setup(NONE, 'MEDICATION_PRESCRIBED');
    const response = new Subject<PrescriptionResponse>();
    save.mockReturnValue(response);
    button('Ajouter un médicament')!.click();
    fixture.detectChanges();
    const saveButton = button('Enregistrer')!;

    saveButton.click();
    saveButton.click();

    expect(save).toHaveBeenCalledTimes(1);
  });

  async function setup(
    response: PrescriptionResponse,
    decision: 'MEDICATION_PRESCRIBED' | 'NO_MEDICATION',
    status: 'IN_PROGRESS' | 'FINALIZING' | 'COMPLETED' | 'ABORTED' = 'IN_PROGRESS',
  ): Promise<void> {
    user.set({ id: 'doctor-1', role: 'DOCTOR', mustChangePassword: false });
    const clinical = signal({ clinicalRecordVersion: 2, clinicalRecord: { medicationDecision: decision } });
    save = vi.fn();
    TestBed.configureTestingModule({
      imports: [PrescriptionAuthoring],
      providers: [
        PrescriptionStore,
        { provide: PrescriptionApiService, useValue: { read: vi.fn().mockReturnValue(of(response)), save, finalize: vi.fn() } },
        { provide: ClinicalRecordStore, useValue: { authoritative: clinical, dirty: signal(false) } },
        { provide: RealtimeService, useValue: { scheduledCareEvents$: new Subject<ScheduledCareEvent>() } },
        { provide: AuthTokenStore, useValue: { user } },
      ],
    });
    fixture = TestBed.createComponent(PrescriptionAuthoring);
    fixture.componentRef.setInput('consultationId', CONSULTATION_ID);
    fixture.componentRef.setInput('consultationStatus', status);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    store = TestBed.inject(PrescriptionStore);
  }

  function button(label: string): HTMLButtonElement | null {
    return fixture.debugElement.queryAll(By.css('button'))
      .map((element) => element.nativeElement as HTMLButtonElement)
      .find((element) => element.textContent?.trim() === label) ?? null;
  }

  function text(): string { return fixture.nativeElement.textContent ?? ''; }
});

function draft(): PrescriptionResponse {
  return {
    ...NONE,
    prescriptionId: '33333333-3333-4333-8333-333333333333',
    prescriptionVersion: 1,
    status: 'DRAFT',
    prescription: { medications: [MEDICATION], generalInstructions: null },
  };
}
