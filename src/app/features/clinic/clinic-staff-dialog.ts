import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, input, output, viewChild } from '@angular/core';

import { OcButton } from '../../shared/ui';

/**
 * Small, focus-trapped modal used by the clinic staff surface.
 *
 * <p>It relies on the native `<dialog>` element so keyboard interaction, focus containment
 * and Escape handling come from the platform rather than from bespoke key handling.
 */
@Component({
  selector: 'app-clinic-staff-dialog',
  imports: [OcButton],
  template: `
    <dialog #dialog class="staff-dialog" [attr.aria-label]="heading()" (close)="dismissed.emit()">
      <form method="dialog" class="staff-dialog__form" (submit)="onSubmit($event)">
        <header class="staff-dialog__header">
          <h2>{{ heading() }}</h2>
          @if (description(); as text) {
            <p>{{ text }}</p>
          }
        </header>

        <div class="staff-dialog__body"><ng-content /></div>

        <footer class="staff-dialog__footer">
          <oc-button variant="quiet" [disabled]="pending()" (click)="cancel()">Cancel</oc-button>
          <oc-button
            [variant]="destructive() ? 'destructive' : 'primary'"
            type="submit"
            [loading]="pending()"
            [disabled]="submitDisabled()"
            >{{ confirmLabel() }}</oc-button
          >
        </footer>
      </form>
    </dialog>
  `,
  styles: [
    `
      .staff-dialog {
        width: min(32rem, calc(100vw - 2rem));
        padding: 0;
        border: 1px solid var(--oc-color-border-default);
        border-radius: var(--oc-radius-lg);
        background: var(--oc-color-surface-card);
        color: var(--oc-color-text-primary);
      }
      .staff-dialog::backdrop {
        background: rgb(15 23 42 / 45%);
      }
      .staff-dialog__form {
        display: grid;
        gap: var(--oc-space-5);
        padding: var(--oc-space-6);
      }
      .staff-dialog__header h2 {
        margin: 0;
        font-size: 18px;
      }
      .staff-dialog__header p {
        margin: var(--oc-space-2) 0 0;
        color: var(--oc-color-text-secondary);
        font-size: 13px;
      }
      .staff-dialog__body {
        display: grid;
        gap: var(--oc-space-4);
      }
      .staff-dialog__footer {
        display: flex;
        justify-content: flex-end;
        gap: var(--oc-space-3);
      }
      .staff-dialog :focus-visible {
        outline: 3px solid var(--oc-color-border-focus);
        outline-offset: 2px;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClinicStaffDialog {
  readonly open = input.required<boolean>();
  readonly heading = input.required<string>();
  readonly description = input<string>();
  readonly confirmLabel = input('Confirm');
  readonly destructive = input(false);
  readonly pending = input(false);
  readonly submitDisabled = input(false);

  readonly confirmed = output<void>();
  readonly dismissed = output<void>();

  private readonly dialogRef = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly host = inject(ElementRef<HTMLElement>);

  constructor() {
    effect(() => {
      const dialog = this.dialogRef().nativeElement;
      const shouldOpen = this.open();
      if (shouldOpen && !dialog.open) {
        // showModal gives the platform focus trap; jsdom-only builds fall back to `open`.
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else dialog.setAttribute('open', '');
        this.focusFirstField();
      } else if (!shouldOpen && dialog.open) {
        if (typeof dialog.close === 'function') dialog.close();
        else dialog.removeAttribute('open');
      }
    });
  }

  cancel(): void {
    this.dismissed.emit();
  }

  onSubmit(event: Event): void {
    event.preventDefault();
    if (this.pending() || this.submitDisabled()) return;
    this.confirmed.emit();
  }

  private focusFirstField(): void {
    const element = (this.host.nativeElement as HTMLElement).querySelector<HTMLElement>(
      '.staff-dialog__body input, .staff-dialog__body select, .staff-dialog__body textarea',
    );
    element?.focus();
  }
}
