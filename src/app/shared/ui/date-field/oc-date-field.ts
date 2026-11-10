import {
  ChangeDetectionStrategy,
  Component,
  effect,
  forwardRef,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ControlValueAccessor,
  FormControl,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
  TouchedChangeEvent,
} from '@angular/forms';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';

/** Display format for every OmniCare date field (« jj/mm/aaaa »). */
export const OC_DATE_DISPLAY_FORMAT = 'dd/MM/yyyy';

const DATE_VALUE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** `yyyy-MM-dd` wall-clock date → local UI Date (never serialized). */
export function dateValueToUiDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !DATE_VALUE_PATTERN.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function uiDateToDateValue(value: Date | null): string | null {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return null;
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${value.getFullYear()}-${month}-${day}`;
}

/**
 * NG-ZORRO date picker bound to a `yyyy-MM-dd` string value, displayed as
 * « jj/mm/aaaa » with French month and day names (from the global fr_FR locale).
 * Use it instead of a native `<input type="date">`.
 */
@Component({
  selector: 'oc-date-field',
  imports: [ReactiveFormsModule, NzDatePickerModule],
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => OcDateField), multi: true },
  ],
  template: `
    <nz-date-picker
      class="oc-date-field"
      [formControl]="uiControl"
      [nzId]="controlId()"
      [nzFormat]="format"
      [nzPlaceHolder]="placeholder()"
      [nzAllowClear]="allowClear()"
      [nzDisabledDate]="disabledDate"
      [nzStatus]="invalid() ? 'error' : ''"
      [nzInputReadOnly]="false"
      [attr.aria-label]="ariaLabel()"
    />
  `,
  styles: `
    :host { display: block; }
    .oc-date-field { width: 100%; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OcDateField implements ControlValueAccessor {
  readonly controlId = input<string>('');
  readonly placeholder = input('jj/mm/aaaa');
  readonly allowClear = input(true);
  readonly invalid = input(false);
  readonly ariaLabel = input<string | null>(null);
  /** Inclusive bounds, `yyyy-MM-dd`. */
  readonly min = input<string | null>(null);
  readonly max = input<string | null>(null);
  readonly valueChange = output<string | null>();

  readonly format = OC_DATE_DISPLAY_FORMAT;
  readonly uiControl = new FormControl<Date | null>(null);
  private readonly controlDisabled = signal(false);
  private onChange: (value: string | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  readonly disabledDate = (current: Date): boolean => {
    const value = uiDateToDateValue(current);
    if (value === null) return false;
    const min = this.min();
    const max = this.max();
    return (min !== null && value < min) || (max !== null && value > max);
  };

  constructor() {
    this.uiControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      const next = uiDateToDateValue(value);
      this.onChange(next);
      this.valueChange.emit(next);
    });
    this.uiControl.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event instanceof TouchedChangeEvent && event.touched) this.onTouched();
    });
    effect(() => {
      if (this.controlDisabled()) this.uiControl.disable({ emitEvent: false });
      else this.uiControl.enable({ emitEvent: false });
    });
  }

  /** Non-forms usage: `<oc-date-field [value]="…" (valueChange)="…">`. */
  readonly value = input<string | null | undefined>(undefined);
  private readonly syncValueInput = effect(() => {
    const value = this.value();
    if (value !== undefined) this.writeValue(value);
  });

  writeValue(value: string | null): void {
    this.uiControl.setValue(dateValueToUiDate(value), { emitEvent: false });
  }

  registerOnChange(onChange: (value: string | null) => void): void {
    this.onChange = onChange;
  }

  registerOnTouched(onTouched: () => void): void {
    this.onTouched = onTouched;
  }

  setDisabledState(disabled: boolean): void {
    this.controlDisabled.set(disabled);
  }
}
