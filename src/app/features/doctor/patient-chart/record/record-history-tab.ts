import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';

import { OcButton, OcDateBlock, OcFileCard, OcTag } from '../../../../shared/ui';
import { ChartAccessRequired } from '../chart-access-required';
import { PatientChartApiService } from '../patient-chart-api.service';
import { consultationStatusLabel } from '../patient-chart-format';
import type { RecordConsultationDetail, RecordConsultationDocument, RecordConsultationItem } from './patient-record.models';
import { PatientRecordStore } from './patient-record.store';
import {
  currentConsultationLine,
  diagnosisStatusLabel,
  documentCards,
  followUpLabel,
  medicationTags,
  orderCategoryLabel,
  saveBlob,
  searchKey,
  tunisTime,
  type DocumentCard,
} from './record-format';

/**
 * « Historique »: the consultation history as expandable cards, collapsed by default. A card's
 * detail is fetched when it is first expanded (one request per card). RESTRICTED: dates, doctor
 * and status only, nothing expandable, one « Accès requis » block.
 */
@Component({
  selector: 'app-record-history-tab',
  imports: [NgTemplateOutlet, NzIconModule, NzInputModule, NzSkeletonModule, OcButton, OcDateBlock, OcFileCard, OcTag, ChartAccessRequired],
  template: `
    <section class="r-card" aria-labelledby="history-title">
      <div class="h-head">
        <div class="r-heading">
          <span class="r-tile r-tile--care" aria-hidden="true"><nz-icon nzType="history" /></span>
          <div class="r-heading__text">
            <h3 id="history-title">Historique des consultations</h3>
            @if (store.historyState() === 'ready') {
              <p data-testid="history-count">{{ countLabel() }}</p>
            } @else {
              <p>Visites, diagnostics et ordonnances</p>
            }
          </div>
        </div>
        @if (store.historyState() === 'ready' && clinicalView()) {
          <nz-input-group class="h-search" [nzPrefix]="searchIcon">
            <input
              nz-input
              type="search"
              placeholder="Rechercher un motif ou un diagnostic"
              aria-label="Rechercher un motif ou un diagnostic"
              [value]="query()"
              (input)="query.set(text($event))"
            />
          </nz-input-group>
          <ng-template #searchIcon><nz-icon nzType="search" aria-hidden="true" /></ng-template>
        }
      </div>

      @switch (store.historyState()) {
        @case ('ready') {
          @if (!clinicalView()) { <app-chart-access-required /> }

          <ul class="h-list">
            @if (current(); as now) {
              <li class="h-current" data-testid="current-consultation">
                <span class="h-current__dot" aria-hidden="true"></span>
                <div class="h-current__text">
                  <p class="h-current__title">Consultation actuelle</p>
                  <p class="h-current__meta">{{ now.line }}</p>
                </div>
                <oc-tag tone="current">En cours</oc-tag>
              </li>
            }
            @for (item of visible(); track item.id) {
              <li class="h-card" [class.h-card--open]="isOpen(item.id)" [id]="'history-' + item.id">
                @if (expandable(item)) {
                  <button
                    type="button"
                    class="h-card__head h-card__head--button"
                    [attr.aria-expanded]="isOpen(item.id)"
                    [attr.aria-controls]="'history-detail-' + item.id"
                    (click)="toggle(item.id)"
                  >
                    <ng-container *ngTemplateOutlet="summary; context: { $implicit: item }" />
                    <span class="h-chevron" aria-hidden="true"><nz-icon [nzType]="isOpen(item.id) ? 'up' : 'down'" /></span>
                  </button>
                  @if (isOpen(item.id)) {
                    <div class="h-detail" [id]="'history-detail-' + item.id">
                      @let detail = store.details().get(item.id);
                      @switch (detail?.state) {
                        @case ('ready') {
                          @if (detail?.data; as data) {
                            @if (data.clinicalAvailable) {
                              <ng-container *ngTemplateOutlet="body; context: { $implicit: data }" />
                            } @else {
                              <p class="r-empty">Le contenu de cette consultation n’est pas disponible.</p>
                            }
                          }
                        }
                        @case ('error') {
                          <p class="r-error" role="alert">Le détail n’a pas pu être chargé.
                            <oc-button size="small" (click)="store.loadDetail(item.id)">Réessayer</oc-button></p>
                        }
                        @case ('denied') { <app-chart-access-required /> }
                        @default { <nz-skeleton [nzActive]="true" [nzTitle]="false" [nzParagraph]="{ rows: 3 }" /> }
                      }
                    </div>
                  }
                } @else {
                  <div class="h-card__head">
                    <ng-container *ngTemplateOutlet="summary; context: { $implicit: item }" />
                  </div>
                }
              </li>
            } @empty {
              @if (!current()) {
                <li class="r-empty">{{ query() ? 'Aucune consultation trouvée.' : 'Aucune consultation pour le moment.' }}</li>
              }
            }
          </ul>
          @if (store.nextCursor()) {
            <oc-button size="small" variant="outline" [loading]="store.loadingMore()" (click)="store.loadMore()">Afficher plus</oc-button>
          }
          @if (downloadError(); as message) { <p class="r-error" role="alert">{{ message }}</p> }
        }
        @case ('error') {
          <p class="r-error" role="alert">L’historique n’a pas pu être chargé.
            <oc-button size="small" (click)="store.loadHistory(true)">Réessayer</oc-button></p>
        }
        @case ('denied') { <app-chart-access-required /> }
        @default { <nz-skeleton [nzActive]="true" [nzTitle]="false" [nzParagraph]="{ rows: 4 }" /> }
      }
    </section>

    <!-- Card summary: date block, motif, « Dr … · spécialité · HH:mm », status. Phrasing content only (inside a button). -->
    <ng-template #summary let-item>
      <oc-date-block [date]="item.date" [tone]="item.id === mostRecentId() ? 'care' : 'neutral'" />
      <span class="h-card__text">
        <span class="h-card__title">{{ title(item) }}</span>
        @if (meta(item); as line) { <span class="h-card__meta">{{ line }}</span> }
      </span>
      <oc-tag tone="neutral">{{ statusLabel(item.status) }}</oc-tag>
    </ng-template>

    <ng-template #body let-data>
      <div class="h-tiles">
        <div class="r-info" data-testid="detail-diagnosis">
          <p class="r-label">Diagnostic</p>
          @for (diagnosis of data.diagnoses ?? []; track $index) {
            <p class="h-diagnosis">
              <span>{{ diagnosis.label }}</span>
              @if (diagnosisStatus(diagnosis.status); as label) {
                <oc-tag [tone]="diagnosis.status === 'CONFIRMED' ? 'care' : 'neutral'">{{ label }}</oc-tag>
              }
            </p>
          } @empty { <p class="r-state">Non renseigné</p> }
        </div>
        <div class="r-info" data-testid="detail-follow-up">
          <p class="r-label">Suivi</p>
          <p class="h-follow">
            <span class="r-tile r-tile--small r-tile--care" aria-hidden="true"><nz-icon nzType="calendar" /></span>
            <span>{{ followUp(data) }}</span>
          </p>
        </div>
        <div class="r-info h-tiles__wide" data-testid="detail-treatment">
          <p class="r-label">Traitement prescrit</p>
          @if (data.medicationDecision === 'NO_MEDICATION') {
            <p class="r-state">Aucun médicament</p>
          } @else if (data.prescription?.medications?.length) {
            <ul class="h-meds">
              @for (line of data.prescription.medications; track $index) {
                <li class="h-med">
                  <p class="h-med__name">{{ line.name }}@if (line.strength) { {{ ' ' + line.strength }} }</p>
                  <div class="r-tags" data-testid="prescription-tags">
                    @for (tag of tags(line); track $index) { <oc-tag>{{ tag }}</oc-tag> }
                  </div>
                  @if (line.instructions) { <p class="r-secondary">{{ line.instructions }}</p> }
                </li>
              }
            </ul>
          } @else { <p class="r-state">Non renseigné</p> }
        </div>
        <div class="r-info h-tiles__wide" data-testid="detail-orders">
          <p class="r-label">Examens et orientation</p>
          @if (data.orders?.length) {
            <div class="r-tags">
              @for (order of data.orders; track $index) { <oc-tag>{{ orderLabel(order.category) }} · {{ order.target }}</oc-tag> }
            </div>
          } @else { <p class="r-state">Aucun examen</p> }
        </div>
      </div>

      @if (data.documents?.length) {
        <div class="h-documents">
          <p class="r-label">Documents générés</p>
          <div class="h-docs" data-testid="generated-documents">
            @for (card of docCards(data); track card.document.id) {
              <oc-file-card
                [title]="card.title"
                [subtitle]="card.subtitle"
                [tone]="card.tone"
                [disabled]="!card.document.downloadable"
                [loading]="downloading() === card.document.id"
                (activate)="download(data, card.document, card.title)"
              />
            }
          </div>
        </div>
      }

      @if (hasNotes(data)) {
        <button type="button" class="r-link" [attr.aria-expanded]="notesOpen().has(data.id)" (click)="toggleNotes(data.id)">
          {{ notesOpen().has(data.id) ? 'Masquer l’examen clinique et les notes' : 'Voir l’examen clinique et les notes' }}
          <nz-icon [nzType]="notesOpen().has(data.id) ? 'up' : 'right'" aria-hidden="true" />
        </button>
        @if (notesOpen().has(data.id)) {
          <dl class="r-info h-notes">
            @if (data.presentIllness) { <div><dt class="r-label">Histoire de la maladie</dt><dd>{{ data.presentIllness }}</dd></div> }
            @if (data.examination) { <div><dt class="r-label">Examen clinique</dt><dd>{{ data.examination }}</dd></div> }
            @if (data.assessment) { <div><dt class="r-label">Évaluation</dt><dd>{{ data.assessment }}</dd></div> }
            @if (data.notes) { <div><dt class="r-label">Notes</dt><dd>{{ data.notes }}</dd></div> }
          </dl>
        }
      }
    </ng-template>
  `,
  styleUrl: './record-cards.scss',
  styles: `
    .h-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--oc-space-3); }
    .h-head .r-heading { flex: 1 1 260px; }
    .h-search { flex: 0 1 340px; min-width: 0; border-color: var(--oc-hairline); border-radius: 14px; background: var(--oc-surface); }
    .h-search nz-icon { color: var(--oc-ink-secondary); }
    .h-list { display: grid; gap: var(--oc-space-3); margin: 0; padding: 0; list-style: none; }
    .h-current {
      display: flex; align-items: center; gap: var(--oc-space-3);
      padding: var(--oc-space-3) var(--oc-space-4); border-radius: var(--oc-radius-tile);
      background: var(--oc-info-current-tint); color: var(--oc-info-current);
    }
    .h-current__dot { width: 10px; height: 10px; flex: 0 0 10px; border-radius: 50%; background: var(--oc-info-current); }
    .h-current__text { flex: 1; min-width: 0; }
    .h-current__title { margin: 0; font-weight: var(--oc-font-weight-strong); }
    .h-current__meta { margin: 0; font-size: var(--oc-text-small-size); }
    .h-card { display: grid; border: 1px solid var(--oc-hairline); border-radius: var(--oc-radius-tile); background: var(--oc-surface); }
    .h-card__head {
      display: flex; align-items: center; gap: var(--oc-space-4); width: 100%;
      padding: var(--oc-space-3); border: 0; border-radius: var(--oc-radius-tile); background: none;
      color: inherit; font: inherit; text-align: start;
    }
    .h-card__head--button { cursor: pointer; }
    .h-card__head--button:focus-visible { outline: 2px solid var(--oc-color-border-focus); outline-offset: 2px; }
    .h-card__text { display: grid; flex: 1; min-width: 0; gap: 2px; }
    .h-card__title { color: var(--oc-ink); font-size: 18px; font-weight: var(--oc-font-weight-strong); overflow-wrap: anywhere; }
    .h-card__meta { color: var(--oc-ink-secondary); font-size: var(--oc-text-small-size); }
    .h-chevron {
      display: inline-grid; flex: 0 0 40px; width: 40px; height: 40px; place-items: center;
      border: 1px solid var(--oc-hairline); border-radius: var(--oc-radius-icon); color: var(--oc-ink);
    }
    .h-detail { display: grid; gap: var(--oc-space-4); padding: 0 var(--oc-space-4) var(--oc-space-4); }
    .h-tiles { display: grid; gap: var(--oc-space-3); grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .h-tiles__wide { grid-column: 1 / -1; }
    .h-diagnosis { display: flex; flex-wrap: wrap; align-items: center; gap: var(--oc-space-2); margin: 0; color: var(--oc-ink); font-size: 16px; font-weight: var(--oc-font-weight-strong); }
    .h-follow { display: flex; align-items: center; gap: var(--oc-space-3); margin: 0; color: var(--oc-ink); font-size: 16px; font-weight: var(--oc-font-weight-semibold); }
    .h-meds { display: grid; gap: var(--oc-space-3); margin: 0; padding: 0; list-style: none; }
    .h-med { display: grid; gap: var(--oc-space-2); }
    .h-med + .h-med { padding-block-start: var(--oc-space-3); border-block-start: 1px solid var(--oc-hairline); }
    .h-med__name { margin: 0; color: var(--oc-ink); font-size: 16px; font-weight: var(--oc-font-weight-strong); }
    .h-documents { display: grid; gap: var(--oc-space-2); }
    .h-docs { display: grid; gap: var(--oc-space-2); grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); }
    .h-notes { margin: 0; }
    .h-notes > div { display: grid; gap: 2px; }
    .h-notes dd { margin: 0; color: var(--oc-ink); white-space: pre-line; }
    @media (max-width: 768px) {
      .h-search { flex-basis: 100%; }
      .h-tiles { grid-template-columns: minmax(0, 1fr); }
      .h-card__head { flex-wrap: wrap; gap: var(--oc-space-3); }
      .h-card__text { flex-basis: calc(100% - 140px); }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecordHistoryTab {
  readonly store = inject(PatientRecordStore);
  private readonly api = inject(PatientChartApiService);
  private readonly destroyRef = inject(DestroyRef);

  /** The consultation the view was opened from: pinned first, never expandable. */
  readonly currentConsultationId = input<string | null>(null);
  /** A card to open (from « Dernière consultation »). */
  readonly focusId = input<string | null>(null);

  readonly query = signal('');
  readonly open = signal<ReadonlySet<string>>(new Set());
  readonly notesOpen = signal<ReadonlySet<string>>(new Set());
  readonly downloading = signal<string | null>(null);
  readonly downloadError = signal<string | null>(null);

  readonly clinicalView = computed(() => this.store.historyView() === 'CLINICAL' && this.store.clinical());

  readonly current = computed<{ line: string } | null>(() => {
    const id = this.currentConsultationId();
    if (id === null) return null;
    const item = this.store.consultations().find((value) => value.id === id);
    return { line: currentConsultationLine(item?.date ?? null) };
  });

  /** The most recent listed consultation gets the primary date block. */
  readonly mostRecentId = computed(() => {
    const currentId = this.currentConsultationId();
    return this.store.consultations().find((item) => item.id !== currentId)?.id ?? null;
  });

  readonly visible = computed(() => {
    const currentId = this.currentConsultationId();
    const query = searchKey(this.query().trim());
    return this.store.consultations().filter((item) => {
      if (item.id === currentId) return false;
      if (query === '') return true;
      return searchKey(item.reason).includes(query) || searchKey(item.diagnosisSummary).includes(query);
    });
  });

  readonly countLabel = computed(() => {
    const count = this.store.total() ?? this.store.consultations().length;
    return count === 1 ? '1 consultation' : `${count} consultations`;
  });

  constructor() {
    effect(() => {
      if (this.store.chart() === null) return;
      untracked(() => this.store.loadHistory());
    });
    effect(() => {
      const id = this.focusId();
      if (id === null) return;
      untracked(() => {
        if (!this.isOpen(id)) this.toggle(id);
        setTimeout(() => globalThis.document?.getElementById(`history-${id}`)?.scrollIntoView?.({ block: 'start', behavior: 'smooth' }));
      });
    });
  }

  expandable(item: RecordConsultationItem): boolean {
    // A completed consultation the server does not share (`clinicalAvailable: false`) stays closed.
    return this.clinicalView() && item.status === 'COMPLETED' && item.clinicalAvailable !== false;
  }

  isOpen(id: string): boolean {
    return this.open().has(id);
  }

  toggle(id: string): void {
    const next = new Set(this.open());
    if (next.has(id)) next.delete(id);
    else {
      next.add(id);
      this.store.loadDetail(id);
    }
    this.open.set(next);
  }

  toggleNotes(id: string): void {
    const next = new Set(this.notesOpen());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.notesOpen.set(next);
  }

  download(detail: RecordConsultationDetail, document: RecordConsultationDocument, label: string): void {
    const chart = this.store.chart();
    if (chart === null || this.downloading() !== null || !document.downloadable) return;
    this.downloading.set(document.id);
    this.downloadError.set(null);
    this.api.downloadArtifact(chart.id, detail.id, document.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (blob) => {
        this.downloading.set(null);
        saveBlob(blob, `${searchKey(label).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.pdf`);
      },
      error: () => {
        this.downloading.set(null);
        this.downloadError.set('Le document n’a pas pu être téléchargé. Réessayez.');
      },
    });
  }

  /** Card title: the motif (clinical view), « Consultation » otherwise. */
  title(item: RecordConsultationItem): string {
    if (!this.clinicalView()) return 'Consultation';
    return item.reason || 'Motif non renseigné';
  }

  /** « Dr Sami Ben Ali · Médecine générale · 10:00 » */
  meta(item: RecordConsultationItem): string {
    return [item.doctor?.name, item.doctor?.specialty, tunisTime(item.date)].filter(Boolean).join(' · ');
  }

  statusLabel(status: string): string {
    return consultationStatusLabel(status);
  }

  diagnosisStatus(status: string): string {
    return diagnosisStatusLabel(status);
  }

  tags(line: Parameters<typeof medicationTags>[0]): readonly string[] {
    return medicationTags(line);
  }

  orderLabel(category: string): string {
    return orderCategoryLabel(category);
  }

  followUp(detail: RecordConsultationDetail): string {
    return followUpLabel(detail.followUp);
  }

  docCards(detail: RecordConsultationDetail): readonly DocumentCard[] {
    return documentCards(detail.documents ?? [], {
      date: detail.date,
      medicationCount: detail.prescription?.medications?.length ?? 0,
    });
  }

  hasNotes(detail: RecordConsultationDetail): boolean {
    return Boolean(detail.presentIllness || detail.examination || detail.assessment || detail.notes);
  }

  text(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }
}
