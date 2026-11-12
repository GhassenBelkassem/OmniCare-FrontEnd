import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, model, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzUploadModule, type NzUploadFile } from 'ng-zorro-antd/upload';

import { OcButton } from '../../../shared/ui';
import type { PatientChartDocumentDto, PatientChartDocumentType } from './patient-chart-api.models';
import { PatientChartApiService, newChartIdempotencyKey } from './patient-chart-api.service';
import { DOCUMENT_TYPE_OPTIONS } from './patient-chart-format';

/** Same limit as the server (`PatientChartService.MAX_UPLOAD_BYTES`, MRS document policy): 15 Mo. */
export const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024;
const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

/** Validates a picked file before upload; returns a French message or null. */
export function documentFileError(file: Pick<File, 'type' | 'size' | 'name'> | null): string | null {
  if (!file) return 'Choisissez un fichier.';
  const extension = file.name.toLowerCase().split('.').pop() ?? '';
  const typeOk = ACCEPTED_TYPES.includes(file.type) || ['pdf', 'jpg', 'jpeg', 'png'].includes(extension);
  if (!typeOk) return 'Format non accepté. Utilisez un fichier PDF, JPEG ou PNG.';
  if (file.size <= 0) return 'Le fichier est vide.';
  if (file.size > MAX_DOCUMENT_BYTES) return 'Le fichier dépasse la taille maximale de 15 Mo.';
  return null;
}

/**
 * « Ajouter un document » (patient page header, owner of an external patient only): the existing
 * upload flow in a dialog. The server decides again (403 for any other access mode).
 */
@Component({
  selector: 'app-chart-document-upload',
  imports: [FormsModule, NzIconModule, NzInputModule, NzModalModule, NzSelectModule, NzUploadModule, OcButton],
  template: `
    <nz-modal
      [nzVisible]="open()"
      nzTitle="Ajouter un document"
      [nzClosable]="!uploading()"
      [nzMaskClosable]="!uploading()"
      [nzFooter]="footer"
      (nzOnCancel)="close()"
    >
      <ng-container *nzModalContent>
        <form class="upload-form" id="chart-upload-form" (ngSubmit)="upload()" data-testid="upload-form">
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
              <p class="upload-form__drop-hint">PDF, JPEG ou PNG · 15 Mo maximum</p>
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
          @if (error(); as message) {
            <p class="summary-form__error" role="alert">{{ message }}</p>
          }
        </form>
      </ng-container>
    </nz-modal>
    <ng-template #footer>
      <oc-button variant="ghost" [disabled]="uploading()" (click)="close()">Annuler</oc-button>
      <oc-button variant="primary" [loading]="uploading()" (click)="upload()">Ajouter</oc-button>
    </ng-template>
  `,
  styleUrl: './patient-chart-cards.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChartDocumentUpload {
  private readonly api = inject(PatientChartApiService);
  private readonly destroyRef = inject(DestroyRef);
  private uploadKey: { readonly signature: string; readonly key: string } | null = null;

  readonly patientId = input.required<string>();
  readonly open = model(false);
  readonly uploaded = output<PatientChartDocumentDto>();

  readonly typeOptions = DOCUMENT_TYPE_OPTIONS;
  readonly uploading = signal(false);
  readonly error = signal<string | null>(null);
  readonly pickedFile = signal<File | null>(null);
  title = '';
  documentType: PatientChartDocumentType = 'LAB_RESULT';

  readonly beforeUpload = (file: NzUploadFile): boolean => {
    const picked = file as unknown as File;
    const error = documentFileError(picked);
    this.error.set(error);
    this.pickedFile.set(error ? null : picked);
    if (!error && !this.title.trim()) this.title = picked.name.replace(/\.[^.]+$/u, '');
    return false;
  };

  close(): void {
    if (this.uploading()) return;
    this.open.set(false);
    this.pickedFile.set(null);
    this.error.set(null);
    this.title = '';
  }

  upload(): void {
    if (this.uploading()) return;
    const file = this.pickedFile();
    const fileError = documentFileError(file);
    if (fileError || !file) {
      this.error.set(fileError);
      return;
    }
    const title = this.title.trim();
    if (!title) {
      this.error.set('Donnez un nom au document.');
      return;
    }
    const signature = `${file.name}:${file.size}:${file.lastModified}:${title}:${this.documentType}`;
    if (this.uploadKey?.signature !== signature) {
      this.uploadKey = { signature, key: newChartIdempotencyKey('chart-document') };
    }
    this.uploading.set(true);
    this.error.set(null);
    this.api
      .uploadDocument(this.patientId(), file, { documentType: this.documentType, title }, this.uploadKey.key)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (document) => {
          this.uploading.set(false);
          this.uploadKey = null;
          this.uploaded.emit(document);
          this.close();
        },
        error: (error: unknown) => {
          this.uploading.set(false);
          this.error.set(uploadErrorMessage(error));
        },
      });
  }
}

function uploadErrorMessage(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) return 'Le document n’a pas pu être ajouté. Réessayez.';
  if (error.status === 422 || error.status === 415 || error.status === 400) {
    return 'Ce fichier n’est pas accepté. Formats autorisés : PDF, JPEG ou PNG, 15 Mo maximum.';
  }
  if (error.status === 413) return 'Le fichier dépasse la taille maximale de 15 Mo.';
  if (error.status === 403) return 'Vous ne pouvez pas ajouter de document à ce dossier.';
  return 'Le document n’a pas pu être ajouté. Réessayez.';
}
