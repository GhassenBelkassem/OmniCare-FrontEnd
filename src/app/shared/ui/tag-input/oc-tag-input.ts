import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  forwardRef,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { NzIconModule } from 'ng-zorro-antd/icon';

const MAX_TAGS_DEFAULT = 50;
const MAX_TAG_LENGTH_DEFAULT = 100;

export type OcTagInputTone = 'default' | 'emerald' | 'teal' | 'aqua' | 'neutral';

/**
 * Reusable chip/tag input for ordered string lists (languages, specialities...).
 * A CVA bound to `string[]`; Enter or comma commits the typed value, Backspace on
 * an empty field removes the last chip. Duplicates are ignored case-insensitively.
 */
@Component({
  selector: 'oc-tag-input',
  imports: [NzIconModule],
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => OcTagInput), multi: true },
  ],
  template: `
    <div
      class="oc-tag-input"
      [class.oc-tag-input--invalid]="invalid()"
      [class.oc-tag-input--disabled]="isDisabled()"
      [class.oc-tag-input--emerald]="tone() === 'emerald'"
      [class.oc-tag-input--teal]="tone() === 'teal'"
      [class.oc-tag-input--aqua]="tone() === 'aqua'"
      [class.oc-tag-input--neutral]="tone() === 'neutral'"
    >
      <div class="oc-tag-input__chips">
        <span class="oc-tag-input__tag-list" [attr.role]="value().length > 0 ? 'list' : null">
          @for (tag of value(); track tag) {
            <span class="oc-tag-input__chip" role="listitem">
              {{ tag }}
              <button
                type="button"
                class="oc-tag-input__remove"
                [attr.aria-label]="'Retirer ' + tag"
                [disabled]="isDisabled()"
                (click)="removeTag(tag)"
              >
                <nz-icon nzType="close" aria-hidden="true" />
              </button>
            </span>
          }
        </span>
        <input
          #nativeInput
          class="oc-tag-input__text"
          type="text"
          [id]="controlId()"
          [disabled]="isDisabled()"
          [readonly]="atCapacity()"
          [attr.placeholder]="placeholder()"
          [attr.aria-labelledby]="ariaLabelledBy()"
          [attr.aria-describedby]="ariaDescribedBy()"
          [attr.aria-invalid]="invalid() ? 'true' : null"
          [value]="text()"
          (input)="onTextInput($event)"
          (keydown)="onKeyDown($event)"
          (paste)="onPaste($event)"
          (blur)="onTouched()"
        />
        <span class="oc-tag-input__sr-only" aria-live="polite">{{ inputStatus() }}</span>
      </div>
      @if (atCapacity()) {
        <p class="oc-tag-input__hint" aria-live="polite">Maximum {{ maxTags() }} elements</p>
      }
    </div>
  `,
  styleUrl: './oc-tag-input.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OcTagInput implements ControlValueAccessor {
  readonly controlId = input.required<string>();
  readonly placeholder = input('Ajouter');
  readonly tone = input<OcTagInputTone>('default');
  readonly invalid = input(false);
  readonly disabled = input(false);
  readonly maxTags = input(MAX_TAGS_DEFAULT);
  readonly maxTagLength = input(MAX_TAG_LENGTH_DEFAULT);
  readonly ariaLabelledBy = input<string>();
  readonly ariaDescribedBy = input<string>();
  readonly value = signal<readonly string[]>([]);
  readonly text = signal('');
  readonly inputStatus = signal('');
  private readonly controlDisabled = signal(false);
  private readonly nativeInput = viewChild<ElementRef<HTMLInputElement>>('nativeInput');
  private onChange: (value: readonly string[]) => void = () => undefined;
  private onTouchedCallback: () => void = () => undefined;

  protected atCapacity(): boolean {
    return this.value().length >= this.maxTags();
  }

  protected isDisabled(): boolean {
    return this.disabled() || this.controlDisabled();
  }

  protected onTextInput(event: Event): void {
    this.text.set((event.target as HTMLInputElement).value);
    this.inputStatus.set('');
  }

  protected onKeyDown(event: KeyboardEvent): void {
    const input = event.target as HTMLInputElement;
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      this.commitCurrent();
    } else if (event.key === 'Backspace' && input.value === '' && this.value().length > 0) {
      event.preventDefault();
      this.removeLast();
    }
  }

  protected onPaste(event: ClipboardEvent): void {
    const raw = event.clipboardData?.getData('text') ?? '';
    event.preventDefault();
    const entries = raw
      .split(/[,\n;]/)
      .map((entry) => entry.trim())
      .filter((entry) => entry !== '');
    if (entries.length === 0) return;
    this.append(entries);
    this.clearTextInput();
  }

  protected commitCurrent(): void {
    const entry = this.text().trim();
    if (entry === '') return;
    this.append([entry]);
    this.clearTextInput();
  }

  protected removeTag(tag: string): void {
    this.value.update((tags) => tags.filter((existing) => existing !== tag));
    this.inputStatus.set('');
    this.emit();
  }

  protected removeLast(): void {
    this.value.update((tags) => tags.slice(0, -1));
    this.emit();
  }

  private append(entries: readonly string[]): void {
    const capacity = this.maxTags();
    let added = 0;
    this.value.update((tags) => {
      const merged = [...tags];
      for (const entry of entries) {
        if (merged.length >= capacity) break;
        const limited = entry.slice(0, this.maxTagLength());
        if (merged.some((existing) => existing.toLowerCase() === limited.toLowerCase())) continue;
        merged.push(limited);
        added += 1;
      }
      return merged;
    });
    if (added > 0) {
      this.inputStatus.set(
        `${added} element${added > 1 ? 's' : ''} ajoute${added > 1 ? 's' : ''}.`,
      );
      this.emit();
    }
  }

  private emit(): void {
    this.onChange(this.value());
    this.onTouchedCallback();
  }

  protected onTouched(): void {
    this.onTouchedCallback();
  }

  writeValue(value: readonly string[] | null | undefined): void {
    this.value.set(value ?? []);
    this.inputStatus.set('');
    this.clearTextInput();
  }

  registerOnChange(onChange: (value: readonly string[]) => void): void {
    this.onChange = onChange;
  }
  registerOnTouched(onTouched: () => void): void {
    this.onTouchedCallback = onTouched;
  }
  setDisabledState(disabled: boolean): void {
    this.controlDisabled.set(disabled);
  }
  focus(): void {
    const native = this.nativeInput();
    if (native !== undefined) native.nativeElement.focus();
  }

  private clearTextInput(): void {
    this.text.set('');
    const native = this.nativeInput();
    if (native !== undefined) native.nativeElement.value = '';
  }
}
