import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type OcStatus =
  | 'draft'
  | 'pending'
  | 'in-progress'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'blocked'
  | 'requires-attention'
  | 'critical'
  | 'expired';

const STATUS_LABELS: Record<OcStatus, string> = {
  draft: 'Draft',
  pending: 'Pending',
  'in-progress': 'In progress',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
  blocked: 'Blocked',
  'requires-attention': 'Requires attention',
  critical: 'Critical',
  expired: 'Expired',
};

@Component({
  selector: 'oc-status-badge',
  template: `<span class="oc-status" [class]="'oc-status oc-status--' + tone()"
    ><span class="oc-status__dot" aria-hidden="true"></span>{{ label() }}</span
  >`,
  styleUrl: './oc-status-badge.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OcStatusBadge {
  readonly status = input.required<OcStatus>();
  readonly customLabel = input<string>();
  readonly label = computed(() => this.customLabel() ?? STATUS_LABELS[this.status()]);
  readonly tone = computed(() => {
    const status = this.status();
    if (status === 'confirmed' || status === 'completed') return 'success';
    if (status === 'pending' || status === 'requires-attention') return 'warning';
    if (
      status === 'cancelled' ||
      status === 'blocked' ||
      status === 'critical' ||
      status === 'expired'
    )
      return 'critical';
    if (status === 'in-progress') return 'information';
    return 'neutral';
  });
}
