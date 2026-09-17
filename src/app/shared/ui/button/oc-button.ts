import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  viewChild,
} from '@angular/core';
import { BrnButton } from '@spartan-ng/brain/button';
import { NzIconModule } from 'ng-zorro-antd/icon';

/**
 * Vendor-neutral action surface backed by the pinned Spartan Brain button
 * primitive. `quiet` remains as the established OmniCare alias for `ghost`.
 */
export type OcButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'quiet'
  | 'destructive'
  | 'link';
export type OcButtonSize = 'small' | 'default' | 'large';

@Component({
  selector: 'oc-button',
  imports: [BrnButton, NzIconModule],
  template: `
    <button
      #nativeButton
      brnButton
      [disabled]="isDisabled()"
      [type]="type()"
      [attr.form]="form()"
      [attr.aria-busy]="loading()"
      [attr.aria-label]="iconOnly() ? ariaLabel() : null"
      [class]="buttonClasses()"
    >
      @if (loading()) {
        <span class="oc-button__spinner" aria-hidden="true"></span>
      } @else if (leadingIcon(); as icon) {
        <nz-icon [nzType]="icon" aria-hidden="true" />
      }
      @if (!iconOnly()) {
        <span class="oc-button__label"><ng-content /></span>
      }
      @if (!loading() && trailingIcon(); as icon) {
        <nz-icon [nzType]="icon" aria-hidden="true" />
      }
    </button>
  `,
  styleUrl: './oc-button.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OcButton {
  readonly variant = input<OcButtonVariant>('secondary');
  readonly size = input<OcButtonSize>('default');
  readonly disabled = input(false);
  readonly loading = input(false);
  readonly type = input<'button' | 'submit' | 'reset'>('button');
  readonly form = input<string>();
  readonly leadingIcon = input<string>();
  readonly trailingIcon = input<string>();
  readonly fullWidth = input(false);
  readonly iconOnly = input(false);
  readonly ariaLabel = input<string>();
  private readonly nativeButton = viewChild.required<ElementRef<HTMLButtonElement>>('nativeButton');

  protected isDisabled(): boolean {
    return this.disabled() || this.loading();
  }

  protected buttonClasses(): string {
    return [
      'oc-button',
      `oc-button--${this.variant() === 'quiet' ? 'ghost' : this.variant()}`,
      `oc-button--${this.size()}`,
      this.fullWidth() ? 'oc-button--full-width' : '',
      this.iconOnly() ? 'oc-button--icon-only' : '',
    ].filter(Boolean).join(' ');
  }

  focus(): void {
    this.nativeButton().nativeElement.focus();
  }
}
