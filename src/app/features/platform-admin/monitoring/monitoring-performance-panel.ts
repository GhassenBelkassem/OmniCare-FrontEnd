import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

import { OcCard, OcSegmentedControl, OcSegmentOption, OcStatusBadge } from '../../../shared/ui';
import { MonitoringPerformance, PerformanceWindow } from '../monitoring.models';
import { formatMetricValue, monitoringStatusBadge, monitoringStatusLabel } from '../monitoring-status.util';
import { MonitoringSparkline } from './monitoring-sparkline';

@Component({
  selector: 'oc-monitoring-performance-panel',
  imports: [OcCard, OcSegmentedControl, OcStatusBadge, MonitoringSparkline],
  templateUrl: './monitoring-performance-panel.html',
  styleUrl: './monitoring-panels.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MonitoringPerformancePanel {
  readonly performance = input.required<MonitoringPerformance>();
  readonly window = model.required<PerformanceWindow>();
  readonly statusBadge = monitoringStatusBadge;
  readonly statusLabel = monitoringStatusLabel;
  readonly formatValue = formatMetricValue;
  readonly windowOptions: readonly OcSegmentOption[] = [
    { value: '15m', label: '15m' },
    { value: '1h', label: '1h' },
    { value: '6h', label: '6h' },
    { value: '24h', label: '24h' },
  ];

  handleWindowChange(value: string): void {
    if (value === '15m' || value === '1h' || value === '6h' || value === '24h') {
      this.window.set(value);
    }
  }
}
