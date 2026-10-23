import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { OcCard, OcIcon, OcStatusBadge } from '../../../shared/ui';
import { MonitoringOverview } from '../monitoring.models';
import {
  formatFreshness,
  monitoringStatusBadge,
  monitoringStatusIntent,
  monitoringStatusLabel,
} from '../monitoring-status.util';

@Component({
  selector: 'oc-monitoring-overview-panel',
  imports: [OcCard, OcIcon, OcStatusBadge],
  templateUrl: './monitoring-overview-panel.html',
  styleUrl: './monitoring-panels.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MonitoringOverviewPanel {
  readonly overview = input.required<MonitoringOverview>();
  readonly statusBadge = monitoringStatusBadge;
  readonly statusLabel = monitoringStatusLabel;
  readonly statusIntent = monitoringStatusIntent;
  readonly formatFreshness = formatFreshness;
}
