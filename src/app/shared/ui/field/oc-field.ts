import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Semantic field framing only; business validation remains with the owning form. */
@Component({
  selector: 'oc-field',
  template: `
    <div class="oc-field" [class.oc-field--compact]="density() === 'compact'" [class.oc-field--disabled]="disabled()">
      <label class="oc-field__label" [id]="labelId()" [for]="controlId()">
        {{ label() }}
        @if (required()) { <span class="oc-field__required" aria-hidden="true">*</span><span class="oc-sr-only"> required</span> }
      </label>
      <ng-content />
      @if (hint(); as text) { <p class="oc-field__hint" [id]="hintId()">{{ text }}</p> }
      @if (error(); as text) { <p class="oc-field__error" [id]="errorId()" role="alert">{{ text }}</p> }
    </div>
  `,
  styleUrl: './oc-field.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OcField {
  readonly controlId = input.required<string>();
  readonly label = input.required<string>();
  readonly required = input(false);
  readonly hint = input<string>();
  readonly error = input<string | null | undefined>(null);
  readonly disabled = input(false);
  readonly density = input<'default' | 'compact'>('default');
  readonly labelId = computed(() => `${this.controlId()}-label`);
  readonly hintId = computed(() => `${this.controlId()}-hint`);
  readonly errorId = computed(() => `${this.controlId()}-error`);
  readonly describedBy = computed(() => [this.hint() ? this.hintId() : '', this.error() ? this.errorId() : ''].filter(Boolean).join(' '));
}
