import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'oc-page-header',
  template: `
    <header class="oc-page-header">
      <div class="oc-page-header__main">
        <nav class="oc-page-header__breadcrumbs" aria-label="Fil d’Ariane">
          <ng-content select="[ocBreadcrumbs]" />
        </nav>
        <h1>{{ title() }}</h1>
        @if (subtitle() || description()) {
          <p>{{ subtitle() || description() }}</p>
        }
      </div>
      <div class="oc-page-header__aside" aria-hidden="true"><ng-content select="[ocPageHeaderAside]" /></div>
      <div class="oc-page-header__actions" role="group" aria-label="Actions de la page">
        <ng-content select="[ocSecondaryActions]" />
        <ng-content select="[ocPrimaryAction]" />
      </div>
    </header>
  `,
  styleUrl: './oc-page-header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OcPageHeader {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
  /** @deprecated use `subtitle`. */
  readonly description = input<string>();
}
