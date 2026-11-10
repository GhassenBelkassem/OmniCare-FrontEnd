import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';

@Component({
  selector: 'oc-detail-panel',
  imports: [NzDrawerModule],
  template: `
    <nz-drawer
      [nzVisible]="open()"
      nzPlacement="right"
      [nzWidth]="width()"
      [nzTitle]="title()"
      [nzClosable]="true"
      [nzMaskClosable]="true"
      [nzKeyboard]="true"
      (nzOnClose)="close()"
    >
      <ng-container *nzDrawerContent>
        <ng-content />
      </ng-container>
      @if (hasActions) {
        <ng-template #drawerFooter>
          <div class="oc-detail-panel__footer">
            <ng-content select="[ocDetailActions]" />
          </div>
        </ng-template>
      }
    </nz-drawer>
  `,
  styleUrl: './oc-detail-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OcDetailPanel {
  readonly open = model(false);
  readonly title = input('');
  readonly width = input('min(480px, 100vw)');
  readonly closed = output<void>();
  hasActions = false;

  close(): void {
    this.open.set(false);
    this.closed.emit();
  }
}
