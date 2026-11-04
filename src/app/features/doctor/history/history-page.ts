import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { OcButton, OcEmptyState, OcPageHeader, OcStatusBadge } from '../../../shared/ui';
import { ActiveConsultationApiService } from '../active-consultation-api.service';
import type { CompletedConsultationListItem } from '../completed-consultation.models';

@Component({
  selector: 'app-history-page',
  imports: [DatePipe, RouterLink, OcButton, OcEmptyState, OcPageHeader, OcStatusBadge],
  template: `
    <section class="history-page">
      <oc-page-header
        title="Consultations terminées"
        description="Historique opérationnel en lecture seule"
      />
      @if (loading()) {
        <p class="history-page__state" role="status">Chargement de l’historique…</p>
      } @else if (error()) {
        <div class="history-page__error" role="alert">
          <p>Impossible de charger les consultations terminées.</p>
          <oc-button variant="secondary" size="small" (click)="load()">Réessayer</oc-button>
        </div>
      } @else if (consultations().length === 0) {
        <oc-empty-state
          icon="history"
          title="Aucune consultation terminée"
          description="Les consultations finalisées apparaîtront ici."
        />
      } @else {
        <ul class="history-list" aria-label="Consultations terminées">
          @for (item of consultations(); track item.consultationId) {
            <li>
              <a class="history-row" [routerLink]="['/doctor/history', item.consultationId]">
                <div class="history-row__identity">
                  <strong>{{ item.patient.displayName }}</strong>
                  <span>{{ sourceLabel(item.sourceType) }}</span>
                </div>
                <div class="history-row__date">
                  <span>Terminée le</span>
                  <time [attr.datetime]="item.completedAt">
                    {{ item.completedAt | date: 'dd/MM/yyyy à HH:mm' }}
                  </time>
                </div>
                <oc-status-badge status="completed" customLabel="Terminée" />
              </a>
            </li>
          }
        </ul>
      }
    </section>
  `,
  styles: `
    .history-page {
      display: grid;
      gap: var(--oc-section-gap);
    }
    .history-page__state,
    .history-page__error {
      margin: 0;
      padding: var(--oc-space-6);
      border: 1px solid var(--oc-color-border-subtle);
      border-radius: var(--oc-radius-lg);
      background: var(--oc-color-surface-card);
    }
    .history-page__error {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--oc-space-4);
    }
    .history-page__error p { margin: 0; }
    .history-list {
      display: grid;
      gap: var(--oc-space-3);
      padding: 0;
      margin: 0;
      list-style: none;
    }
    .history-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(180px, auto) auto;
      align-items: center;
      gap: var(--oc-space-5);
      padding: var(--oc-space-4) var(--oc-space-5);
      border: 1px solid var(--oc-color-border-subtle);
      border-radius: var(--oc-radius-lg);
      background: var(--oc-color-surface-card);
      color: var(--oc-color-text-primary);
      text-decoration: none;
    }
    .history-row:hover { border-color: var(--oc-color-border-default); }
    .history-row:focus-visible { outline: 3px solid var(--oc-color-focus-ring); outline-offset: 2px; }
    .history-row__identity,
    .history-row__date { display: grid; gap: var(--oc-space-1); min-width: 0; }
    .history-row__identity span,
    .history-row__date span { color: var(--oc-color-text-muted); font-size: 12px; }
    .history-row__date time { font-size: 13px; font-variant-numeric: tabular-nums; }
    @media (max-width: 767px) {
      .history-row { grid-template-columns: 1fr auto; }
      .history-row__date { grid-column: 1 / -1; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistoryPage {
  private readonly api = inject(ActiveConsultationApiService);
  readonly consultations = signal<readonly CompletedConsultationListItem[]>([]);
  readonly loading = signal(false);
  readonly error = signal(false);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.api.listCompleted().pipe(finalize(() => this.loading.set(false))).subscribe({
      next: (values) => this.consultations.set(values),
      error: () => this.error.set(true),
    });
  }

  sourceLabel(source: CompletedConsultationListItem['sourceType']): string {
    switch (source) {
      case 'SCHEDULED_APPOINTMENT': return 'Rendez-vous planifié';
      case 'URGENT_HOME': return 'Urgence à domicile';
      case 'URGENT_CABINET': return 'Urgence au cabinet';
    }
  }
}
