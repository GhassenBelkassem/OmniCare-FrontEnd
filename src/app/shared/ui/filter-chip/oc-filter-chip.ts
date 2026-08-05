import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';

@Component({
  selector: 'oc-filter-chip',
  imports: [NzIconModule],
  template: `
    <span class="oc-filter-chip">
      <span
        >{{ label() }}: <strong>{{ value() }}</strong></span
      >
      <button
        type="button"
        [attr.aria-label]="'Remove ' + label() + ' filter'"
        (click)="removed.emit()"
      >
        <nz-icon nzType="close" aria-hidden="true" />
      </button>
    </span>
  `,
  styleUrl: './oc-filter-chip.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OcFilterChip {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly removed = output<void>();
}
