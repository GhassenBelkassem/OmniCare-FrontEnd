import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { AuthTokenStore } from '../../core/auth/auth-token.store';
import { httpErrorCode } from '../../core/http/app-http-error';
import { RealtimeService } from '../../core/realtime/realtime.service';
import type { ScheduledCareEvent } from '../../core/realtime/live-event.models';
import { ClinicalOrderApiService } from './clinical-order-api.service';
import { EMPTY_ORDER_DEFINITION, type ClinicalOrder, type ClinicalOrderCategory, type ClinicalOrderDefinition } from './clinical-order.models';

interface Editor { readonly orderId: string | null; readonly category: ClinicalOrderCategory; readonly original: ClinicalOrderDefinition; readonly draft: ClinicalOrderDefinition; }
interface Pending { readonly key: string; readonly fingerprint: string; }

@Injectable({ providedIn: 'root' })
export class ClinicalOrderStore {
  private readonly api = inject(ClinicalOrderApiService);
  private readonly realtime = inject(RealtimeService);
  private readonly tokens = inject(AuthTokenStore);
  private readonly destroyRef = inject(DestroyRef);
  private consultationId: string | null = null;
  private ownerId: string | null = this.currentDoctorId();
  private generation = 0;
  private pending: Pending | null = null;
  private pendingFinalize: Pending | null = null;

  readonly orders = signal<readonly ClinicalOrder[]>([]);
  readonly editor = signal<Editor | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly finalizingId = signal<string | null>(null);
  readonly failure = signal<string | null>(null);
  readonly validationFailure = signal(false);
  readonly conflict = signal(false);
  readonly newerVersionAvailable = signal(false);
  readonly dirty = computed(() => { const e = this.editor(); return e !== null && fingerprint(e.draft) !== fingerprint(e.original); });

  constructor() {
    this.realtime.scheduledCareEvents$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event) => this.invalidate(event));
    effect(() => {
      const owner = this.currentDoctorId();
      if (owner === this.ownerId) return;
      this.ownerId = owner; this.clear();
    });
  }

  attach(id: string): void { if (this.consultationId === id) return; this.clear(); this.consultationId = id; void this.refresh(); }
  beginCreate(category: ClinicalOrderCategory): void {
    this.editor.set({ orderId: null, category, original: EMPTY_ORDER_DEFINITION, draft: EMPTY_ORDER_DEFINITION });
    this.resetOperationState();
  }
  beginEdit(order: ClinicalOrder): void {
    if (order.status !== 'DRAFT') return;
    this.editor.set({ orderId: order.clinicalOrderId, category: order.category, original: order.definition, draft: order.definition });
    this.resetOperationState();
  }
  cancelEdit(): void { this.editor.set(null); this.resetOperationState(); }
  setValue(value: string): void {
    const editor = this.editor(); if (editor === null) return;
    const text = value.trim().length === 0 ? null : value;
    const draft: ClinicalOrderDefinition = editor.category === 'LAB'
      ? { ...EMPTY_ORDER_DEFINITION, requestedExamination: text }
      : editor.category === 'IMAGING'
        ? { ...EMPTY_ORDER_DEFINITION, requestedStudy: text }
        : { ...EMPTY_ORDER_DEFINITION, targetSpecialty: text };
    if (this.pending?.fingerprint !== fingerprint(draft)) this.pending = null;
    this.editor.set({ ...editor, draft }); this.failure.set(null); this.validationFailure.set(text === null);
  }

  async refresh(force = false): Promise<void> {
    const id = this.consultationId; if (id === null || this.loading()) return;
    if (!force && (this.dirty() || this.saving())) { this.newerVersionAvailable.set(true); return; }
    const generation = this.generation; this.loading.set(true); this.failure.set(null);
    try {
      const result = await firstValueFrom(this.api.list(id));
      if (generation !== this.generation || id !== this.consultationId) return;
      this.orders.set(result.orders); this.editor.set(null); this.conflict.set(false); this.newerVersionAvailable.set(false); this.pending = null;
    } catch (error: unknown) { if (generation === this.generation) this.failure.set(code(error)); }
    finally { if (generation === this.generation) this.loading.set(false); }
  }

  async save(): Promise<void> {
    const id = this.consultationId; const editor = this.editor();
    if (id === null || editor === null || this.saving()) return;
    if (!valid(editor)) { this.validationFailure.set(true); return; }
    this.validationFailure.set(false);
    const fp = `${editor.orderId ?? 'new'}:${editor.category}:${fingerprint(editor.draft)}`;
    if (this.pending === null || this.pending.fingerprint !== fp) this.pending = { key: operationKey('order-save'), fingerprint: fp };
    const pending = this.pending; const generation = this.generation; this.saving.set(true); this.failure.set(null); this.conflict.set(false);
    try {
      let saved: ClinicalOrder;
      if (editor.orderId === null) saved = await firstValueFrom(this.api.create(id, editor.category, editor.draft, pending.key));
      else {
        const authoritative = this.orders().find((order) => order.clinicalOrderId === editor.orderId);
        if (authoritative === undefined) return;
        saved = await firstValueFrom(this.api.update(id, authoritative, editor.draft, pending.key));
      }
      if (generation !== this.generation) return;
      this.orders.update((orders) => [...orders.filter((order) => order.clinicalOrderId !== saved.clinicalOrderId), saved]);
      this.editor.set(null); this.pending = null; this.newerVersionAvailable.set(false);
    } catch (error: unknown) {
      if (generation !== this.generation) return;
      const failure = code(error); this.failure.set(failure); if (failure === 'CLINICAL_ORDER_VERSION_CONFLICT') this.conflict.set(true);
      if (!ambiguous(error)) this.pending = null;
    } finally { if (generation === this.generation) this.saving.set(false); }
  }

  async finalize(order: ClinicalOrder): Promise<void> {
    const id = this.consultationId; if (id === null || order.status !== 'DRAFT' || this.finalizingId() !== null) return;
    const fp = `${order.clinicalOrderId}:${order.clinicalOrderVersion}:${fingerprint(order.definition)}`;
    if (this.pendingFinalize === null || this.pendingFinalize.fingerprint !== fp) this.pendingFinalize = { key: operationKey('order-finalize'), fingerprint: fp };
    const operation = this.pendingFinalize; const generation = this.generation; this.finalizingId.set(order.clinicalOrderId); this.failure.set(null);
    try {
      const saved = await firstValueFrom(this.api.finalize(id, order, operation.key));
      if (generation !== this.generation) return;
      this.orders.update((orders) => orders.map((value) => value.clinicalOrderId === saved.clinicalOrderId ? saved : value));
      if (this.editor()?.orderId === saved.clinicalOrderId) this.editor.set(null);
      this.pendingFinalize = null;
    } catch (error: unknown) { if (generation === this.generation) { const failure = code(error); this.failure.set(failure); if (failure === 'CLINICAL_ORDER_VERSION_CONFLICT') this.conflict.set(true); if (!ambiguous(error)) this.pendingFinalize = null; } }
    finally { if (generation === this.generation) this.finalizingId.set(null); }
  }

  clear(): void { this.generation++; this.consultationId = null; this.orders.set([]); this.editor.set(null); this.loading.set(false); this.saving.set(false); this.finalizingId.set(null); this.failure.set(null); this.validationFailure.set(false); this.conflict.set(false); this.newerVersionAvailable.set(false); this.pending = null; this.pendingFinalize = null; }
  private resetOperationState(): void { this.failure.set(null); this.validationFailure.set(false); this.conflict.set(false); this.newerVersionAvailable.set(false); this.pending = null; }
  private currentDoctorId(): string | null { const user = this.tokens.user(); return user?.role === 'DOCTOR' ? user.id : null; }
  private invalidate(event: ScheduledCareEvent): void {
    if (event.eventType !== 'CLINICAL_ORDER_UPDATED' || event.resourceType !== 'CLINICAL_ORDER' || this.consultationId === null) return;
    if (this.dirty() || this.saving()) { this.newerVersionAvailable.set(true); return; }
    void this.refresh();
  }
}

function valid(editor: Editor): boolean { return label(editor.category, editor.draft).trim().length > 0; }
function label(category: ClinicalOrderCategory, value: ClinicalOrderDefinition): string { return category === 'LAB' ? value.requestedExamination ?? '' : category === 'IMAGING' ? value.requestedStudy ?? '' : value.targetSpecialty ?? ''; }
function fingerprint(value: ClinicalOrderDefinition): string { return JSON.stringify(value); }
function operationKey(prefix: string): string { return `${prefix}:${globalThis.crypto.randomUUID()}`; }
function code(error: unknown): string { return httpErrorCode(error) ?? 'MRS_UNAVAILABLE'; }
function ambiguous(error: unknown): boolean { return error instanceof HttpErrorResponse && (error.status === 0 || error.status >= 500); }
