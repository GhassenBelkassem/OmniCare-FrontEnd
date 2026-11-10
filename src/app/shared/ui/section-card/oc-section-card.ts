import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';

/** Card with an icon + title header, an optional action slot and content. */
@Component({
  selector: 'oc-section-card',
  imports: [NzIconModule],
  template: `
    <section class="oc-section-card" [attr.aria-labelledby]="headingId">
      <header class="oc-section-card__header">
        @if (icon()) {
          <span class="oc-section-card__icon" aria-hidden="true"><nz-icon [nzType]="icon()!" /></span>
        }
        <div class="oc-section-card__heading">
          <h2 [id]="headingId">{{ title() }}</h2>
          @if (subtitle()) {
            <p>{{ subtitle() }}</p>
          }
        </div>
        <div class="oc-section-card__action"><ng-content select="[ocSectionAction]" /></div>
      </header>
      <div class="oc-section-card__body"><ng-content /></div>
    </section>
  `,
  styles: `
    :host { display: block; min-width: 0; }
    .oc-section-card {
      overflow: hidden;
      border: 1px solid var(--oc-color-border-default);
      border-radius: var(--oc-radius-lg);
      background: var(--oc-color-surface-card);
      box-shadow: var(--oc-shadow-sm);
    }
    .oc-section-card__header {
      display: flex;
      align-items: center;
      gap: var(--oc-space-3);
      padding: var(--oc-space-4) var(--oc-space-6);
      border-block-end: 1px solid var(--oc-color-border-default);
    }
    .oc-section-card__icon {
      display: inline-grid;
      width: 32px;
      height: 32px;
      flex: 0 0 auto;
      place-items: center;
      border-radius: var(--oc-radius-md);
      background: var(--oc-primary-tint);
      color: var(--oc-primary-dark);
    }
    .oc-section-card__heading { min-width: 0; flex: 1; }
    h2 {
      margin: 0;
      color: var(--oc-color-text-primary);
      font-size: var(--oc-text-h3-size);
      font-weight: var(--oc-text-h3-weight);
      line-height: var(--oc-text-h3-line-height);
    }
    p {
      margin: 2px 0 0;
      color: var(--oc-color-text-muted);
      font-size: var(--oc-text-caption-size);
    }
    .oc-section-card__action { display: flex; gap: var(--oc-space-2); }
    .oc-section-card__body { padding: var(--oc-space-4) var(--oc-space-6); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OcSectionCard {
  private static nextId = 0;
  readonly headingId = `oc-section-card-${OcSectionCard.nextId++}`;
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
  readonly icon = input<string>();
}
