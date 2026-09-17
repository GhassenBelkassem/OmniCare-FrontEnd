import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'oc-card',
  template: `
    <section class="oc-card" [class.oc-card--compact]="compact()" [attr.aria-label]="title()">
      <header class="oc-card__header">
        <div class="oc-card__header-main">
          <h2 class="oc-card__title">{{ title() }}</h2>
          @if (subtitle()) {
            <p class="oc-card__subtitle">{{ subtitle() }}</p>
          }
        </div>
        <div class="oc-card__header-actions"><ng-content select="[ocCardActions]" /></div>
      </header>
      <div class="oc-card__body"><ng-content /></div>
      @if (hasFooter) {
        <footer class="oc-card__footer"><ng-content select="[ocCardFooter]" /></footer>
      }
    </section>
  `,
  styleUrl: './oc-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OcCard {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
  readonly compact = input(false);
  hasFooter = false;
}
