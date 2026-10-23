import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';

import { OcEmptyState, OcStatusBadge } from '../../../shared/ui';
import { MonitoringAlert, MonitoringAlerts } from '../monitoring.models';
import {
  alertSeverityBadge,
  alertSeverityLabel,
  alertStateBadge,
  alertStateLabel,
  formatTimestamp,
} from '../monitoring-status.util';

@Component({
  selector: 'oc-monitoring-alerts-panel',
  imports: [OcEmptyState, OcStatusBadge],
  templateUrl: './monitoring-alerts-panel.html',
  styleUrl: './monitoring-panels.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MonitoringAlertsPanel {
  readonly alerts = input.required<MonitoringAlerts>();
  readonly severityBadge = alertSeverityBadge;
  readonly severityLabel = alertSeverityLabel;
  readonly stateBadge = alertStateBadge;
  readonly stateLabel = alertStateLabel;
  readonly format = formatTimestamp;

  /** Which alert's technical details are expanded. Only one at a time keeps the list calm. */
  readonly expandedId = signal<string | null>(null);

  tableState(): 'default' | 'empty' {
    return this.alerts().active.length ? 'default' : 'empty';
  }

  isExpanded(alert: MonitoringAlert): boolean {
    return this.expandedId() === alert.id;
  }

  toggle(alert: MonitoringAlert): void {
    this.expandedId.update((current) => (current === alert.id ? null : alert.id));
  }

  labelEntries(labels: Readonly<Record<string, string>>): readonly { key: string; value: string }[] {
    return Object.entries(labels).map(([key, value]) => ({ key, value }));
  }
}
