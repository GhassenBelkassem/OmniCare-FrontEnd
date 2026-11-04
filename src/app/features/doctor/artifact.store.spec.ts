import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { AuthTokenStore } from '../../core/auth/auth-token.store';
import type { AuthenticatedUser } from '../../core/auth/auth.models';
import type { ScheduledCareEvent } from '../../core/realtime/live-event.models';
import { RealtimeService } from '../../core/realtime/realtime.service';
import { ArtifactApiService } from './artifact-api.service';
import type { ArtifactResponse } from './artifact.models';
import { ArtifactStore } from './artifact.store';

const CONSULTATION = '11111111-1111-4111-8111-111111111111';
const ARTIFACT = '22222222-2222-4222-8222-222222222222';
const V1: ArtifactResponse = {
  artifactId: ARTIFACT, consultationId: CONSULTATION, artifactType: 'MEDICAL_CERTIFICATE',
  artifactVersion: 1, status: 'DRAFT', sourceResourceId: null, sourceResourceVersion: null,
  definition: { certificate: { statement: 'Attendance confirmed.' } },
  renderStatus: 'WAITING_FOR_COMPLETION', renderVersion: 1, checksumSha256: null,
  sizeBytes: null, pageCount: null, verificationReference: null, signedAt: null,
  createdAt: '2026-10-26T10:00:00Z', updatedAt: '2026-10-26T10:00:00Z',
};

describe('ArtifactStore', () => {
  const user = signal<AuthenticatedUser | null>({ id: 'doctor-1', role: 'DOCTOR', mustChangePassword: false });
  let events: Subject<ScheduledCareEvent>;
  let list: ReturnType<typeof vi.fn>;
  let createSource: ReturnType<typeof vi.fn>;
  let update: ReturnType<typeof vi.fn>;
  let finalize: ReturnType<typeof vi.fn>;
  let store: ArtifactStore;

  beforeEach(async () => {
    user.set({ id: 'doctor-1', role: 'DOCTOR', mustChangePassword: false });
    events = new Subject();
    list = vi.fn().mockReturnValue(of({ artifacts: [V1] }));
    createSource = vi.fn();
    update = vi.fn();
    finalize = vi.fn();
    TestBed.configureTestingModule({ providers: [
      { provide: ArtifactApiService, useValue: {
        list, update, finalize, createCertificate: vi.fn(), createSource, download: vi.fn(),
      } },
      { provide: RealtimeService, useValue: { scheduledCareEvents$: events } },
      { provide: AuthTokenStore, useValue: { user } },
    ] });
    store = TestBed.inject(ArtifactStore);
    store.attach(CONSULTATION);
    TestBed.flushEffects();
    await vi.waitFor(() => expect(store.artifacts()).toHaveLength(1));
  });

  afterEach(() => TestBed.resetTestingModule());

  it('keeps its Consultation binding when the authenticated owner effect initializes', () => {
    expect(list).toHaveBeenCalledTimes(1);
    expect(store.artifacts()).toEqual([V1]);
  });

  it('creates a source artifact once and suppresses duplicate clicks and existing sources', async () => {
    const sourceId = '33333333-3333-4333-8333-333333333333';
    const created: ArtifactResponse = { ...V1, artifactId: '44444444-4444-4444-8444-444444444444',
      artifactType: 'LAB_ORDER', sourceResourceId: sourceId, sourceResourceVersion: 2, definition: { source: {} } };
    const response = new Subject<ArtifactResponse>();
    createSource.mockReturnValue(response);

    const first = store.createSource('LAB_ORDER', sourceId, 2);
    const duplicateWhilePending = store.createSource('LAB_ORDER', sourceId, 2);
    expect(createSource).toHaveBeenCalledTimes(1);
    expect(createSource.mock.calls[0].slice(0, 4)).toEqual([CONSULTATION, 'LAB_ORDER', sourceId, 2]);
    response.next(created); response.complete();
    await Promise.all([first, duplicateWhilePending]);
    expect(store.artifacts()).toContainEqual(created);

    await store.createSource('LAB_ORDER', sourceId, 2);
    expect(createSource).toHaveBeenCalledTimes(1);
  });

  it('shows a safe source-artifact backend failure', async () => {
    createSource.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409,
      error: { errorCode: 'ARTIFACT_SOURCE_NOT_FINALIZED' } })));
    await store.createSource('LAB_ORDER', '33333333-3333-4333-8333-333333333333', 1);
    expect(store.failure()).toBe('ARTIFACT_SOURCE_NOT_FINALIZED');
  });

  it('uses CAS and preserves a dirty draft across realtime invalidation', async () => {
    store.edit(V1);
    store.change({ statement: 'Local unsaved statement' });
    events.next({ eventId: 'e1', eventType: 'ARTIFACT_UPDATED', resourceType: 'ARTIFACT',
      resourceId: ARTIFACT, version: 2, occurredAt: '2026-10-26T10:01:00Z' });
    expect(store.newerVersionAvailable()).toBe(true);
    expect(store.draft().statement).toBe('Local unsaved statement');
    expect(list).toHaveBeenCalledTimes(1);

    update.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409,
      error: { errorCode: 'ARTIFACT_VERSION_CONFLICT' } })));
    await store.save();
    expect(update.mock.calls[0][2]).toBe(1);
    expect(store.conflict()).toBe(true);
    expect(store.draft().statement).toBe('Local unsaved statement');
  });

  it('retries ambiguous save and finalization with stable keys', async () => {
    store.edit(V1);
    store.change({ statement: 'Retry this statement' });
    update.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 0 })))
      .mockReturnValueOnce(of({ ...V1, artifactVersion: 2,
        definition: { certificate: { statement: 'Retry this statement' } } }));
    await store.save();
    const saveKey = update.mock.calls[0][4];
    await store.save();
    expect(update.mock.calls[1][4]).toBe(saveKey);

    const v2 = store.artifacts()[0];
    finalize.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 503 })))
      .mockReturnValueOnce(of({ ...v2, status: 'FINALIZED' }));
    await store.finalize(v2);
    const finalizeKey = finalize.mock.calls[0][2];
    await store.finalize(v2);
    expect(finalize.mock.calls[1][2]).toBe(finalizeKey);
    expect(store.artifacts()[0].status).toBe('FINALIZED');
  });

  it('clears certificate PHI on account change', () => {
    store.edit(V1);
    user.set(null);
    TestBed.flushEffects();
    expect(store.artifacts()).toEqual([]);
    expect(store.draft()).toEqual({});
  });
});
