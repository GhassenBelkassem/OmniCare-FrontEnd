import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Token-styled implementation of Spartan's presentational Skeleton pattern. */
@Component({
  selector: 'oc-skeleton',
  template: `<span
    class="oc-skeleton"
    [class.oc-skeleton--line]="variant() === 'line'"
    [class.oc-skeleton--block]="variant() === 'block'"
    [class.oc-skeleton--circle]="variant() === 'circle'"
    aria-hidden="true"
  ></span>`,
  styleUrl: './oc-skeleton.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OcSkeleton {
  readonly variant = input<'line' | 'block' | 'circle'>('line');
}
