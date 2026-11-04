import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { OcEmptyState, OcPageHeader, OcStatusBadge } from '../../../shared/ui';
import { ActiveConsultationApiService } from '../active-consultation-api.service';
import type {
  CompletedArtifactMetadata,
  CompletedConsultationDetail,
} from '../completed-consultation.models';

@Component({
  selector: 'app-completed-consultation-page',
  imports: [DatePipe, RouterLink, OcEmptyState, OcPageHeader, OcStatusBadge],
  template: `
    <section class="completed-detail">
      <oc-page-header
        title="Consultation terminée"
        description="État opérationnel en lecture seule"
      >
        <a ocBreadcrumbs routerLink="/doctor/history">Retour aux consultations terminées</a>
      </oc-page-header>

      @if (loading()) {
        <p class="panel" role="status">Chargement de la consultation…</p>
      } @else if (error()) {
        <oc-empty-state
          icon="history"
          title="Consultation non disponible"
          description="Cette consultation terminée est introuvable ou ne vous appartient pas."
        >
          <a class="detail-back" routerLink="/doctor/history">Retour à l’historique</a>
        </oc-empty-state>
      } @else if (detail(); as current) {
        <section class="panel" aria-labelledby="operational-state-title">
          <div class="panel__heading">
            <div>
              <h2 id="operational-state-title">{{ current.consultation.patient.displayName }}</h2>
              <p>{{ sourceLabel(current.consultation.sourceType) }}</p>
            </div>
            <oc-status-badge status="completed" customLabel="Terminée" />
          </div>
          <dl class="facts">
            <div><dt>Début</dt><dd><time [attr.datetime]="current.consultation.startedAt">{{ current.consultation.startedAt | date: 'dd/MM/yyyy à HH:mm' }}</time></dd></div>
            <div><dt>Fin</dt><dd><time [attr.datetime]="current.consultation.completedAt">{{ current.consultation.completedAt | date: 'dd/MM/yyyy à HH:mm' }}</time></dd></div>
            <div><dt>Accès médical actif</dt><dd>Expiré</dd></div>
          </dl>
        </section>

        <section class="panel" aria-labelledby="historical-access-title">
          <h2 id="historical-access-title">Dossier médical historique</h2>
          <p class="locked-state">Dossier médical historique non autorisé</p>
          <p>Un nouvel accès nécessite le parcours de partage patient existant.</p>
        </section>

        <section class="panel" aria-labelledby="artifacts-title">
          <h2 id="artifacts-title">Documents officiels</h2>
          @if (!current.artifactStatusAvailable) {
            <p role="status">Les statuts des documents sont temporairement indisponibles.</p>
          } @else if (current.artifacts.length === 0) {
            <p>Aucun document officiel pour cette consultation.</p>
          } @else {
            <ul class="artifact-list">
              @for (artifact of current.artifacts; track artifact.artifactId) {
                <li>
                  <strong>{{ artifactLabel(artifact.artifactType) }}</strong>
                  <span>{{ renderLabel(artifact.renderStatus) }}</span>
                </li>
              }
            </ul>
          }
        </section>
      }
    </section>
  `,
  styles: `
    .completed-detail { display: grid; gap: var(--oc-section-gap); }
    .panel { padding: var(--oc-space-6); border: 1px solid var(--oc-color-border-subtle); border-radius: var(--oc-radius-lg); background: var(--oc-color-surface-card); }
    .panel h2, .panel p { margin-top: 0; }
    .panel__heading { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--oc-space-4); }
    .panel__heading p { margin-bottom: 0; color: var(--oc-color-text-muted); }
    .facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: var(--oc-space-4); margin: var(--oc-space-6) 0 0; }
    .facts div { display: grid; gap: var(--oc-space-1); }
    .facts dt { color: var(--oc-color-text-muted); font-size: 12px; }
    .facts dd { margin: 0; font-weight: var(--oc-font-weight-semibold); }
    .locked-state { font-weight: var(--oc-font-weight-semibold); color: var(--oc-color-warning); }
    .artifact-list { display: grid; gap: var(--oc-space-2); padding: 0; margin: var(--oc-space-4) 0 0; list-style: none; }
    .artifact-list li { display: flex; justify-content: space-between; gap: var(--oc-space-4); padding: var(--oc-space-3) 0; border-top: 1px solid var(--oc-color-border-subtle); }
    .artifact-list span { color: var(--oc-color-text-muted); }
    .detail-back { color: var(--oc-color-brand-primary); font-weight: var(--oc-font-weight-semibold); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompletedConsultationPage {
  private readonly api = inject(ActiveConsultationApiService);
  private readonly consultationId = inject(ActivatedRoute).snapshot.paramMap.get('consultationId') ?? '';
  readonly detail = signal<CompletedConsultationDetail | null>(null);
  readonly loading = signal(true);
  readonly error = signal(false);

  constructor() {
    this.api.getCompleted(this.consultationId).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: (value) => this.detail.set(value),
      error: () => this.error.set(true),
    });
  }

  sourceLabel(source: CompletedConsultationDetail['consultation']['sourceType']): string {
    switch (source) {
      case 'SCHEDULED_APPOINTMENT': return 'Rendez-vous planifié';
      case 'URGENT_HOME': return 'Urgence à domicile';
      case 'URGENT_CABINET': return 'Urgence au cabinet';
    }
  }

  artifactLabel(type: CompletedArtifactMetadata['artifactType']): string {
    switch (type) {
      case 'PRESCRIPTION': return 'Ordonnance';
      case 'LAB_ORDER': return 'Ordre laboratoire';
      case 'IMAGING_ORDER': return 'Ordre imagerie';
      case 'MEDICAL_CERTIFICATE': return 'Certificat médical';
      case 'SICK_LEAVE_CERTIFICATE': return 'Congé maladie';
    }
  }

  renderLabel(status: CompletedArtifactMetadata['renderStatus']): string {
    switch (status) {
      case 'READY': return 'Prêt';
      case 'FAILED_RETRYABLE': return 'Échec temporaire';
      case 'PENDING':
      case 'GENERATING': return 'Génération en cours';
      case 'WAITING_FOR_COMPLETION': return 'En attente';
    }
  }
}
