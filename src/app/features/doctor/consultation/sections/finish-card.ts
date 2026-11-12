import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';

import { OcButton } from '../../../../shared/ui';
import { ConsultationFinishFlow } from '../consultation-finish.flow';
import { ConsultationUi } from '../consultation-ui';
import type { ChecklistTarget } from '../model/consultation-errors';

/** Right column: the live checklist of the four required items and the « Terminer » button. */
@Component({
  selector: 'app-finish-card',
  imports: [NzIconModule, OcButton],
  template: `
    <section class="c-card" aria-labelledby="finish-title">
      <header class="c-card__header">
        <div class="c-card__title">
          <span class="c-card__tile" aria-hidden="true"><nz-icon nzType="check-circle" /></span>
          <h2 id="finish-title">Avant de terminer</h2>
        </div>
      </header>
      <div class="c-card__body">
        <ul class="c-checklist">
          @for (item of flow.checklist(); track item.target) {
            <li
              [class.c-checklist__item--done]="item.done"
              [class.c-checklist__item--blocking]="!item.done && flow.attempted()"
              [attr.data-state]="item.done ? 'done' : flow.attempted() ? 'blocking' : 'missing'"
            >
              <nz-icon [nzType]="item.done ? 'check-circle' : 'exclamation-circle'" aria-hidden="true" />
              <button type="button" class="c-checklist__link" (click)="ui.scrollTo(item.target)">
                {{ item.label }}<span class="c-sr-only">{{ item.done ? ' : renseigné' : ' : à compléter' }}</span>
              </button>
            </li>
          }
        </ul>

        @if (flow.missing().length > 0) {
          <div class="c-alert" role="alert">
            Il manque :
            @for (item of flow.missing(); track item.label; let last = $last) {
              <button type="button" class="c-missing" (click)="go(item.target)">{{ item.label }}</button>{{ last ? '.' : ', ' }}
            }
          </div>
        }
        @if (flow.error(); as message) {
          <p class="c-alert" role="alert">{{ message }}</p>
        }

        <oc-button
          variant="primary"
          [loading]="flow.busy()"
          (click)="finish.emit()"
        >{{ flow.buttonLabel() }}</oc-button>
        <p class="c-helper">Tout est enregistré automatiquement pendant la saisie.</p>
      </div>
    </section>
  `,
  styleUrl: './consultation-sections.scss',
  styles: `
    .c-card__tile { display: inline-grid; flex: 0 0 40px; width: 40px; height: 40px; place-items: center; border-radius: var(--oc-radius-icon); background: var(--oc-info-care-tint); color: var(--oc-info-care-icon); font-size: 18px; }
    .c-checklist { display: grid; gap: var(--oc-space-2); margin: 0; padding: 0; list-style: none; }
    /* Missing = amber until a « Terminer » attempt, then red; done = primary check. */
    .c-checklist li { display: flex; align-items: center; gap: var(--oc-space-2); color: var(--oc-info-allergy-icon); font-size: 16px; }
    .c-checklist li.c-checklist__item--done { color: var(--oc-info-care-icon); }
    .c-checklist li.c-checklist__item--blocking { color: var(--oc-error-dark); }
    .c-checklist__link, .c-missing {
      padding: 0;
      border: 0;
      background: none;
      color: var(--oc-ink);
      font: inherit;
      font-size: var(--oc-text-body-size);
      text-align: start;
      cursor: pointer;
    }
    .c-checklist__link:hover, .c-checklist__link:focus-visible, .c-missing:hover, .c-missing:focus-visible { text-decoration: underline; }
    .c-missing { color: inherit; font-weight: var(--oc-font-weight-semibold); }
    .c-sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
    oc-button { display: block; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FinishCard {
  readonly flow = inject(ConsultationFinishFlow);
  readonly ui = inject(ConsultationUi);
  /** The page runs the orchestration (it owns scrolling and the confirmation). */
  readonly finish = output<void>();

  go(target: ChecklistTarget): void {
    this.ui.scrollTo(target);
  }
}
