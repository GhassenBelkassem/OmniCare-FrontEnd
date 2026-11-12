import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { OcButton, OcEmptyState, OcPageHeader } from '../../../shared/ui';

@Component({
  selector: 'app-communication-page',
  imports: [RouterLink, OcButton, OcEmptyState, OcPageHeader],
  template: `
    <section class="coming-soon-page">
      <oc-page-header title="Communication" description="Messagerie et appels avec vos patients" />
      <oc-empty-state
        icon="message"
        title="Bientot disponible"
        description="La messagerie et les appels seront disponibles dans une prochaine mise a jour. Cette fonctionnalite est en cours de developpement."
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
export class CommunicationPage {}
