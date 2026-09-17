import { ChangeDetectionStrategy, Component } from '@angular/core';
import { OcButton, OcEmptyState, OcPageHeader } from '../../../shared/ui';

@Component({
  selector: 'app-history-page',
  imports: [OcButton, OcEmptyState, OcPageHeader],
  template: `
    <section class="coming-soon-page">
      <oc-page-header
        title="Historique"
        description="Consultations passees et historique medical"
      />
      <oc-empty-state
        icon="history"
        title="Bientot disponible"
        description="L'historique detaille avec filtres avances et export sera disponible dans une prochaine mise a jour."
      >
        <oc-button variant="secondary">Retour a l'accueil</oc-button>
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
export class HistoryPage {}
