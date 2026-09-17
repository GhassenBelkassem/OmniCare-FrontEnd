import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'oc-stat-row',
  template: `
    <div class="oc-stat-row" [class.oc-stat-row--muted]="muted()">
      <span class="oc-stat-row__label">{{ label() }}</span>
      <span class="oc-stat-row__value">{{ value() }}</span>
    </div>
  `,
  styleUrl: './oc-stat-row.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OcStatRow {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly muted = input(false);
}
