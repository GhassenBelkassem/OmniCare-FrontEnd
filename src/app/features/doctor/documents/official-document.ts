import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';

import { RealtimeService } from '../../../core/realtime/realtime.service';
import { OcButton, OcFileCard, type OcFileCardTone } from '../../../shared/ui';
import { ArtifactApiService } from '../artifact-api.service';
import { PatientChartApiService } from '../patient-chart/patient-chart-api.service';
import { TEMPLATE_FALLBACK_NOTICE, saveBlob, searchKey } from '../patient-chart/record/record-format';

export const DOCUMENT_PREPARING = 'En préparation…';
export const DOCUMENT_DOWNLOAD_ERROR = 'Le document n’a pas pu être téléchargé.';
export const DOCUMENT_ACCESS_REQUIRED = 'Accès requis : ce document n’est plus téléchargeable sans l’autorisation du patient.';

/**
 * G-1 D5: one official document (ordonnance, arrêt de travail, certificat…) everywhere it is shown:
 * right after « Terminer », in « Consultation terminée » and in « Dossier patient » → Historique.
 *
 * - Not rendered yet: « En préparation… »; it turns into « Télécharger » on its own when the
 *   server announces DOCUMENT_READY for this document (ids only).
 * - « Télécharger » uses the doctor's own-consultation route first; when it is refused (an
 *   OmniCare patient after the post-« Terminer » window), the chart route (active grant); refused
 *   again: « Accès requis », never an error.
 * - Any other failure: a French message and « Réessayer ».
 */
@Component({
  selector: 'app-official-document',
  imports: [OcFileCard, OcButton],
  template: `
    <div class="official-document" [attr.data-testid]="'official-document-' + artifactId()">
      <oc-file-card
        [title]="title()"
        [subtitle]="isReady() ? subtitle() : preparing"
        [tone]="tone()"
        [actionLabel]="isReady() ? 'Télécharger' : preparing"
        [disabled]="!isReady() || accessRequired()"
        [loading]="downloading()"
        (activate)="download()"
      />
      @if (isReady() && templateFallback()) {
        <p class="official-document__notice" data-testid="template-fallback-notice">{{ fallbackNotice }}</p>
      }
      @if (accessRequired()) {
        <p class="official-document__notice" data-testid="document-access-required">{{ accessRequiredText }}</p>
      }
      @if (error(); as message) {
        <p class="official-document__error" role="alert" data-testid="document-download-error">
          {{ message }}
          <oc-button size="small" variant="secondary" (click)="download()">Réessayer</oc-button>
        </p>
      }
    </div>
  `,
  styles: `
    .official-document { display: grid; gap: var(--oc-space-1); }
    .official-document__notice { margin: 0; color: var(--oc-text-muted); font-size: var(--oc-text-small-size); }
    .official-document__error { display: flex; flex-wrap: wrap; align-items: center; gap: var(--oc-space-2); margin: 0; color: var(--oc-error-dark); font-size: var(--oc-text-small-size); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfficialDocument {
  private readonly artifacts = inject(ArtifactApiService);
  private readonly chartApi = inject(PatientChartApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly consultationId = input.required<string>();
  readonly artifactId = input.required<string>();
  readonly title = input.required<string>();
  readonly subtitle = input('');
  readonly tone = input<OcFileCardTone>('care');
  /** READY when loaded (render status READY / downloadable). */
  readonly ready = input(false);
  readonly templateFallback = input(false);
  /** The doctor's chart of this patient, for the chart-route fallback (null: no fallback). */
  readonly chartId = input<string | null>(null);
  /** The document became READY while shown: the parent may re-read (e.g. for the notice). */
  readonly becameReady = output<string>();

  // Getters, not fields: an imported constant can be undefined at field-init time (module load order).
  get preparing(): string { return DOCUMENT_PREPARING; }
  get fallbackNotice(): string { return TEMPLATE_FALLBACK_NOTICE; }
  get accessRequiredText(): string { return DOCUMENT_ACCESS_REQUIRED; }
  private readonly liveReady = signal(false);
  readonly isReady = computed(() => this.ready() || this.liveReady());
  readonly downloading = signal(false);
  readonly error = signal<string | null>(null);
  readonly accessRequired = signal(false);

  constructor() {
    inject(RealtimeService).scheduledCareEvents$.pipe(
      filter((event) => event.eventType === 'DOCUMENT_READY' && event.resourceType === 'ARTIFACT'
        && event.resourceId === this.artifactId()),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => {
      if (this.isReady()) return;
      this.liveReady.set(true);
      this.becameReady.emit(this.artifactId());
    });
  }

  download(): void {
    if (!this.isReady() || this.downloading() || this.accessRequired()) return;
    this.downloading.set(true);
    this.error.set(null);
    this.artifacts.download(this.consultationId(), this.artifactId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => this.saved(blob),
        error: (failure: unknown) => {
          const chartId = this.chartId();
          if (isRefused(failure) && chartId !== null) this.downloadFromChart(chartId);
          else this.failed(failure);
        },
      });
  }

  private downloadFromChart(chartId: string): void {
    this.chartApi.downloadArtifact(chartId, this.consultationId(), this.artifactId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (blob) => this.saved(blob), error: (failure: unknown) => this.failed(failure) });
  }

  private saved(blob: Blob): void {
    this.downloading.set(false);
    saveBlob(blob, `${searchKey(this.title()).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'document'}.pdf`);
  }

  private failed(failure: unknown): void {
    this.downloading.set(false);
    if (isRefused(failure)) this.accessRequired.set(true);
    else this.error.set(DOCUMENT_DOWNLOAD_ERROR);
  }
}

/** The server refused for access reasons (403): « Accès requis », not an error. */
function isRefused(failure: unknown): boolean {
  return failure instanceof HttpErrorResponse && failure.status === 403;
}
