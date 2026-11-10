import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';

import { OcButton, OcDataTableShell, OcEmptyState, OcIcon, OcPageHeader } from '../../../shared/ui';
import type {
  PatientDirectoryAction,
  PatientDirectoryRow,
  PatientDirectorySortKey,
  PatientDirectoryViewModel,
} from './patient-directory-view.models';

@Component({
  selector: 'app-patient-directory-view',
  imports: [NzIconModule, OcButton, OcDataTableShell, OcEmptyState, OcIcon, OcPageHeader],
  templateUrl: './patient-directory-view.html',
  styleUrl: './patient-directory-view.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientDirectoryView {
  readonly model = input.required<PatientDirectoryViewModel>();
  readonly action = output<PatientDirectoryAction>();

  emitSearch(event: Event): void {
    this.action.emit({
      kind: 'SEARCH',
      value: (event.target as HTMLInputElement).value,
    });
  }

  emitSelect(
    kind: 'SELECT_LAST_CONSULTATION' | 'SELECT_SOURCE' | 'SELECT_LINKAGE',
    event: Event,
  ): void {
    this.action.emit({
      kind,
      value: (event.target as HTMLSelectElement).value,
    });
  }

  emitChecked(kind: 'TOGGLE_VISIBLE', event: Event): void;
  emitChecked(kind: 'TOGGLE_PATIENT', event: Event, id: string): void;
  emitChecked(kind: 'TOGGLE_VISIBLE' | 'TOGGLE_PATIENT', event: Event, id?: string): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (kind === 'TOGGLE_VISIBLE') {
      this.action.emit({ kind, checked });
      return;
    }
    if (id) this.action.emit({ kind, id, checked });
  }

  ariaSort(key: PatientDirectorySortKey): 'ascending' | 'descending' | 'none' {
    const model = this.model();
    if (!model.sortable || model.sortKey !== key) return 'none';
    return model.sortDirection === 'asc' ? 'ascending' : 'descending';
  }

  openPatient(row: PatientDirectoryRow, event: MouseEvent): void {
    if (event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }
    event.preventDefault();
    this.action.emit({ kind: 'OPEN_PATIENT', id: row.id });
  }
}
