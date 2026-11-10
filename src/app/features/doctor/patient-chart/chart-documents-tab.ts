import { HttpErrorResponse } from '@angular/common/http';
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
import { FormsModule } from '@angular/forms';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzUploadModule, type NzUploadFile } from 'ng-zorro-antd/upload';

import { OcButton, OcEmptyState, OcSectionCard } from '../../../shared/ui';
import { ChartAccessRequired } from './chart-access-required';
import type {
  PatientChartAccessDto,
  PatientChartDocumentDto,
  PatientChartDocumentPreviewDto,
  PatientChartDocumentType,
  PatientChartRecordStatus,
} from './patient-chart-api.models';
import { PatientChartApiService, newChartIdempotencyKey } from './patient-chart-api.service';
import {
  DOCUMENT_TYPE_OPTIONS,
  chartLongDate,
  documentStatusLabel,
  documentTypeLabel,
  isAccessRequiredError,
  mayLoadClinical,
} from './patient-chart-format';

export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;
const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

/** Validates a picked file before upload; returns a French message or null. */
export function documentFileError(file: Pick<File, 'type' | 'size' | 'name'> | null): string | null {
  if (!file) return 'Choisissez un fichier.';
  const extension = file.name.toLowerCase().split('.').pop() ?? '';
  const typeOk =
    ACCEPTED_TYPES.includes(file.type) || ['pdf', 'jpg', 'jpeg', 'png'].includes(extension);
  if (!typeOk) return 'Format non accepté. Utilisez un fichier PDF, JPEG ou PNG.';
  if (file.size <= 0) return 'Le fichier est vide.';
  if (file.size > MAX_DOCUMENT_BYTES) return 'Le fichier dépasse la taille maximale de 20 Mo.';
  return null;
}

@Component({
  selector: 'app-chart-documents-tab',
  imports: [
    FormsModule,
    NzIconModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzSkeletonModule,
    NzTagModule,
    NzUploadModule,
    OcButton,
    OcEmptyState,
    OcSectionCard,
    ChartAccessRequired,
  ],
  template: `
    <oc-section-card [title]="compact() ? 'Documents récents' : 'Documents'" icon="file-text">
      @if (compact() && clinicalAllowed() && state() === 'ready' && documents().length > 0) {
        <oc-button ocSectionAction variant="ghost" size="small" trailingIcon="right" (click)="showAll.emit()">
          Voir tous
        </oc-button>
      } @else if (!compact() && canUpload() && state() === 'ready' && !uploadOpen()) {
        <oc-button ocSectionAction variant="primary" size="small" leadingIcon="upload" (click)="openUpload()">
          Ajouter un document
        </oc-button>
      }

      @if (!clinicalAllowed() || state() === 'denied') {
        <app-chart-access-required />
      } @else if (recordStatus() === 'PREPARING') {
        <p class="chart-muted" role="status">Le dossier médical est en cours de préparation.</p>
      } @else {
        @if (uploadOpen()) {
          <form class="upload-form" (ngSubmit)="upload()" (keydown.escape)="closeUpload()" data-testid="upload-form">
            <nz-upload
              nzType="drag"
              [nzMultiple]="false"
              [nzShowUploadList]="false"
              nzAccept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              [nzBeforeUpload]="beforeUpload"
            >
              <p class="upload-form__drop-icon"><nz-icon nzType="inbox" /></p>
              @if (pickedFile(); as file) {
                <p class="upload-form__drop-text">{{ file.name }}</p>
                <p class="upload-form__drop-hint">Cliquez ou déposez un autre fichier pour le remplacer</p>
              } @else {
                <p class="upload-form__drop-text">Cliquez ou déposez un fichier ici</p>
                <p class="upload-form__drop-hint">PDF, JPEG ou PNG · 20 Mo maximum</p>
              }
            </nz-upload>
            <div class="upload-form__row">
              <label class="summary-form__field">
                <span>Nom du document</span>
                <input nz-input name="title" maxlength="200" [(ngModel)]="title" placeholder="Ex. Bilan sanguin" />
              </label>
              <label class="summary-form__field">
                <span>Type</span>
                <nz-select name="documentType" [(ngModel)]="documentType">
                  @for (option of typeOptions; track option.value) {
                    <nz-option [nzValue]="option.value" [nzLabel]="option.label" />
                  }
                </nz-select>
              </label>
            </div>
            @if (uploadError(); as message) {
              <p class="summary-form__error" role="alert">{{ message }}</p>
            }
            <div class="summary-form__actions">
              <oc-button variant="ghost" (click)="closeUpload()" [disabled]="uploading()">Annuler</oc-button>
              <oc-button variant="primary" type="submit" [loading]="uploading()">Ajouter</oc-button>
            </div>
          </form>
        }

        @if (state() === 'loading') {
          <nz-skeleton [nzActive]="true" [nzTitle]="false" [nzParagraph]="{ rows: compact() ? 3 : 5 }" />
        } @else if (state() === 'error') {
          <div class="chart-error" role="alert">
            <p>Les documents n’ont pas pu être chargés.</p>
            <oc-button size="small" (click)="load()">Réessayer</oc-button>
          </div>
        } @else if (documents().length === 0 && !uploadOpen()) {
          <oc-empty-state icon="file" title="Aucun document" description="Les documents du patient apparaîtront ici.">
            @if (canUpload()) {
              <oc-button variant="primary" leadingIcon="upload" (click)="openUpload()">Ajouter un document</oc-button>
            }
          </oc-empty-state>
        } @else {
          <ul class="chart-list" data-testid="document-list">
            @for (document of visibleDocuments(); track document.id) {
              <li class="chart-list__item document-item">
                <span class="document-item__icon" aria-hidden="true">
                  <nz-icon [nzType]="document.contentType?.startsWith('image/') ? 'file-image' : 'file-text'" />
                </span>
                <div class="chart-list__body">
                  <p class="chart-list__title">{{ document.name || typeLabel(document.type) }}</p>
                  <p class="chart-list__meta">
                    {{ typeLabel(document.type) }} · {{ date(document.createdAt) }}
                  </p>
                </div>
                <div class="chart-list__actions">
                  @if (statusLabel(document.status); as status) {
                    <nz-tag>{{ status }}</nz-tag>
                  }
                  @if (document.previewable) {
                    <oc-button size="small" variant="outline" leadingIcon="eye" (click)="openPreview(document)">
                      Aperçu
                    </oc-button>
                  }
                </div>
              </li>
            }
          </ul>
        }
      }
    </oc-section-card>

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
  styleUrl: './patient-chart-cards.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChartDocumentsTab {
  private readonly api = inject(PatientChartApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly patientId = input.required<string>();
  readonly access = input.required<PatientChartAccessDto>();
  readonly recordStatus = input<PatientChartRecordStatus>('READY');
  /** Synthèse card: three most recent, no upload form. */
  readonly compact = input(false);
  readonly showAll = output<void>();
  readonly uploaded = output<void>();

  readonly typeOptions = DOCUMENT_TYPE_OPTIONS;
  readonly state = signal<'idle' | 'loading' | 'ready' | 'error' | 'denied'>('idle');
  readonly clinicalAllowed = computed(() => mayLoadClinical(this.access()));
  readonly documents = signal<readonly PatientChartDocumentDto[]>([]);
  readonly canUpload = signal(false);
  readonly uploadOpen = signal(false);
  readonly uploading = signal(false);
  readonly uploadError = signal<string | null>(null);
  readonly pickedFile = signal<File | null>(null);
  readonly preview = signal<{
    readonly document: PatientChartDocumentDto;
    readonly session: PatientChartDocumentPreviewDto;
  } | null>(null);
  readonly page = signal(1);
  readonly pageUrl = signal<string | null>(null);
  readonly previewError = signal<string | null>(null);

  title = '';
  documentType: PatientChartDocumentType = 'LAB_RESULT';
  private uploadKey: { readonly signature: string; readonly key: string } | null = null;

  readonly beforeUpload = (file: NzUploadFile): boolean => {
    const picked = file as unknown as File;
    const error = documentFileError(picked);
    this.uploadError.set(error);
    this.pickedFile.set(error ? null : picked);
    if (!error && !this.title.trim()) this.title = picked.name.replace(/\.[^.]+$/u, '');
    return false;
  };

  constructor() {
    effect(() => {
      const id = this.patientId();
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
          this.canUpload.set(result.canUpload && this.access().editable);
          this.state.set('ready');
        },
        error: (error: unknown) => {
          this.canUpload.set(false);
          this.state.set(isAccessRequiredError(error) ? 'denied' : 'error');
        },
      });
  }

  openUpload(): void {
    this.uploadOpen.set(true);
    this.uploadError.set(null);
  }

  closeUpload(): void {
    if (this.uploading()) return;
    this.uploadOpen.set(false);
    this.pickedFile.set(null);
    this.uploadError.set(null);
    this.title = '';
  }

  upload(): void {
    if (this.uploading()) return;
    const file = this.pickedFile();
    const fileError = documentFileError(file);
    if (fileError || !file) {
      this.uploadError.set(fileError);
      return;
    }
    const title = this.title.trim();
    if (!title) {
      this.uploadError.set('Donnez un nom au document.');
      return;
    }
    const signature = `${file.name}:${file.size}:${file.lastModified}:${title}:${this.documentType}`;
    if (this.uploadKey?.signature !== signature) {
      this.uploadKey = { signature, key: newChartIdempotencyKey('chart-document') };
    }
    this.uploading.set(true);
    this.uploadError.set(null);
    this.api
      .uploadDocument(this.patientId(), file, { documentType: this.documentType, title }, this.uploadKey.key)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (document) => {
          this.uploading.set(false);
          this.uploadKey = null;
          this.documents.update((list) => [document, ...list.filter(({ id }) => id !== document.id)]);
          this.uploadOpen.set(false);
          this.pickedFile.set(null);
          this.title = '';
          this.uploaded.emit();
        },
        error: (error: unknown) => {
          this.uploading.set(false);
          this.uploadError.set(
            error instanceof HttpErrorResponse && (error.status === 422 || error.status === 415)
              ? 'Ce fichier n’est pas accepté. Formats autorisés : PDF, JPEG ou PNG, 20 Mo maximum.'
              : error instanceof HttpErrorResponse && error.status === 413
                ? 'Le fichier dépasse la taille maximale de 20 Mo.'
                : 'Le document n’a pas pu être ajouté. Réessayez.',
          );
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
