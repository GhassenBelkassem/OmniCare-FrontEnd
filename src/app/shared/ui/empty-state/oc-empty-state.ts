import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { OcIcon, OcIconName } from '../icon/oc-icon';

@Component({
  selector: 'oc-empty-state',
  imports: [OcIcon],
  template: `
    <section class="oc-empty-state" [attr.aria-label]="title()">
      <span class="oc-empty-state__icon"><oc-icon [name]="icon()" intent="information" /></span>
      <h3>{{ title() }}</h3>
      <p>{{ description() }}</p>
      <div class="oc-empty-state__actions"><ng-content /></div>
    </section>
  `,
  styleUrl: './oc-empty-state.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OcEmptyState {
  readonly icon = input<OcIconName | string>('requests');
  readonly title = input.required<string>();
  readonly description = input.required<string>();
}
