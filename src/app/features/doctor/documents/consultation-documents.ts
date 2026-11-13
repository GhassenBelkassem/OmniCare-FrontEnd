import { ChangeDetectionStrategy, Component, DestroyRef, type OnInit, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ActiveConsultationApiService } from '../active-consultation-api.service';
import type { CompletedArtifactMetadata, CompletedConsultationDetail } from '../completed-consultation.models';
import { OfficialDocument } from './official-document';

const STATUS_RETRY_MS = 2_000;
const STATUS_RETRIES = 5;

/**
 * G-1 D5: the official documents of a finished consultation, each with « Télécharger » (or
 * « En préparation… » until it is rendered). Used right after « Terminer » and in « Consultation
 * terminée ». Right after « Terminer » the statuses may briefly be unavailable (MRS is closing the
 * care context): re-read a few times before saying so.
 */
@Component({
  selector: 'app-consultation-documents',
  imports: [OfficialDocument],
  template: `
    @if (detail(); as current) {
      @if (!current.artifactStatusAvailable) {
        <p role="status">{{ retrying() ? 'Préparation des documents…' : 'Les statuts des documents sont temporairement indisponibles.' }}</p>
      } @else if (current.artifacts.length === 0) {
        <p>Aucun document officiel pour cette consultation.</p>
      } @else {
        <div class="consultation-documents" data-testid="official-documents">
          @for (artifact of current.artifacts; track artifact.artifactId) {
            <app-official-document
              [consultationId]="current.consultation.consultationId"
              [artifactId]="artifact.artifactId"
              [title]="label(artifact.artifactType)"
              [ready]="artifact.renderStatus === 'READY'"
              [templateFallback]="artifact.templateFallback === true"
              [chartId]="current.consultation.chartId ?? null"
              (becameReady)="reload()"
            />
          }
        </div>
      }
    } @else if (failed()) {
      <p role="status">Les documents n’ont pas pu être chargés.</p>
    } @else {
      <p role="status">Chargement des documents…</p>
    }
  `,
  styles: `.consultation-documents { display: grid; gap: var(--oc-space-3); grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConsultationDocuments implements OnInit {
  private readonly api = inject(ActiveConsultationApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly consultationId = input.required<string>();
  /** Already loaded by the page (« Consultation terminée »); otherwise read here. */
  readonly initial = input<CompletedConsultationDetail | null>(null);

  readonly detail = signal<CompletedConsultationDetail | null>(null);
  readonly failed = signal(false);
  readonly retrying = signal(false);
  private retries = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => { if (this.timer !== null) clearTimeout(this.timer); });
  }

  ngOnInit(): void {
    const initial = this.initial();
    if (initial !== null) this.accept(initial);
    else this.reload();
  }

  reload(): void {
    this.api.getCompleted(this.consultationId()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (value) => this.accept(value),
      error: () => this.scheduleRetry(() => this.failed.set(true)),
    });
  }

  label(type: CompletedArtifactMetadata['artifactType']): string {
    switch (type) {
      case 'PRESCRIPTION': return 'Ordonnance';
      case 'LAB_ORDER': return 'Demande d’analyses';
      case 'IMAGING_ORDER': return 'Demande d’imagerie';
      case 'MEDICAL_CERTIFICATE': return 'Certificat médical';
      case 'SICK_LEAVE_CERTIFICATE': return 'Arrêt de travail';
      default: return 'Document';
    }
  }

  private accept(value: CompletedConsultationDetail): void {
    this.failed.set(false);
    this.detail.set(value);
    if (!value.artifactStatusAvailable) this.scheduleRetry(() => this.retrying.set(false));
    else this.retrying.set(false);
  }

  private scheduleRetry(onGiveUp: () => void): void {
    if (this.retries >= STATUS_RETRIES) {
      onGiveUp();
      return;
    }
    this.retries += 1;
    this.retrying.set(true);
    this.timer = setTimeout(() => { this.timer = null; this.reload(); }, STATUS_RETRY_MS);
  }
}
