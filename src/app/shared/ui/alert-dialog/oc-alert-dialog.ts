import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { BrnAlertDialogImports } from '@spartan-ng/brain/alert-dialog';

import { OcButton } from '../button/oc-button';

/** Controlled destructive confirmation backed by Spartan Brain Alert Dialog. */
@Component({
  selector: 'oc-alert-dialog',
  imports: [BrnAlertDialogImports, OcButton],
  template: `
    <div
      brnAlertDialog
      [state]="open() ? 'open' : 'closed'"
      [disableClose]="loading()"
      [closeOnOutsidePointerEvents]="false"
      [restoreFocus]="true"
      (closed)="onClosed()"
    >
      <span brnAlertDialogOverlay class="oc-alert-dialog__backdrop" aria-hidden="true"></span>
      <ng-template brnAlertDialogContent class="oc-alert-dialog__panel">
        <section class="oc-alert-dialog" [attr.aria-busy]="loading()">
          <div class="oc-alert-dialog__icon" aria-hidden="true">!</div>
          <div>
            <h2 brnAlertDialogTitle>{{ title() }}</h2>
            <p brnAlertDialogDescription>{{ message() }}</p>
          </div>
          <footer>
            <oc-button variant="secondary" [disabled]="loading()" (click)="cancelled.emit()">
              {{ cancelLabel() }}
            </oc-button>
            <oc-button variant="destructive" [loading]="loading()" (click)="confirm.emit()">
              {{ confirmLabel() }}
            </oc-button>
          </footer>
        </section>
      </ng-template>
    </div>
  `,
  styleUrl: './oc-alert-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OcAlertDialog {
  readonly open = input(false);
  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly confirmLabel = input('Confirmer');
  readonly cancelLabel = input('Annuler');
  readonly loading = input(false);
  readonly confirm = output<void>();
  readonly cancelled = output<void>();

  protected onClosed(): void {
    if (this.open() && !this.loading()) this.cancelled.emit();
  }
}
