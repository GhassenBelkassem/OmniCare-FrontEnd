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
import { BrnSwitchImports } from '@spartan-ng/brain/switch';

/** Vendor-neutral CVA backed by Spartan Brain's accessible switch primitive. */
@Component({
  selector: 'oc-switch',
  imports: [BrnSwitchImports],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => OcSwitch), multi: true }],
  template: `
    <brn-switch
      class="oc-switch__track"
      [id]="controlId()"
      [checked]="checked()"
      [disabled]="isDisabled()"
      [aria-labelledby]="labelledBy()"
      [aria-describedby]="describedBy()"
      (checkedChange)="change($event)"
      (touched)="touch()"
    >
      <brn-switch-thumb class="oc-switch__thumb" />
    </brn-switch>
  `,
  styleUrl: './oc-switch.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OcSwitch implements ControlValueAccessor {
  readonly controlId = input.required<string>();
  readonly labelledBy = input.required<string>();
  readonly describedBy = input<string | null>(null);
  readonly disabled = input(false);
  readonly checkedInput = input(false, { alias: 'checked' });
  readonly checkedChange = output<boolean>();
  protected readonly checked = linkedSignal(this.checkedInput);
  private readonly controlDisabled = signal(false);
  private onChange: (value: boolean) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  protected isDisabled(): boolean {
    return this.disabled() || this.controlDisabled();
  }

  protected change(value: boolean): void {
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
