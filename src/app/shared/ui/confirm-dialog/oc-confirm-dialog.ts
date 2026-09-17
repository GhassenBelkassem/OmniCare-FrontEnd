import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { NzModalModule } from 'ng-zorro-antd/modal';

import { OcButton } from '../button/oc-button';

@Component({
  selector: 'oc-confirm-dialog',
  imports: [NzModalModule, OcButton],
  template: `
    <nz-modal
      [nzVisible]="open()"
      [nzTitle]="title()"
      [nzClosable]="true"
      [nzMaskClosable]="true"
      [nzKeyboard]="true"
      [nzFooter]="null"
      (nzOnCancel)="close()"
    >
      <ng-template nzModalContent>
        <p class="oc-confirm-dialog__message">{{ message() }}</p>
      </ng-template>
      <ng-template nzModalFooter>
        <div class="oc-confirm-dialog__actions">
          <oc-button variant="secondary" (click)="close()">{{ cancelLabel() }}</oc-button>
          <oc-button
            [variant]="destructive() ? 'destructive' : 'primary'"
            [loading]="loading()"
            (click)="confirm.emit()"
          >{{ confirmLabel() }}</oc-button>
        </div>
      </ng-template>
    </nz-modal>
  `,
  styleUrl: './oc-confirm-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OcConfirmDialog {
  readonly open = model(false);
  readonly title = input('Confirm action');
  readonly message = input('Are you sure?');
  readonly confirmLabel = input('Confirm');
  readonly cancelLabel = input('Cancel');
  readonly destructive = input(false);
  readonly loading = input(false);
  readonly confirm = output<void>();
  readonly cancelled = output<void>();

  close(): void {
    this.open.set(false);
    this.cancelled.emit();
  }
}
