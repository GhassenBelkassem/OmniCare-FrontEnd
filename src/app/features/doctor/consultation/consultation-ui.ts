import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';

import { ConsultationFinishFlow } from './consultation-finish.flow';
import { ConsultationSessionStore } from './consultation-session.store';
import type { ChecklistTarget } from './model/consultation-errors';

export interface ConfirmRequest {
  readonly title: string;
  readonly message: string;
  readonly confirmLabel: string;
  readonly destructive?: boolean;
}

/** The page's section cards. Errors are revealed per section. */
export type ConsultationSection = 'motif' | 'diagnostic' | 'dossier' | 'traitement' | 'examens' | 'suivi' | 'documents';

export const CONSULTATION_SECTIONS: readonly ConsultationSection[] = [
  'motif', 'diagnostic', 'dossier', 'traitement', 'examens', 'suivi', 'documents',
];

/** Element id of the field each checklist / readiness item scrolls to. */
export const CHECKLIST_ANCHORS: Readonly<Record<ChecklistTarget, string>> = {
  motif: 'consultation-motif',
  diagnostic: 'consultation-diagnostic',
  traitement: 'consultation-traitement',
  suivi: 'consultation-suivi',
  examens: 'consultation-examens',
  documents: 'consultation-documents',
  dossier: 'consultation-dossier',
};

export const DISCARD_MESSAGE = 'Les informations saisies dans cette partie seront supprimées.';

/** A click inside an overlay (select menu, date panel, dialog) within this delay is not a « leave ». */
const OVERLAY_POINTER_GRACE_MS = 400;

/** Section that owns an error key (server path or row-scoped key). */
export function sectionOfKey(key: string): ConsultationSection {
  if (key.startsWith('clinicalRecord.diagnoses')) return 'diagnostic';
  if (key.startsWith('clinicalRecord.medicalSummaryUpdate')) return 'dossier';
  if (key.startsWith('clinicalRecord.medicationDecision') || key.startsWith('prescription')) return 'traitement';
  if (key.startsWith('clinicalRecord.followUp')) return 'suivi';
  if (key.startsWith('order:')) return 'examens';
  if (key.startsWith('artifact:')) return 'documents';
  return 'motif';
}

export function isInsideOverlay(node: Node | null): boolean {
  if (node === null) return false;
  const element = node instanceof Element ? node : node.parentElement;
  return Boolean(element?.closest('.cdk-overlay-container'));
}

/**
 * Page-scoped UI state shared by the section components.
 *
 * Error timing (P2c): an error is revealed when focus leaves its section, or by a « Terminer »
 * attempt (all sections). A revealed error re-validates live: it disappears as soon as the field
 * is fixed, and a new error (or the same one coming back) waits until the section is left again.
 * Nothing new turns red while the doctor is typing in a section.
 */
@Injectable()
export class ConsultationUi {
  private readonly session = inject(ConsultationSessionStore);
  private readonly flow = inject(ConsultationFinishFlow);
  private readonly revealed = signal<ReadonlySet<string>>(new Set());
  private lastOverlayPointer = 0;
  private resolveConfirm: ((value: boolean) => void) | null = null;

  readonly confirmRequest = signal<ConfirmRequest | null>(null);
  /** « Dossier patient » side panel. */
  readonly recordOpen = signal(false);
  /** G-1 D5 « Compléter les coordonnées » side panel (external patients, from the « Terminer » warning). */
  readonly contactOpen = signal(false);

  /** Every current error: live client rules, finish rules after an attempt, server field errors. */
  readonly currentErrors = computed<Readonly<Record<string, string>>>(() => ({
    ...this.session.clientErrors(),
    ...(this.flow.attempted() ? this.flow.finishErrors() : {}),
    ...this.session.serverErrors(),
  }));

  readonly visibleErrors = computed<Readonly<Record<string, string>>>(() => {
    const revealed = this.revealed();
    return Object.fromEntries(Object.entries(this.currentErrors()).filter(([key]) => revealed.has(key)));
  });

  constructor() {
    // A fixed field leaves the revealed set: if it breaks again, it waits for the next leave.
    effect(() => {
      const current = this.currentErrors();
      untracked(() => {
        const revealed = this.revealed();
        const kept = [...revealed].filter((key) => key in current);
        if (kept.length !== revealed.size) this.revealed.set(new Set(kept));
      });
    });

    const onPointerDown = (event: Event): void => {
      if (isInsideOverlay(event.target as Node | null)) this.lastOverlayPointer = Date.now();
    };
    globalThis.document?.addEventListener('pointerdown', onPointerDown, true);
    globalThis.document?.addEventListener('mousedown', onPointerDown, true);
    inject(DestroyRef).onDestroy(() => {
      globalThis.document?.removeEventListener('pointerdown', onPointerDown, true);
      globalThis.document?.removeEventListener('mousedown', onPointerDown, true);
    });
  }

  error(key: string): string | null {
    return this.visibleErrors()[key] ?? null;
  }

  /** First visible error whose key is `prefix` or starts with `prefix.`. */
  errorUnder(prefix: string): string | null {
    const entry = Object.entries(this.visibleErrors()).find(([key]) => key === prefix || key.startsWith(`${prefix}.`));
    return entry?.[1] ?? null;
  }

  /** Focus left the section: reveal its current errors. */
  leaveSection(section: ConsultationSection): void {
    const keys = Object.keys(this.currentErrors()).filter((key) => sectionOfKey(key) === section);
    this.reveal(keys);
  }

  /** After a « Terminer » attempt: reveal every current error. */
  revealAll(): void {
    this.reveal(Object.keys(this.currentErrors()));
  }

  /** True right after a click inside an overlay (select menu, date panel, dialog). */
  pointerInOverlayRecently(): boolean {
    return Date.now() - this.lastOverlayPointer < OVERLAY_POINTER_GRACE_MS;
  }

  confirm(request: ConfirmRequest): Promise<boolean> {
    this.resolveConfirm?.(false);
    this.confirmRequest.set(request);
    return new Promise((resolve) => {
      this.resolveConfirm = resolve;
    });
  }

  answerConfirm(value: boolean): void {
    const resolve = this.resolveConfirm;
    this.resolveConfirm = null;
    this.confirmRequest.set(null);
    resolve?.(value);
  }

  scrollTo(target: ChecklistTarget): void {
    this.focusElement(globalThis.document?.getElementById(CHECKLIST_ANCHORS[target]) ?? null);
  }

  /** After a failed « Terminer »: scroll to and focus the first field marked invalid. */
  scrollToFirstError(): void {
    setTimeout(() => {
      const first = globalThis.document?.querySelector<HTMLElement>(
        '.consultation-main [aria-invalid="true"], .consultation-main [data-invalid="true"]',
      );
      this.focusElement(first ?? null);
    });
  }

  private reveal(keys: readonly string[]): void {
    if (keys.length === 0) return;
    const current = this.revealed();
    if (keys.every((key) => current.has(key))) return;
    this.revealed.set(new Set([...current, ...keys]));
  }

  private focusElement(element: HTMLElement | null): void {
    if (element === null) return;
    element.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    const focusable = element.matches('input, textarea, button, [tabindex]')
      ? element
      : element.querySelector<HTMLElement>('input, textarea, button:not([disabled]), [tabindex]:not([tabindex="-1"])');
    focusable?.focus({ preventScroll: true });
  }
}
