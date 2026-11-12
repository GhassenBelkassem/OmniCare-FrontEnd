import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { OcButton, OcEmptyState, OcPageHeader } from '../../../shared/ui';

interface UnavailableRouteData {
  readonly featureTitle: string;
  readonly featureDescription: string;
}

@Component({
  selector: 'app-production-unavailable-page',
  imports: [RouterLink, OcButton, OcEmptyState, OcPageHeader],
  template: `
    <section class="unavailable-page" aria-labelledby="unavailable-title">
      <oc-page-header
        [title]="routeData.featureTitle"
        description="Fonctionnalité indisponible en production"
      />
      <oc-empty-state
        icon="info"
        title="Fonctionnalité non disponible"
        [description]="routeData.featureDescription"
      >
        <oc-button variant="secondary" routerLink="/doctor/command">Retour à l’accueil</oc-button>
      </oc-empty-state>
    </section>
  `,
  styles: `
    .unavailable-page {
      display: grid;
      gap: var(--oc-section-gap);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductionUnavailablePage {
  readonly routeData = inject(ActivatedRoute).snapshot.data as UnavailableRouteData;
}
