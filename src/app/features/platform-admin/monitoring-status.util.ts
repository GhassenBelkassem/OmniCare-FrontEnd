import { AlertSeverity, AlertState, MonitoringStatus, RequestOutcome, RequestPriority } from './monitoring.models';
import { OcStatus } from '../../shared/ui';

/**
 * Maps the monitoring status vocabulary onto the shared badge statuses. The point of this
 * layer is that missing telemetry never collapses into a "good" tone:
 * `UNKNOWN`/`NOT_INSTRUMENTED` are visually distinct from `HEALTHY`.
 */
export function monitoringStatusBadge(status: MonitoringStatus): OcStatus {
  switch (status) {
    case 'HEALTHY':
      return 'confirmed';
    case 'DEGRADED':
      return 'requires-attention';
    case 'CRITICAL':
      return 'critical';
    case 'UNKNOWN':
      return 'pending';
    case 'NOT_INSTRUMENTED':
    default:
      return 'in-progress';
  }
}

export function monitoringStatusLabel(status: MonitoringStatus): string {
  switch (status) {
    case 'HEALTHY':
      return 'Healthy';
    case 'DEGRADED':
      return 'Degraded';
    case 'CRITICAL':
      return 'Critical';
    case 'UNKNOWN':
      return 'Unknown';
    case 'NOT_INSTRUMENTED':
      return 'Not instrumented';
  }
}

/** Icon intent for a status, used by `OcIcon`. */
export function monitoringStatusIntent(
  status: MonitoringStatus,
): 'neutral' | 'success' | 'information' | 'warning' | 'critical' {
  switch (status) {
    case 'HEALTHY':
      return 'success';
    case 'DEGRADED':
      return 'warning';
    case 'CRITICAL':
      return 'critical';
    case 'UNKNOWN':
    case 'NOT_INSTRUMENTED':
    default:
      return 'neutral';
  }
}

export function alertSeverityBadge(severity: AlertSeverity): OcStatus {
  switch (severity) {
    case 'CRITICAL':
      return 'critical';
    case 'WARNING':
      return 'requires-attention';
    case 'INFO':
    default:
      return 'in-progress';
  }
}

export function alertSeverityLabel(severity: AlertSeverity): string {
  switch (severity) {
    case 'CRITICAL':
      return 'Critical';
    case 'WARNING':
      return 'Warning';
    case 'INFO':
      return 'Info';
  }
}

export function alertStateBadge(state: AlertState): OcStatus {
  switch (state) {
    case 'FIRING':
      return 'critical';
    case 'PENDING':
      return 'pending';
    case 'SILENCED':
      return 'blocked';
    case 'INHIBITED':
      return 'blocked';
    case 'RESOLVED':
    default:
      return 'completed';
  }
}

export function alertStateLabel(state: AlertState): string {
  switch (state) {
    case 'FIRING':
      return 'Firing';
    case 'PENDING':
      return 'Pending';
    case 'SILENCED':
      return 'Silenced';
    case 'INHIBITED':
      return 'Inhibited';
    case 'RESOLVED':
      return 'Resolved';
  }
}

export function requestOutcomeBadge(outcome: RequestOutcome): OcStatus {
  switch (outcome) {
    case 'SUCCESS':
      return 'confirmed';
    case 'SERVER_ERROR':
      return 'critical';
    case 'CLIENT_ERROR':
      return 'blocked';
    case 'UNKNOWN':
    default:
      return 'pending';
  }
}

export function requestOutcomeLabel(outcome: RequestOutcome): string {
  switch (outcome) {
    case 'SUCCESS':
      return 'Success';
    case 'CLIENT_ERROR':
      return 'Client error';
    case 'SERVER_ERROR':
      return 'Server error';
    case 'UNKNOWN':
      return 'Unknown';
  }
}

/** Human label for the request priority, including the unevaluated `UNKNOWN` case. */
export function requestPriorityLabel(priority: RequestPriority): string {
  switch (priority) {
    case 'FAILED':
      return 'Failed';
    case 'SLOW':
      return 'Slow';
    case 'NORMAL':
      return 'Normal';
    case 'UNKNOWN':
      return 'Unknown';
  }
}

/**
 * Renders an optional HTTP metadata value. Absent values become "Not available" — the UI must
 * never imply a status/duration/method/route exists when the telemetry did not supply one.
 */
export function formatOptional(value: string | number | null | undefined, suffix = ''): string {
  return value === null || value === undefined || value === '' ? 'Not available' : `${value}${suffix}`;
}

/**
 * Renders an optional timestamp. A missing or unparsable instant becomes "Not available"
 * rather than the raw text of a placeholder.
 */
export function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return 'Not available';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Renders the age of the last operational snapshot. The backend reports `-1` when no sample
 * was returned, which must read as "not available" and never as an age.
 */
export function formatFreshness(seconds: number): string {
  return seconds < 0 ? 'Not available' : `${seconds}s ago`;
}

/**
 * Renders a value the backend formats as a string. Prometheus and the backlog counters
 * return an empty string when the sample could not be collected; that is an absent value,
 * not a zero.
 */
export function formatMetricValue(value: string | null | undefined): string {
  return value === null || value === undefined || value.trim() === '' ? 'Not available' : value;
}
