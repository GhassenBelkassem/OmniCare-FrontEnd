import {
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  input,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { BrnRadio, BrnRadioGroup } from '@spartan-ng/brain/radio-group';

export interface OcRadioOption {
  readonly value: string;
  readonly label: string;
}

/** Compact vendor-neutral radio group backed by Spartan Brain 1.2.0. */
@Component({
  selector: 'oc-radio-group',
  imports: [BrnRadioGroup, BrnRadio],
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => OcRadioGroup), multi: true },
  ],
  template: `
    <div
      class="oc-radio-group"
      brnRadioGroup
      [name]="name()"
      [value]="value() ?? undefined"
      [disabled]="isDisabled()"
      [attr.aria-labelledby]="labelledBy()"
      [attr.aria-describedby]="describedBy()"
      (valueChange)="select($event)"
    >
      @for (option of options(); track option.value; let index = $index) {
        <label class="oc-radio-group__option">
          <brn-radio [id]="name() + '-' + index" [value]="option.value">
            <span target class="oc-radio-group__indicator" aria-hidden="true">
              <span></span>
            </span>
            <span class="oc-radio-group__label">{{ option.label }}</span>
          </brn-radio>
        </label>
      }
    </div>
  `,
  styleUrl: './oc-radio-group.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OcRadioGroup implements ControlValueAccessor {
  readonly name = input.required<string>();
  readonly labelledBy = input.required<string>();
  readonly describedBy = input<string | null>(null);
  readonly options = input.required<readonly OcRadioOption[]>();
  readonly disabled = input(false);

  protected readonly value = signal<string | null>(null);
  private readonly controlDisabled = signal(false);
  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  protected isDisabled(): boolean {
    return this.disabled() || this.controlDisabled();
  }

  protected select(value: unknown): void {
    if (typeof value !== 'string' || this.isDisabled()) return;
    this.value.set(value);
    this.onChange(value);
    this.onTouched();
  }

  writeValue(value: string | null): void {
    this.value.set(value);
  }

  registerOnChange(onChange: (value: string) => void): void {
    this.onChange = onChange;
  }

  registerOnTouched(onTouched: () => void): void {
    this.onTouched = onTouched;
  }

  setDisabledState(disabled: boolean): void {
    this.controlDisabled.set(disabled);
  }
}
