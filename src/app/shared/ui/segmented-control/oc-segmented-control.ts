import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  model,
  viewChildren,
} from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';

export interface OcSegmentOption {
  readonly value: string;
  readonly label: string;
  readonly icon?: string;
  readonly disabled?: boolean;
}

@Component({
  selector: 'oc-segmented-control',
  imports: [NzIconModule],
  template: `
    <div class="oc-segmented" role="group" [attr.aria-label]="label()">
      @for (option of options(); track option.value; let index = $index) {
        <button
          #segmentButton
          type="button"
          [disabled]="option.disabled"
          [class.oc-segmented__button--selected]="selected() === option.value"
          [attr.aria-pressed]="selected() === option.value"
          (click)="select(option.value)"
          (keydown.arrowright)="move(index, 1, $event)"
          (keydown.arrowleft)="move(index, -1, $event)"
        >
          @if (option.icon) {
            <nz-icon [nzType]="option.icon" aria-hidden="true" />
          }
          <span>{{ option.label }}</span>
        </button>
      }
    </div>
  `,
  styleUrl: './oc-segmented-control.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OcSegmentedControl {
  readonly label = input.required<string>();
  readonly options = input.required<readonly OcSegmentOption[]>();
  readonly selected = model.required<string>();
  private readonly buttons = viewChildren<ElementRef<HTMLButtonElement>>('segmentButton');

  select(value: string): void {
    this.selected.set(value);
  }

  move(index: number, direction: 1 | -1, event: Event): void {
    event.preventDefault();
    const options = this.options();
    let nextIndex = index;
    for (let attempt = 0; attempt < options.length; attempt += 1) {
      nextIndex = (nextIndex + direction + options.length) % options.length;
      if (!options[nextIndex]?.disabled) break;
    }
    const next = options[nextIndex];
    if (next) {
      this.selected.set(next.value);
      this.buttons()[nextIndex]?.nativeElement.focus();
    }
  }
}
