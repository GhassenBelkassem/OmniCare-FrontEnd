import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';

import { OcButton, OcFileCard } from '../../../shared/ui';
import { ChartAccessRequired } from './chart-access-required';
import type {
  PatientChartAccessDto,
  PatientChartDocumentDto,
  PatientChartDocumentPreviewDto,
  PatientChartRecordStatus,
} from './patient-chart-api.models';
import { PatientChartApiService, newChartIdempotencyKey } from './patient-chart-api.service';
import {
  chartLongDate,
  documentStatusLabel,
  documentTypeLabel,
  isAccessRequiredError,
  mayLoadClinical,
} from './patient-chart-format';

@Component({
  selector: 'app-chart-documents-tab',
  imports: [
    NzIconModule,
    NzModalModule,
    NzSkeletonModule,
    OcButton,
    OcFileCard,
    ChartAccessRequired,
  ],
  template: `
    <section class="r-card" aria-labelledby="documents-title">
      <div class="r-heading">
        <span class="r-tile r-tile--care" aria-hidden="true"><nz-icon nzType="file-text" /></span>
        <div class="r-heading__text">
          <h3 id="documents-title">{{ compact() ? 'Documents récents' : 'Documents' }}</h3>
          @if (clinicalAllowed() && state() === 'ready' && documents().length > 0 && !compact()) {
            <p data-testid="document-count">{{ documents().length === 1 ? '1 document' : documents().length + ' documents' }}</p>
          }
        </div>
        @if (compact() && clinicalAllowed() && state() === 'ready' && documents().length > 0) {
          <oc-button variant="ghost" size="small" trailingIcon="right" (click)="showAll.emit()">Voir tous</oc-button>
        }
      </div>

      @if (!clinicalAllowed() || state() === 'denied') {
        <app-chart-access-required />
      } @else if (recordStatus() === 'PREPARING') {
        <p class="r-empty" role="status">Le dossier médical est en cours de préparation.</p>
      } @else {
        @if (state() === 'loading') {
          <nz-skeleton [nzActive]="true" [nzTitle]="false" [nzParagraph]="{ rows: compact() ? 3 : 5 }" />
        } @else if (state() === 'error') {
          <p class="r-error" role="alert">Les documents n’ont pas pu être chargés.
            <oc-button size="small" (click)="load()">Réessayer</oc-button></p>
        } @else if (documents().length === 0) {
          <!-- Empty state: one short sentence (no illustration). -->
          <p class="r-empty" data-testid="documents-empty">Aucun document médical disponible.</p>
        } @else {
          <ul class="d-list" data-testid="document-list">
            @for (document of visibleDocuments(); track document.id) {
              <li>
                <oc-file-card
                  [title]="document.name || typeLabel(document.type)"
                  [subtitle]="subtitle(document)"
                  [badge]="formatBadge(document.contentType)"
                  icon="eye"
                  actionLabel="Aperçu"
                  [disabled]="!document.previewable"
                  (activate)="openPreview(document)"
                />
              </li>
            }
          </ul>
        }
      }
    </section>

    <nz-modal
      [nzVisible]="preview() !== null"
      [nzTitle]="preview()?.document?.name || 'Aperçu du document'"
      [nzFooter]="previewFooter"
      [nzWidth]="880"
      nzCentered
      (nzOnCancel)="closePreview()"
    >
      <ng-container *nzModalContent>
        <div class="preview-body" aria-live="polite">
          @if (previewError(); as message) {
            <p class="summary-form__error" role="alert">{{ message }}</p>
          } @else if (pageUrl(); as url) {
            <img class="preview-body__page" [src]="url" [alt]="'Page ' + page() + ' du document'" />
          } @else {
            <nz-skeleton [nzActive]="true" [nzTitle]="false" [nzParagraph]="{ rows: 8 }" />
          }
        </div>
      </ng-container>
    </nz-modal>
    <ng-template #previewFooter>
      <div class="preview-footer">
        <oc-button size="small" leadingIcon="left" [disabled]="page() <= 1" (click)="goToPage(page() - 1)">
          Précédente
        </oc-button>
        <span>Page {{ page() }} / {{ preview()?.session?.pageCount ?? 1 }}</span>
        <oc-button
          size="small"
          trailingIcon="right"
          [disabled]="page() >= (preview()?.session?.pageCount ?? 1)"
          (click)="goToPage(page() + 1)"
        >
          Suivante
        </oc-button>
      </div>
    </ng-template>
  `,
  styleUrls: ['./patient-chart-cards.scss', './record/record-cards.scss'],
  styles: `
    .d-list { display: grid; gap: var(--oc-space-2); margin: 0; padding: 0; list-style: none; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChartDocumentsTab {
  private readonly api = inject(PatientChartApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly patientId = input.required<string>();
  readonly access = input.required<PatientChartAccessDto>();
  readonly recordStatus = input<PatientChartRecordStatus>('READY');
  /** Synthèse card: three most recent. */
  readonly compact = input(false);
  /** Bumped by the page after « Ajouter un document »: reloads the list. */
  readonly reloadToken = input(0);
  readonly showAll = output<void>();

  readonly state = signal<'idle' | 'loading' | 'ready' | 'error' | 'denied'>('idle');
  readonly clinicalAllowed = computed(() => mayLoadClinical(this.access()));
  readonly documents = signal<readonly PatientChartDocumentDto[]>([]);
  readonly preview = signal<{
    readonly document: PatientChartDocumentDto;
    readonly session: PatientChartDocumentPreviewDto;
  } | null>(null);
  readonly page = signal(1);
  readonly pageUrl = signal<string | null>(null);
  readonly previewError = signal<string | null>(null);

  constructor() {
    effect(() => {
      const id = this.patientId();
      this.reloadToken();
      const allowed = mayLoadClinical(this.access()) && this.recordStatus() === 'READY';
      untracked(() => {
        if (allowed && id) this.load();
        else this.state.set('idle');
      });
    });
    this.destroyRef.onDestroy(() => this.revokePage());
  }

  visibleDocuments(): readonly PatientChartDocumentDto[] {
    return this.compact() ? this.documents().slice(0, 3) : this.documents();
  }

  load(): void {
    this.state.set('loading');
    this.api
      .getDocuments(this.patientId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.documents.set(
            [...result.items].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
          );
          this.state.set('ready');
        },
        error: (error: unknown) => {
          this.state.set(isAccessRequiredError(error) ? 'denied' : 'error');
        },
      });
  }

  openPreview(document: PatientChartDocumentDto): void {
    this.previewError.set(null);
    this.revokePage();
    this.page.set(1);
    this.api
      .createPreview(this.patientId(), document.id, newChartIdempotencyKey('chart-preview'))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (session) => {
          this.preview.set({ document, session });
          this.loadPage(1);
        },
        error: () => {
          this.preview.set({ document, session: { sessionId: '', pageCount: 1, expiresAt: null, token: '' } });
          this.previewError.set('L’aperçu n’est pas disponible pour le moment.');
        },
      });
  }

  goToPage(page: number): void {
    const preview = this.preview();
    if (!preview || page < 1 || page > preview.session.pageCount) return;
    this.loadPage(page);
  }

  closePreview(): void {
    this.preview.set(null);
    this.revokePage();
  }

  typeLabel(type: string | null): string {
    return documentTypeLabel(type);
  }

  statusLabel(status: string): string | null {
    return documentStatusLabel(status);
  }

  date(value: string): string {
    return chartLongDate(value);
  }

  /** « Analyse biologique · 10 novembre 2026 » (+ the status when the file is not available). */
  subtitle(document: PatientChartDocumentDto): string {
    return [this.typeLabel(document.type), this.date(document.createdAt), this.statusLabel(document.status)].filter(Boolean).join(' · ');
  }

  /** File format shown in the tile: PDF, JPG or PNG (the accepted upload formats). */
  formatBadge(contentType: string | null): string {
    if (contentType === 'image/jpeg') return 'JPG';
    if (contentType === 'image/png') return 'PNG';
    if (contentType === 'application/pdf') return 'PDF';
    return 'DOC';
  }

  private loadPage(page: number): void {
    const preview = this.preview();
    if (!preview) return;
    this.page.set(page);
    this.revokePage();
    this.previewError.set(null);
    this.api
      .previewPage(this.patientId(), preview.document.id, preview.session, page)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          if (this.preview() !== preview || this.page() !== page) return;
          this.pageUrl.set(typeof URL.createObjectURL === 'function' ? URL.createObjectURL(blob) : null);
        },
        error: () => this.previewError.set('Cette page n’a pas pu être affichée.'),
      });
  }

  private revokePage(): void {
    const url = this.pageUrl();
    if (url && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(url);
    this.pageUrl.set(null);
  }
}
