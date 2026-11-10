import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { OcButton, OcEmptyState, OcPageHeader } from '../../../shared/ui';

@Component({
  selector: 'app-billing-page',
  imports: [RouterLink, OcButton, OcEmptyState, OcPageHeader],
  template: `
    <section class="coming-soon-page">
      <oc-page-header title="Facturation" description="Gestion des paiements et recus" />
      <oc-empty-state
        icon="account-book"
        title="Bientot disponible"
        description="La facturation simple avec suivi des paiements et generation de recus sera disponible dans une prochaine mise a jour."
      >
        <oc-button variant="secondary" routerLink="/doctor/command">Retour à l’accueil</oc-button>
      </oc-empty-state>
    </section>
  `,
  styles: `
    .coming-soon-page {
      display: grid;
      gap: var(--oc-section-gap);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BillingPage {}
