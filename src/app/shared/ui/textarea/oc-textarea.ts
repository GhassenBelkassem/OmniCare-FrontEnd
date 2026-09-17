import { ChangeDetectionStrategy, Component, ElementRef, forwardRef, input, signal, viewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'oc-textarea',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => OcTextarea), multi: true }],
  template: `
    <textarea
      #nativeTextarea
      class="oc-textarea"
      [id]="controlId()"
      [rows]="rows()"
      [disabled]="isDisabled()"
      [attr.maxlength]="maxLength() ?? null"
      [attr.placeholder]="placeholder()"
      [attr.aria-labelledby]="ariaLabelledBy()"
      [attr.aria-describedby]="ariaDescribedBy()"
      [attr.aria-invalid]="invalid() ? 'true' : null"
      [value]="value()"
      (input)="onInput($event)"
      (blur)="onTouched()"
    ></textarea>
    @if (showCount() && maxLength(); as maximum) { <p class="oc-textarea__count" aria-live="polite">{{ value().length }} / {{ maximum }}</p> }
  `,
  styleUrl: './oc-textarea.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OcTextarea implements ControlValueAccessor {
  readonly controlId = input.required<string>();
  readonly placeholder = input('');
  readonly rows = input(3);
  readonly maxLength = input<number>();
  readonly invalid = input(false);
  readonly disabled = input(false);
  readonly showCount = input(false);
  readonly ariaLabelledBy = input<string>();
  readonly ariaDescribedBy = input<string>();
  readonly value = signal('');
  private readonly controlDisabled = signal(false);
  private readonly nativeTextarea = viewChild.required<ElementRef<HTMLTextAreaElement>>('nativeTextarea');
  private onChange: (value: string) => void = () => undefined;
  private onTouchedCallback: () => void = () => undefined;

  protected isDisabled(): boolean { return this.disabled() || this.controlDisabled(); }
  protected onInput(event: Event): void {
    const nextValue = (event.target as HTMLTextAreaElement).value;
    this.value.set(nextValue);
    this.onChange(nextValue);
  }
  protected onTouched(): void { this.onTouchedCallback(); }
  writeValue(value: string | null): void { this.value.set(value ?? ''); }
  registerOnChange(onChange: (value: string) => void): void { this.onChange = onChange; }
  registerOnTouched(onTouched: () => void): void { this.onTouchedCallback = onTouched; }
  setDisabledState(disabled: boolean): void { this.controlDisabled.set(disabled); }
  focus(): void { this.nativeTextarea().nativeElement.focus(); }
}
