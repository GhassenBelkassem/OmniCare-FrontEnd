import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { BrnOverlayState } from '@spartan-ng/brain/overlay';
import { BrnPopoverAlign, BrnPopoverImports } from '@spartan-ng/brain/popover';

export type OcPopoverTriggerAppearance = 'plain' | 'icon';

/**
 * Vendor-neutral non-modal disclosure backed by Spartan Brain.
 *
 * Brain owns positioning, outside-click and Escape dismissal, initial focus,
 * and focus restoration. Feature code supplies only the trigger and content.
 */
@Component({
  selector: 'oc-popover',
  imports: [BrnPopoverImports],
  template: `
    <span
      brnPopover
      [state]="open() ? 'open' : 'closed'"
      [align]="align()"
      [sideOffset]="sideOffset()"
      [autoFocus]="true"
      [closeOnOutsidePointerEvents]="true"
      [disableClose]="disabled()"
      [role]="null"
      (stateChanged)="onStateChanged($event)"
    >
      <button
        brnPopoverTrigger
        class="oc-popover__trigger"
        [class.oc-popover__trigger--icon]="triggerAppearance() === 'icon'"
        [class.oc-popover__trigger--active]="open()"
        [attr.aria-label]="triggerLabel()"
        [disabled]="disabled()"
      >
        <ng-content select="[ocPopoverTrigger]" />
      </button>

      <ng-template brnPopoverContent class="oc-popover-panel">
        <section
          class="oc-popover__surface"
          role="dialog"
          [attr.aria-label]="label()"
          [style.--oc-popover-width]="width()"
        >
          <ng-content />
        </section>
      </ng-template>
    </span>
  `,
  styleUrl: './oc-popover.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OcPopover {
  readonly open = input(false);
  readonly label = input.required<string>();
  readonly triggerLabel = input.required<string>();
  readonly triggerAppearance = input<OcPopoverTriggerAppearance>('plain');
  readonly align = input<BrnPopoverAlign>('end');
  readonly sideOffset = input(8);
  readonly width = input('min(24rem, calc(100vw - 2rem))');
  readonly disabled = input(false);
  readonly openChange = output<boolean>();

  protected onStateChanged(state: BrnOverlayState): void {
    const nextOpen = state === 'open';
    if (nextOpen !== this.open()) this.openChange.emit(nextOpen);
  }
}
