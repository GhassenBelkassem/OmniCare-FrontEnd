import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { OcIcon, OcPageHeader, OcStatusTag } from '../../../shared/ui';
import type {
  CommandCenterAction,
  CommandCenterLinkAction,
  CommandCenterViewModel,
} from './command-center-view.models';

@Component({
  selector: 'app-command-center-view',
  imports: [OcIcon, OcPageHeader, OcStatusTag],
  templateUrl: './command-center-view.html',
  styleUrl: './command-center-view.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommandCenterView {
  readonly model = input.required<CommandCenterViewModel>();
  readonly action = output<CommandCenterAction>();

  activateLink(event: MouseEvent, action: CommandCenterLinkAction): void {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    this.action.emit(action);
  }

  activate(action: CommandCenterAction): void {
    this.action.emit(action);
  }

  activateActionLink(event: MouseEvent, action: CommandCenterAction): void {
    if ('href' in action) this.activateLink(event, action);
  }

  actionHref(action: CommandCenterAction): string | null {
    return 'href' in action ? action.href : null;
  }
}
