import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';

@Component({
  selector: 'oc-empty-state',
  imports: [NzIconModule],
  template: `
    <section class="oc-empty-state" [attr.aria-label]="title()">
      <span class="oc-empty-state__icon" aria-hidden="true"><nz-icon [nzType]="icon()" /></span>
      <h3>{{ title() }}</h3>
      <p>{{ description() }}</p>
      <div class="oc-empty-state__actions"><ng-content /></div>
    </section>
  `,
  styleUrl: './oc-empty-state.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OcEmptyState {
  readonly icon = input('file-text');
  readonly title = input.required<string>();
  readonly description = input.required<string>();
}
