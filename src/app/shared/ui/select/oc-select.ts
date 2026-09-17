import { ChangeDetectionStrategy, Component, ElementRef, forwardRef, input, signal, viewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { BrnPopover, BrnPopoverImports } from '@spartan-ng/brain/popover';
import { BrnSelectImports } from '@spartan-ng/brain/select';

export interface OcSelectOption<T extends string = string> {
  readonly value: T;
  readonly label: string;
  readonly disabled?: boolean;
}

/**
 * Focused single-value select composed from pinned Spartan Brain select and
 * popover primitives. The public contract remains OmniCare-owned and CVA-safe.
 */
@Component({
  selector: 'oc-select',
  imports: [BrnPopoverImports, BrnSelectImports],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => OcSelect), multi: true }],
  template: `
    <brn-popover #popover="brnPopover" sideOffset="6" align="start">
      <div class="oc-select" [class.oc-select--full-width]="fullWidth()" brnSelect [value]="value()" [disabled]="isDisabled()" [itemToString]="itemToString" (valueChange)="selectValue($event)">
        <button
          #trigger
          brnSelectTrigger
          [id]="controlId()"
          [forceInvalid]="invalid()"
          [attr.aria-labelledby]="ariaLabelledBy()"
          [attr.aria-describedby]="ariaDescribedBy()"
          [attr.aria-label]="ariaLabel()"
          class="oc-select__trigger"
          (keydown.escape)="closeOnEscape($event)"
        >
          <span brnSelectValue [placeholder]="placeholder()"></span>
          <span class="oc-select__chevron" aria-hidden="true">⌄</span>
        </button>
        <ng-template brnPopoverContent>
          <div brnSelectContent class="oc-select__content">
            <div brnSelectList class="oc-select__list">
              @for (option of options(); track option.value) {
                <button brnSelectItem class="oc-select__option" [value]="option.value" [disabled]="option.disabled ?? false">
                  {{ option.label }}
                </button>
              }
            </div>
          </div>
        </ng-template>
      </div>
    </brn-popover>
  `,
  styleUrl: './oc-select.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OcSelect implements ControlValueAccessor {
  readonly controlId = input.required<string>();
  readonly options = input<readonly OcSelectOption[]>([]);
  readonly placeholder = input('Select an option');
  readonly disabled = input(false);
  readonly invalid = input(false);
  readonly fullWidth = input(true);
  readonly ariaLabel = input<string>();
  readonly ariaLabelledBy = input<string>();
  readonly ariaDescribedBy = input<string>();
  readonly value = signal<string | null>(null);
  private readonly controlDisabled = signal(false);
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly popover = viewChild.required<BrnPopover>('popover');
  private onChange: (value: string | null) => void = () => undefined;
  private onTouchedCallback: () => void = () => undefined;

  readonly itemToString = (value: string): string =>
    (this.options() ?? []).find((option) => option.value === value)?.label ?? value;

  protected isDisabled(): boolean { return this.disabled() || this.controlDisabled(); }
  protected selectValue(value: string | null | undefined): void {
    const nextValue = value ?? null;
    this.value.set(nextValue);
    this.onChange(nextValue);
    this.onTouchedCallback();
  }
  protected closeOnEscape(event: Event): void {
    event.preventDefault();
    this.popover().close();
  }
  writeValue(value: string | null): void { this.value.set(value); }
  registerOnChange(onChange: (value: string | null) => void): void { this.onChange = onChange; }
  registerOnTouched(onTouched: () => void): void { this.onTouchedCallback = onTouched; }
  setDisabledState(disabled: boolean): void { this.controlDisabled.set(disabled); }
  focus(): void { this.trigger().nativeElement.focus(); }
}
