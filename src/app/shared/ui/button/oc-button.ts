import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  viewChild,
} from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';

export type OcButtonVariant = 'primary' | 'secondary' | 'quiet' | 'destructive';
export type OcButtonSize = 'small' | 'default';

@Component({
  selector: 'oc-button',
  imports: [NzButtonModule, NzIconModule],
  template: `
    <button
      #nativeButton
      nz-button
      [nzType]="nzType()"
      [nzDanger]="variant() === 'destructive'"
      [nzSize]="size()"
      [nzLoading]="loading()"
      [disabled]="disabled() || loading()"
      [attr.type]="type()"
      [attr.aria-busy]="loading()"
      [class.oc-button--quiet]="variant() === 'quiet'"
    >
      @if (leadingIcon(); as icon) {
        <nz-icon [nzType]="icon" aria-hidden="true" />
      }
      <span><ng-content /></span>
      @if (trailingIcon(); as icon) {
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
  readonly leadingIcon = input<string>();
  readonly trailingIcon = input<string>();
  readonly nzType = computed(() =>
    this.variant() === 'primary' ? 'primary' : this.variant() === 'quiet' ? 'text' : 'default',
  );
  private readonly nativeButton = viewChild.required<ElementRef<HTMLButtonElement>>('nativeButton');

  focus(): void {
    this.nativeButton().nativeElement.focus();
  }
}
