import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NzTagModule } from 'ng-zorro-antd/tag';

import { APPOINTMENT_STATUS, appointmentStatusPresentation } from '../appointment-status';

/** Appointment status as a coloured NG-ZORRO tag, from the shared status mapping. */
@Component({
  selector: 'oc-status-tag',
  imports: [NzTagModule],
  template: `
    <nz-tag
      class="oc-status-tag"
      [style.--oc-status-color]="presentation().color"
      [style.--oc-status-tint]="presentation().tint"
      [style.--oc-status-text]="presentation().text"
    >
      <span class="oc-status-tag__dot" aria-hidden="true"></span>{{ label() }}
    </nz-tag>
  `,
  styles: `
    :host { display: inline-flex; }
    .oc-status-tag {
      display: inline-flex;
      align-items: center;
      gap: var(--oc-space-1);
      margin: 0;
      padding: 0 var(--oc-space-2);
      border: 1px solid color-mix(in srgb, var(--oc-status-color) 35%, transparent);
      border-radius: var(--oc-radius-pill);
      background: var(--oc-status-tint);
      color: var(--oc-status-text);
      font-size: var(--oc-text-caption-size);
      font-weight: var(--oc-font-weight-semibold);
      line-height: 22px;
    }
    .oc-status-tag__dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--oc-status-color);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OcStatusTag {
  /** Any appointment or pending booking-request status code. */
  readonly status = input.required<string>();
  readonly presentation = computed(
    () => appointmentStatusPresentation(this.status()) ?? APPOINTMENT_STATUS.COMPLETED,
  );
  readonly label = computed(() =>
    appointmentStatusPresentation(this.status()) ? this.presentation().label : 'Statut inconnu',
  );
}
