import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { ActiveConsultationApiService } from './active-consultation-api.service';
import type { ActiveConsultation } from './active-consultation.models';
import { ClinicalRecordStore } from './clinical-record.store';
import { ConsultationFinishStore } from './consultation-finish.store';
import { ActiveConsultationStore } from './active-consultation.store';

const ID = '11111111-1111-4111-8111-111111111111';
const ACTIVE: ActiveConsultation = {
  consultationId: ID, sourceType: 'SCHEDULED_APPOINTMENT', sourceId: '22222222-2222-4222-8222-222222222222',
  status: 'IN_PROGRESS', medicalAccessStatus: 'ACTIVE', version: 4,
  startedAt: '2026-10-27T10:00:00Z', completedAt: null,
};

describe('ConsultationFinishStore', () => {
  let get: ReturnType<typeof vi.fn>;
  let finish: ReturnType<typeof vi.fn>;
  let dirty: ReturnType<typeof vi.fn>;
  let store: ConsultationFinishStore;
  let clearActive: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    get = vi.fn().mockReturnValue(of(ACTIVE));
    finish = vi.fn();
    dirty = vi.fn().mockReturnValue(false);
    clearActive = vi.fn();
    TestBed.configureTestingModule({ providers: [
      ConsultationFinishStore,
      { provide: ActiveConsultationApiService, useValue: { get, finish } },
      { provide: ClinicalRecordStore, useValue: {
        dirty,
        authoritative: () => ({ clinicalRecordVersion: 7, schemaVersion: 2, clinicalRecord: {} }),
      } },
      { provide: ActiveConsultationStore, useValue: { clear: clearActive } },
    ] });
    store = TestBed.inject(ConsultationFinishStore);
    await store.attach(ID);
  });

  afterEach(() => TestBed.resetTestingModule());

  it('refuses unsaved client memory before sending Finish', async () => {
    dirty.mockReturnValue(true);
    await store.finish();
    expect(finish).not.toHaveBeenCalled();
    expect(store.failure()).toBe('UNSAVED_CLINICAL_CHANGES');
  });

  it('retries an ambiguous response with the same key and expected versions', async () => {
    finish.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 0 })))
      .mockReturnValueOnce(of({ ...ACTIVE, status: 'COMPLETED', version: 6,
        medicalAccessStatus: 'EXPIRED', completedAt: '2026-10-27T10:30:00Z' }));
    await store.finish();
    const first = finish.mock.calls[0];
    await store.finish();
    const second = finish.mock.calls[1];
    expect(second.slice(1)).toEqual(first.slice(1));
    expect(store.consultation()?.status).toBe('COMPLETED');
    expect(clearActive).toHaveBeenCalledOnce();
  });

  it('uses only the canonical endpoint response as completion authority', async () => {
    finish.mockReturnValue(of({ ...ACTIVE, status: 'FINALIZING', version: 5 }));
    await store.finish();
    expect(store.consultation()?.status).toBe('FINALIZING');
    expect(finish).toHaveBeenCalledWith(ID, 4, 7, expect.any(String));
  });
});
