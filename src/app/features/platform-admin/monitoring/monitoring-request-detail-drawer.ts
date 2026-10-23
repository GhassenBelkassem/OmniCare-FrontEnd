import { ChangeDetectionStrategy, Component, input, model, signal } from '@angular/core';

import { OcButton, OcCard, OcDetailPanel, OcStatusBadge } from '../../../shared/ui';
import { RequestDetail } from '../monitoring.models';
import { formatOptional, formatTimestamp, requestOutcomeBadge, requestOutcomeLabel, requestPriorityLabel } from '../monitoring-status.util';

/**
 * Two-level detail: this drawer is the technical level, opened explicitly from the simple
 * request row. It shows only safe, aggregate metadata — never bodies, headers, tokens,
 * query strings or patient data. Optional technical fields are rendered as "Not available"
 * when absent, since real telemetry may not supply them.
 */
@Component({
  selector: 'oc-monitoring-request-detail-drawer',
  imports: [OcButton, OcCard, OcDetailPanel, OcStatusBadge],
  templateUrl: './monitoring-request-detail-drawer.html',
  styleUrl: './monitoring-panels.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MonitoringRequestDetailDrawer {
  readonly open = model(false);
  readonly request = input<RequestDetail | null>(null);
  readonly loading = input(false);
  readonly errorMessage = input<string | null>(null);
  readonly outcomeBadge = requestOutcomeBadge;
  readonly outcomeLabel = requestOutcomeLabel;
  readonly priorityLabel = requestPriorityLabel;
  readonly formatOptional = formatOptional;
  readonly format = formatTimestamp;

  /** Accessible copy feedback; announced via an aria-live region in the template. */
  readonly copiedLabel = signal<string | null>(null);

  close(): void {
    this.open.set(false);
    this.copiedLabel.set(null);
  }

  /** Copies an identifier to the clipboard and announces the result. */
  async copy(value: string | null, label: string): Promise<void> {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      this.copiedLabel.set(`${label} copied`);
    } catch {
      this.copiedLabel.set(`Could not copy ${label.toLowerCase()}`);
    }
  }
}
