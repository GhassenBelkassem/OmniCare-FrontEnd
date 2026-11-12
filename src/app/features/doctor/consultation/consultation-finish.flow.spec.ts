import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ConsultationFinishFlow, FINISH_POLL_TIMEOUT_MS } from './consultation-finish.flow';
import { ConsultationSessionStore } from './consultation-session.store';
import { SickLeaveTemplatePicker } from './sick-leave-template-picker';
import {
  COMPLETE_NOTE,
  CONSULTATION_ID,
  DRAFT_PRESCRIPTION,
  certificate,
  consultation,
  createFakes,
  fakeProviders,
  order,
  record,
  type FakeOptions,
  type Fakes,
} from './testing/consultation-harness';

async function setup(options: FakeOptions = {}): Promise<{ flow: ConsultationFinishFlow; session: ConsultationSessionStore; fakes: Fakes }> {
  const fakes = createFakes({
    record: record(COMPLETE_NOTE),
    prescription: DRAFT_PRESCRIPTION,
    orders: [order()],
    artifacts: [certificate()],
    ...options,
  });
  TestBed.configureTestingModule({ providers: [...fakeProviders(fakes), ConsultationSessionStore, ConsultationFinishFlow, SickLeaveTemplatePicker] });
  const session = TestBed.inject(ConsultationSessionStore);
  const flow = TestBed.inject(ConsultationFinishFlow);
  await session.load(CONSULTATION_ID);
  fakes.log.length = 0;
  fakes.consultations.get.mockClear();
  return { flow, session, fakes };
}

describe('ConsultationFinishFlow', () => {
  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  it('signs the prescription, validates each order, signs each document, reads readiness, then finishes — in that order', async () => {
    const { flow, fakes } = await setup();
    expect(await flow.requestFinish()).toBe(true);
    expect(flow.confirmOpen()).toBe(true);
    expect(fakes.consultations.finish).not.toHaveBeenCalled();

    await flow.confirmFinish();

    expect(fakes.log).toEqual([
      'prescription.finalize',
      'order.finalize',
      'artifact.finalize',
      'consultation.get',
      'consultation.readiness',
      'consultation.finish',
    ]);
    expect(fakes.prescriptions.finalize).toHaveBeenCalledWith(CONSULTATION_ID, 2, 1, expect.stringMatching(/^consultation-rx:/));
    expect(flow.phase()).toBe('done');
    expect(fakes.active.refresh).toHaveBeenCalled();
  });

  it('stops before any signature when a required item is missing, and lists it', async () => {
    const { flow, fakes } = await setup({ record: record({ ...COMPLETE_NOTE, followUp: { required: false, recommendedAt: null, decision: null } }) });
    expect(await flow.requestFinish()).toBe(false);
    expect(flow.missing().map((item) => item.label)).toEqual(['Suivi']);
    expect(flow.confirmOpen()).toBe(false);
    expect(fakes.log).toEqual([]);
    expect(flow.finishErrors()['clinicalRecord.followUp.decision']).toBe('Choisissez le suivi recommandé.');
  });

  it('maps readiness missing[] to French checklist labels (CHIEF_COMPLAINT_MISSING included) and does not finish', async () => {
    const { flow, fakes } = await setup();
    fakes.consultations.finishReadiness.mockReturnValue(of({
      ready: false, clinicalRecordSaved: true, diagnosisReady: true, medicationDecisionReady: true, followUpReady: true,
      prescriptionReady: true, ordersReady: true, artifactsReady: true, missing: ['CHIEF_COMPLAINT_MISSING', 'ORDER_NOT_FINALIZED'],
    }));
    await flow.confirmFinish();
    expect(flow.missing()).toEqual([
      { label: 'Motif de consultation', target: 'motif' },
      { label: 'Examens à valider', target: 'examens' },
    ]);
    expect(fakes.consultations.finish).not.toHaveBeenCalled();
    expect(flow.phase()).toBe('idle');
  });

  it('a failure midway leaves the consultation open; « Terminer » again skips what is already signed', async () => {
    const { flow, session, fakes } = await setup();
    fakes.consultations.finish.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500, error: { errorCode: 'INTERNAL_SERVER_ERROR', detail: 'Boom in English' } })));

    await flow.confirmFinish();
    expect(flow.phase()).toBe('idle');
    expect(flow.error()).toBe('L’opération n’a pas abouti. Réessayez dans un instant.');
    expect(session.prescriptionSigned()).toBe(true);
    const firstKey = fakes.consultations.finish.mock.calls[0][3];

    fakes.log.length = 0;
    await flow.confirmFinish();
    expect(fakes.log).toEqual(['consultation.get', 'consultation.readiness', 'consultation.finish']);
    expect(fakes.consultations.finish.mock.calls[1][3]).toBe(firstKey);
    expect(flow.phase()).toBe('done');
  });

  it('409 FINISH_IN_PROGRESS is not a success: it polls the status every Retry-After seconds until COMPLETED', async () => {
    vi.useFakeTimers();
    const { flow, fakes } = await setup();
    fakes.consultations.finish.mockReturnValue(throwError(() => new HttpErrorResponse({
      status: 409, error: { errorCode: 'FINISH_IN_PROGRESS', status: 409 }, headers: new HttpHeaders({ 'Retry-After': '2' }),
    })));
    fakes.consultations.get
      .mockReturnValueOnce(of(consultation()))
      .mockReturnValueOnce(of(consultation({ status: 'FINALIZING' })))
      .mockReturnValueOnce(of(consultation({ status: 'COMPLETED' })));

    const running = flow.confirmFinish();
    await vi.advanceTimersByTimeAsync(0);
    expect(flow.phase()).toBe('pending');
    expect(flow.buttonLabel()).toBe('Clôture en cours…');
    await vi.advanceTimersByTimeAsync(2000);
    expect(flow.phase()).toBe('pending');
    await vi.advanceTimersByTimeAsync(2000);
    await running;
    expect(flow.phase()).toBe('done');
    expect(fakes.consultations.get).toHaveBeenCalledTimes(3);
  });

  it('503 MRS_CONTEXT_PENDING polls at most 2 minutes, then asks to retry', async () => {
    vi.useFakeTimers();
    const { flow, fakes } = await setup();
    fakes.consultations.finish.mockReturnValue(throwError(() => new HttpErrorResponse({
      status: 503, error: { errorCode: 'MRS_CONTEXT_PENDING' }, headers: new HttpHeaders({ 'Retry-After': '2' }),
    })));
    fakes.consultations.get.mockReturnValue(of(consultation()));
    fakes.consultations.get.mockReturnValueOnce(of(consultation())).mockReturnValue(of(consultation({ status: 'FINALIZING' })));

    const running = flow.confirmFinish();
    await vi.advanceTimersByTimeAsync(FINISH_POLL_TIMEOUT_MS + 4000);
    await running;
    expect(flow.phase()).toBe('idle');
    expect(flow.error()).toBe('La clôture prend plus de temps que prévu.');
    expect(flow.canResume()).toBe(true);
  });

  it('refuses to finish while a save is failing (nothing is signed)', async () => {
    const { flow, session, fakes } = await setup();
    fakes.clinical.save.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { errorCode: 'CLINICAL_RECORD_VERSION_CONFLICT' } })));
    session.updateNote({ chiefComplaint: 'Fièvre et toux' });
    expect(await flow.requestFinish()).toBe(false);
    expect(flow.error()).toBe('Cette consultation a été modifiée ailleurs.');
    expect(fakes.prescriptions.finalize).not.toHaveBeenCalled();
  });

  describe('closure after a reload (P3a)', () => {
    const finalizing = (finishState: 'RUNNING' | 'FAILED' | null) => consultation({ status: 'FINALIZING', version: 4, finishState });

    it('« Reprendre la clôture » re-sends finish with the captured versions left to the server (null), without the clinical-record read', async () => {
      vi.useFakeTimers();
      const { flow, fakes } = await setup({ consultation: finalizing('RUNNING') });
      expect(fakes.clinical.read).not.toHaveBeenCalled();
      fakes.consultations.get.mockReturnValue(of(finalizing('RUNNING')));
      const polling = flow.pollUntilClosed(2);
      await vi.advanceTimersByTimeAsync(FINISH_POLL_TIMEOUT_MS + 4000);
      await polling;
      expect(flow.canResume()).toBe(true);

      fakes.consultations.finish.mockReturnValue(of(consultation({ status: 'COMPLETED', version: 5 })));
      await flow.resumeClosure();
      expect(fakes.consultations.finish).toHaveBeenCalledWith(CONSULTATION_ID, 4, null, expect.stringMatching(/^consultation-resume:/));
      expect(fakes.clinical.read).not.toHaveBeenCalled();
      expect(fakes.consultations.finishReadiness).not.toHaveBeenCalled();
      expect(flow.phase()).toBe('done');
    });

    it('a failed closure is final for the doctor: no polling, no resume', async () => {
      const { flow, fakes } = await setup({ consultation: finalizing('FAILED') });
      expect(flow.closureFailed()).toBe(true);
      await flow.pollUntilClosed(2);
      expect(fakes.consultations.get).not.toHaveBeenCalled();
      await flow.resumeClosure();
      expect(fakes.consultations.finish).not.toHaveBeenCalled();
      expect(flow.canResume()).toBe(false);
    });

    it('stops polling as soon as the server reports the closure failed', async () => {
      vi.useFakeTimers();
      const { flow, fakes } = await setup({ consultation: finalizing('RUNNING') });
      fakes.consultations.get.mockReturnValueOnce(of(finalizing('RUNNING'))).mockReturnValue(of(finalizing('FAILED')));
      const polling = flow.pollUntilClosed(2);
      await vi.advanceTimersByTimeAsync(4000);
      await polling;
      expect(fakes.consultations.get).toHaveBeenCalledTimes(2);
      expect(flow.closureFailed()).toBe(true);
      expect(flow.canResume()).toBe(false);
      expect(flow.phase()).toBe('idle');
    });

    it('409 CONSULTATION_FINISH_FAILED on resume re-reads the consultation (failed state, no retry offered)', async () => {
      vi.useFakeTimers();
      const { flow, fakes } = await setup({ consultation: finalizing('RUNNING') });
      fakes.consultations.get.mockReturnValue(of(finalizing('RUNNING')));
      const polling = flow.pollUntilClosed(2);
      await vi.advanceTimersByTimeAsync(FINISH_POLL_TIMEOUT_MS + 4000);
      await polling;
      fakes.consultations.finish.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { errorCode: 'CONSULTATION_FINISH_FAILED' } })));
      fakes.consultations.get.mockReturnValue(of(finalizing('FAILED')));
      await flow.resumeClosure();
      expect(flow.closureFailed()).toBe(true);
      expect(flow.canResume()).toBe(false);
    });
  });
});
