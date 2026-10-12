import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { BrnDialogImports } from '@spartan-ng/brain/dialog';

export type OcDialogIntent = 'standard' | 'destructive';

/**
 * Vendor-neutral, controlled modal surface. The private implementation uses
 * Spartan Brain 1.2's CDK-dialog wrapper; feature code depends only on OcDialog.
 */
@Component({
  selector: 'oc-dialog',
  imports: [BrnDialogImports],
  template: `
    <div
      brnDialog
      #dialog="brnDialog"
      [state]="open() ? 'open' : 'closed'"
      role="dialog"
      [autoFocus]="initialFocus()"
      [restoreFocus]="true"
      [disableClose]="dismissalDisabled()"
      [closeOnOutsidePointerEvents]="backdropDismissible() && !dismissalDisabled()"
      [aria-describedby]="description() ? undefined : null"
      (closed)="onClosed()"
    >
      <span brnDialogOverlay class="oc-dialog-backdrop" aria-hidden="true"></span>
      <ng-template brnDialogContent class="oc-dialog-panel">
        <section
          class="oc-dialog"
          [class.oc-dialog--wide]="size() === 'wide'"
          [class.oc-dialog--destructive]="intent() === 'destructive'"
          [attr.aria-busy]="submitting()"
        >
          <header class="oc-dialog__header">
            <div>
              <h2 brnDialogTitle>{{ title() }}</h2>
              @if (intent() === 'destructive') {
                <p class="oc-dialog__destructive-note">
                  <span aria-hidden="true">!</span> Destructive action
                </p>
              }
            </div>
            @if (!dismissalDisabled()) {
              <button
                type="button"
                class="oc-dialog__close"
                [attr.aria-label]="'Close ' + title()"
                (click)="requestDismiss()"
              >
                ×
              </button>
            }
          </header>
          @if (description(); as text) {
            <p brnDialogDescription class="oc-dialog__description">{{ text }}</p>
          }
          <div class="oc-dialog__body">
            @if (error(); as message) {
              <p class="oc-dialog__error" role="alert" aria-live="assertive">{{ message }}</p>
            }
            <ng-content />
          </div>
          @if (hasFooter()) {
            <footer class="oc-dialog__footer">
              <ng-content select="[ocDialogFooter]" />
            </footer>
          }
        </section>
      </ng-template>
    </div>
  `,
  styleUrl: './oc-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OcDialog {
  readonly open = input(false);
  readonly title = input.required<string>();
  readonly description = input<string>();
  readonly error = input<string | null>(null);
  readonly intent = input<OcDialogIntent>('standard');
  readonly size = input<'standard' | 'wide'>('standard');
  readonly initialFocus = input<string | 'first-tabbable'>('first-tabbable');
  readonly backdropDismissible = input(false);
  readonly submitting = input(false);
  readonly disabled = input(false);
  /** Set only when direct projected actions are supplied with `ocDialogFooter`. */
  readonly hasFooter = input(false);
  readonly dismissed = output<void>();

  protected dismissalDisabled(): boolean {
    return this.submitting() || this.disabled();
  }

  protected requestDismiss(): void {
    if (!this.dismissalDisabled()) this.dismissed.emit();
  }

  protected onClosed(): void {
    // Escape/backdrop are closed by Brain; explicit closes are controlled by the parent.
    if (this.open() && !this.dismissalDisabled()) this.dismissed.emit();
  }
}
