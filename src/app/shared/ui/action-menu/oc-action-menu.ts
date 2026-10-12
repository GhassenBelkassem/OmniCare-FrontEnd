import { CdkMenuModule } from '@angular/cdk/menu';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';

/** Compact, keyboard-operable overflow menu using the project's installed CDK. */
@Component({
  selector: 'oc-action-menu',
  imports: [CdkMenuModule, NzIconModule],
  template: `
    <button
      type="button"
      class="oc-action-menu__trigger"
      [cdkMenuTriggerFor]="menu"
      [attr.aria-label]="label()"
      [title]="label()"
    >
      <nz-icon nzType="more" aria-hidden="true" />
    </button>

    <ng-template #menu>
      <div class="oc-action-menu__content" cdkMenu>
        <button
          type="button"
          class="oc-action-menu__item oc-action-menu__item--destructive"
          cdkMenuItem
          (cdkMenuItemTriggered)="deleteRequested.emit()"
        >
          <nz-icon nzType="delete" aria-hidden="true" />
          {{ deleteLabel() }}
        </button>
      </div>
    </ng-template>
  `,
  styleUrl: './oc-action-menu.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OcActionMenu {
  readonly label = input('Plus d’actions');
  readonly deleteLabel = input('Supprimer');
  readonly deleteRequested = output<void>();
}
