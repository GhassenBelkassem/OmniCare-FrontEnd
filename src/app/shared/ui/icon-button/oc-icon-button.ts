import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';

@Component({
  selector: 'oc-icon-button',
  imports: [NzButtonModule, NzIconModule, NzTooltipModule],
  template: `
    <button
      nz-button
      nz-tooltip
      [nzTooltipTitle]="tooltip() || label()"
      [nzType]="appearance() === 'quiet' ? 'text' : 'default'"
      [nzLoading]="loading()"
      [disabled]="disabled() || loading()"
      type="button"
      [attr.aria-label]="label()"
      [attr.aria-busy]="loading()"
    >
      <nz-icon [nzType]="icon()" aria-hidden="true" />
    </button>
  `,
  styleUrl: './oc-icon-button.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OcIconButton {
  readonly label = input.required<string>();
  readonly icon = input.required<string>();
  readonly tooltip = input<string>();
  readonly appearance = input<'default' | 'quiet'>('default');
  readonly disabled = input(false);
  readonly loading = input(false);
}
