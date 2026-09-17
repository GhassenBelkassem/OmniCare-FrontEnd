import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { OcButton } from '../../shared/ui';

@Component({
  selector: 'app-follow-up-page',
  imports: [OcButton],
  template: `
    <div class="follow-up">
      <section class="follow-up__panel">
        <h1>Rendez-vous de suivi</h1>
        <p>L'ecran de prise de rendez-vous (Module 05) n'est pas encore implemente dans cette application.</p>
        <p class="follow-up__note">Le futur flux de reservation sera branche ici depuis la cloture de consultation.</p>
        <div class="follow-up__actions">
          <oc-button variant="secondary" (click)="backToDashboard()">Retour au tableau de bord</oc-button>
        </div>
      </section>
    </div>
  `,
  styleUrl: './follow-up-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FollowUpPage {
  private readonly router = inject(Router);

  backToDashboard(): void {
    void this.router.navigate(['/doctor']);
  }
}
