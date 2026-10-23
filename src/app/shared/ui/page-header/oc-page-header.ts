import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'oc-page-header',
  template: `
    <header class="oc-page-header">
      <div class="oc-page-header__main">
        <nav class="oc-page-header__breadcrumbs" aria-label="Breadcrumb">
          <ng-content select="[ocBreadcrumbs]" />
        </nav>
        <h1>{{ title() }}</h1>
        @if (description()) {
          <p>{{ description() }}</p>
        }
      </div>
      <div class="oc-page-header__actions" role="group" aria-label="Page actions">
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
  readonly description = input<string>();
}
