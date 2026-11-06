import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NzIconModule } from 'ng-zorro-antd/icon';

import { OcButton, OcStatusBadge, OcTabs } from '../../../shared/ui';
import type {
  ConsultationWorkspaceAction,
  ConsultationWorkspaceSection,
  ConsultationWorkspaceViewModel,
} from './consultation-workspace-view.models';

const WORKSPACE_SECTIONS: readonly ConsultationWorkspaceSection[] = [
  'note',
  'vitals',
  'prescription',
  'orders',
  'documents',
  'finalization',
];

@Component({
  selector: 'app-consultation-workspace-view',
  imports: [RouterLink, NzIconModule, OcButton, OcStatusBadge, OcTabs],
  templateUrl: './consultation-workspace-view.html',
  styleUrl: './consultation-workspace-view.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConsultationWorkspaceView {
  readonly model = input.required<ConsultationWorkspaceViewModel>();
  readonly action = output<ConsultationWorkspaceAction>();

  setSection(value: string): void {
    if (WORKSPACE_SECTIONS.includes(value as ConsultationWorkspaceSection)) {
      this.action.emit({ kind: 'SET_SECTION', section: value as ConsultationWorkspaceSection });
    }
  }
}
