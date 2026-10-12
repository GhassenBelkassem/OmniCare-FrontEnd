import {
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  input,
  linkedSignal,
  output,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { BrnCheckbox } from '@spartan-ng/brain/checkbox';

/** Vendor-neutral checkbox boundary backed by Spartan Brain 1.2.0. */
@Component({
  selector: 'oc-checkbox',
  imports: [BrnCheckbox],
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => OcCheckbox), multi: true },
  ],
  template: `
    <brn-checkbox
      class="oc-checkbox__control"
      [id]="controlId()"
      [checked]="checked()"
      [disabled]="isDisabled()"
      [aria-labelledby]="labelledBy()"
      [aria-describedby]="describedBy()"
      (checkedChange)="change($event)"
      (touched)="touch()"
    >
      @if (checked()) {
        <svg aria-hidden="true" viewBox="0 0 16 16" fill="none">
          <path d="m3.25 8.25 3 3 6.5-6.5" />
        </svg>
      }
    </brn-checkbox>
  `,
  styleUrl: './oc-checkbox.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OcCheckbox implements ControlValueAccessor {
  readonly controlId = input.required<string>();
  readonly labelledBy = input.required<string>();
  readonly describedBy = input<string | null>(null);
  readonly checkedInput = input(false, { alias: 'checked' });
  readonly disabled = input(false);
  readonly checkedChange = output<boolean>();

  protected readonly checked = linkedSignal(this.checkedInput);
  private readonly controlDisabled = signal(false);
  private onChange: (value: boolean) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  protected isDisabled(): boolean {
    return this.disabled() || this.controlDisabled();
  }

  protected change(value: boolean): void {
    if (this.isDisabled()) return;
    this.checked.set(value);
    this.checkedChange.emit(value);
    this.onChange(value);
  }

  protected touch(): void {
    this.onTouched();
  }

  writeValue(value: boolean): void {
    this.checked.set(Boolean(value));
  }

  registerOnChange(onChange: (value: boolean) => void): void {
    this.onChange = onChange;
  }

  registerOnTouched(onTouched: () => void): void {
    this.onTouched = onTouched;
  }

  setDisabledState(disabled: boolean): void {
    this.controlDisabled.set(disabled);
  }
}
