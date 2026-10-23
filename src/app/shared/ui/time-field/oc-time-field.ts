import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnChanges,
  Renderer2,
  SimpleChanges,
  effect,
  forwardRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  ControlValueAccessor,
  FormControl,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
  TouchedChangeEvent,
  ValidationErrors,
  Validator,
} from '@angular/forms';
import { NzTimePickerComponent, NzTimePickerModule } from 'ng-zorro-antd/time-picker';

export const OC_TIME_FORMAT = 'HH:mm';
export const OC_TIME_MINUTE_STEP = 5;

const TIME_VALUE_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function isValidTimeValue(value: unknown): value is string {
  return typeof value === 'string' && TIME_VALUE_PATTERN.test(value);
}

export function timeValueToUiDate(value: unknown): Date | null {
  if (!isValidTimeValue(value)) return null;
  const [hours, minutes] = value.split(':').map(Number);
  // This local Date is a UI-only transport container. Its date is never exposed or serialized.
  return new Date(2000, 0, 1, hours, minutes, 0, 0);
}

export function uiDateToTimeValue(value: Date | null): string | null {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) return null;
  const hours = String(value.getHours()).padStart(2, '0');
  const minutes = String(value.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

@Component({
  selector: 'oc-time-field',
  imports: [ReactiveFormsModule, NzTimePickerModule],
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => OcTimeField), multi: true },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => OcTimeField), multi: true },
  ],
  template: `
    <nz-time-picker
      class="oc-time-field__picker"
      [class.oc-time-field__picker--invalid]="invalid()"
      [formControl]="uiControl"
      [nzId]="controlId()"
      [nzFormat]="format"
      [nzUse12Hours]="false"
      [nzMinuteStep]="minuteStep"
      [nzAllowEmpty]="allowClear()"
      [nzDisabled]="isDisabled()"
      [nzStatus]="invalid() ? 'error' : ''"
      [nzPlaceHolder]="placeholder()"
      nzClearText="Effacer l’heure"
    />
  `,
  styleUrl: './oc-time-field.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OcTimeField implements ControlValueAccessor, Validator, AfterViewInit, OnChanges {
  readonly controlId = input.required<string>();
  readonly placeholder = input(OC_TIME_FORMAT);
  readonly allowClear = input(true);
  readonly disabled = input(false);
  readonly invalid = input(false);
  readonly ariaLabel = input<string | null>();
  readonly ariaLabelledBy = input<string | null>();
  readonly ariaDescribedBy = input<string | null>();

  readonly format = OC_TIME_FORMAT;
  readonly minuteStep = OC_TIME_MINUTE_STEP;
  readonly uiControl = new FormControl<Date | null>(null);

  private readonly picker = viewChild.required(NzTimePickerComponent);
  private readonly renderer = inject(Renderer2);
  private readonly controlDisabled = signal(false);
  private inputElement: HTMLInputElement | null = null;
  private onChange: (value: string | null) => void = () => undefined;
  private onTouchedCallback: () => void = () => undefined;

  constructor() {
    this.uiControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      this.onChange(uiDateToTimeValue(value));
    });
    this.uiControl.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event instanceof TouchedChangeEvent && event.touched) this.onTouchedCallback();
    });
    effect(() => {
      const disabled = this.isDisabled();
      if (disabled && this.uiControl.enabled) {
        this.uiControl.disable({ emitEvent: false });
      } else if (!disabled && this.uiControl.disabled) {
        this.uiControl.enable({ emitEvent: false });
      }
    });
  }

  ngAfterViewInit(): void {
    this.inputElement = this.picker().inputRef.nativeElement;
    this.syncAccessibilityAttributes();
  }

  ngOnChanges(_changes: SimpleChanges): void {
    this.syncAccessibilityAttributes();
  }

  isDisabled(): boolean {
    return this.disabled() || this.controlDisabled();
  }

  writeValue(value: string | null): void {
    this.uiControl.setValue(timeValueToUiDate(value), { emitEvent: false });
  }

  registerOnChange(onChange: (value: string | null) => void): void {
    this.onChange = onChange;
  }

  registerOnTouched(onTouched: () => void): void {
    this.onTouchedCallback = onTouched;
  }

  setDisabledState(disabled: boolean): void {
    this.controlDisabled.set(disabled);
  }

  validate(control: AbstractControl<unknown, unknown>): ValidationErrors | null {
    return control.value === null || isValidTimeValue(control.value) ? null : { timeFormat: true };
  }

  focus(): void {
    this.picker().focus();
  }

  private syncAccessibilityAttributes(): void {
    if (this.inputElement === null) return;
    this.setOptionalAttribute('aria-label', this.ariaLabel());
    this.setOptionalAttribute('aria-labelledby', this.ariaLabelledBy());
    this.setOptionalAttribute('aria-describedby', this.ariaDescribedBy());
    this.setOptionalAttribute('aria-invalid', this.invalid() ? 'true' : null);
  }

  private setOptionalAttribute(name: string, value: string | null | undefined): void {
    if (this.inputElement === null) return;
    if (value) this.renderer.setAttribute(this.inputElement, name, value);
    else this.renderer.removeAttribute(this.inputElement, name);
  }
}
