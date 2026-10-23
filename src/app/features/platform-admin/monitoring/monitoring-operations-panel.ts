import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { OcCard, OcStatusBadge } from '../../../shared/ui';
import { MonitoringOperations } from '../monitoring.models';
import { formatMetricValue, monitoringStatusBadge, monitoringStatusLabel } from '../monitoring-status.util';

@Component({
  selector: 'oc-monitoring-operations-panel',
  imports: [OcCard, OcStatusBadge],
  templateUrl: './monitoring-operations-panel.html',
  styleUrl: './monitoring-panels.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MonitoringOperationsPanel {
  readonly operations = input.required<MonitoringOperations>();
  readonly statusBadge = monitoringStatusBadge;
  readonly statusLabel = monitoringStatusLabel;
  readonly formatValue = formatMetricValue;
}
