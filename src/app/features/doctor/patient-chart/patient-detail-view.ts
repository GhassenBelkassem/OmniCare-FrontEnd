import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { OcButton, OcIcon, OcTabs } from '../../../shared/ui';
import type {
  PatientDetailAction,
  PatientDetailTab,
  PatientDetailViewModel,
} from './patient-detail-view.models';

@Component({
  selector: 'app-patient-detail-view',
  imports: [OcButton, OcIcon, OcTabs],
  templateUrl: './patient-detail-view.html',
  styleUrl: './patient-detail-view.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientDetailView {
  readonly model = input.required<PatientDetailViewModel>();
  readonly action = output<PatientDetailAction>();

  selectTab(value: string): void {
    if (!isPatientDetailTab(value)) return;
    this.action.emit({ kind: 'SELECT_TAB', value });
  }

  navigate(kind: 'NAVIGATE_DIRECTORY' | 'SCHEDULE', event: MouseEvent): void {
    if (event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }
    event.preventDefault();
    this.action.emit({ kind });
  }

  formatDate(value: string): string {
    return formatPatientDate(value, { day: '2-digit', month: 'long', year: 'numeric' });
  }

  formatShortDate(value: string): string {
    return formatPatientDate(value, { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  formatTime(value: string): string {
    return formatPatientDate(value, { hour: '2-digit', minute: '2-digit' });
  }

  formatDay(value: string): string {
    return formatPatientDate(value, { day: '2-digit' });
  }

  formatMonth(value: string): string {
    return formatPatientDate(value, { month: 'short' }).replace('.', '').toLocaleUpperCase('fr-FR');
  }
}

export function isPatientDetailTab(value: string | null): value is PatientDetailTab {
  return (
    value === 'overview' ||
    value === 'consultations' ||
    value === 'documents' ||
    value === 'timeline'
  );
}

function formatPatientDate(value: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('fr-FR', {
    ...options,
    timeZone: 'Africa/Tunis',
  }).format(new Date(value));
}
