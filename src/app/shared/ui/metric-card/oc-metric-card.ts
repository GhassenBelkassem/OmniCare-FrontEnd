import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';

@Component({
  selector: 'oc-metric-card',
  imports: [NzIconModule, NzSkeletonModule],
  template: `
    <article class="oc-metric-card" [attr.aria-label]="label()">
      @if (loading()) {
        <nz-skeleton [nzActive]="true" [nzParagraph]="{ rows: 1 }" [nzTitle]="true" />
      } @else {
        <div class="oc-metric-card__header">
          <span class="oc-metric-card__icon" aria-hidden="true"><nz-icon [nzType]="icon()" /></span>
          @if (trend()) {
            <span class="oc-metric-card__trend">{{ trend() }}</span>
          }
        </div>
        <p class="oc-metric-card__label">{{ label() }}</p>
        <p class="oc-metric-card__value">{{ value() }}</p>
        @if (supportingText()) {
          <p class="oc-metric-card__support">{{ supportingText() }}</p>
        }
      }
    </article>
  `,
  styleUrl: './oc-metric-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OcMetricCard {
  readonly icon = input('dashboard');
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly supportingText = input<string>();
  readonly trend = input<string>();
  readonly loading = input(false);
}
