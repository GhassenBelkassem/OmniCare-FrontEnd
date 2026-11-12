import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NzTagModule } from 'ng-zorro-antd/tag';

/**
 * One kind of medical information = one tone (tint background + same-hue text, ≥ 4.5:1).
 * `value` is the white bordered tag for structured values (dose, voie, fréquence…).
 */
export type OcTagTone = 'value' | 'care' | 'allergy' | 'history' | 'blood' | 'current' | 'neutral';

/** Small tag (radius 8, 13 / 600) for a structured value or a status. */
@Component({
  selector: 'oc-tag',
  imports: [NzTagModule],
  template: `<nz-tag class="oc-tag" [class]="'oc-tag oc-tag--' + tone()"><ng-content /></nz-tag>`,
  styles: `
    :host { display: inline-flex; max-width: 100%; }
    .oc-tag {
      display: inline-flex;
      align-items: center;
      gap: var(--oc-space-1);
      max-width: 100%;
      margin: 0;
      padding: 2px var(--oc-space-2);
      border: 1px solid transparent;
      border-radius: var(--oc-radius-tag);
      font-size: var(--oc-text-small-size);
      font-weight: var(--oc-font-weight-semibold);
      line-height: 20px;
      white-space: normal;
      overflow-wrap: anywhere;
    }
    .oc-tag--value, .oc-tag--neutral { border-color: var(--oc-hairline); background: var(--oc-surface); color: var(--oc-ink); }
    .oc-tag--neutral { color: var(--oc-ink-secondary); }
    .oc-tag--care { background: var(--oc-info-care-tint); color: var(--oc-info-care); }
    .oc-tag--allergy { background: var(--oc-info-allergy-tint); color: var(--oc-info-allergy); }
    .oc-tag--history { background: var(--oc-info-history-tint); color: var(--oc-info-history); }
    .oc-tag--blood { background: var(--oc-info-blood-tint); color: var(--oc-info-blood); }
    .oc-tag--current { background: var(--oc-info-current-tint); color: var(--oc-info-current); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OcTag {
  readonly tone = input<OcTagTone>('value');
}
