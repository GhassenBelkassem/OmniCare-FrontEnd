import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';

export type OcFileCardTone = 'care' | 'history' | 'allergy';

/**
 * A file as one clickable card: coloured format tile (« PDF »), title, subtitle and a trailing
 * action icon. The whole card is a native button (keyboard and screen-reader accessible).
 */
@Component({
  selector: 'oc-file-card',
  imports: [NzIconModule],
  template: `
    <button
      type="button"
      class="oc-file-card"
      [disabled]="disabled() || loading()"
      [attr.aria-label]="ariaLabel()"
      [attr.aria-busy]="loading() || null"
      (click)="activate.emit()"
    >
      <span class="oc-file-card__badge" [class]="'oc-file-card__badge oc-file-card__badge--' + tone()" aria-hidden="true">{{ badge() }}</span>
      <span class="oc-file-card__text">
        <span class="oc-file-card__title">{{ title() }}</span>
        @if (subtitle()) { <span class="oc-file-card__subtitle">{{ subtitle() }}</span> }
      </span>
      <span class="oc-file-card__action" aria-hidden="true">
        <nz-icon [nzType]="loading() ? 'sync' : icon()" [nzSpin]="loading()" />
      </span>
    </button>
  `,
  styles: `
    :host { display: block; min-width: 0; }
    .oc-file-card {
      display: flex;
      width: 100%;
      min-height: 72px;
      align-items: center;
      gap: var(--oc-space-3);
      padding: var(--oc-space-3) var(--oc-space-4) var(--oc-space-3) var(--oc-space-3);
      border: 1px solid var(--oc-hairline);
      border-radius: var(--oc-radius-tile);
      background: var(--oc-surface);
      color: var(--oc-ink);
      font: inherit;
      text-align: start;
      cursor: pointer;
      transition: box-shadow var(--oc-motion-fast, 120ms) ease, border-color var(--oc-motion-fast, 120ms) ease;
    }
    .oc-file-card:hover:not(:disabled) { border-color: var(--oc-primary); box-shadow: var(--oc-shadow-soft); }
    .oc-file-card:focus-visible { outline: 2px solid var(--oc-color-border-focus); outline-offset: 2px; }
    .oc-file-card:disabled { cursor: not-allowed; opacity: 0.6; }
    .oc-file-card__badge {
      display: inline-grid;
      flex: 0 0 44px;
      width: 44px;
      height: 44px;
      place-items: center;
      border-radius: var(--oc-radius-icon);
      font-size: 12px;
      font-weight: var(--oc-font-weight-heavy);
    }
    .oc-file-card__badge--care { background: var(--oc-info-care-tint); color: var(--oc-info-care); }
    .oc-file-card__badge--history { background: var(--oc-info-history-tint); color: var(--oc-info-history); }
    .oc-file-card__badge--allergy { background: var(--oc-info-allergy-tint); color: var(--oc-info-allergy); }
    .oc-file-card__text { display: grid; flex: 1; min-width: 0; gap: 2px; }
    .oc-file-card__title { color: var(--oc-ink); font-size: 15px; font-weight: var(--oc-font-weight-strong); overflow-wrap: anywhere; }
    .oc-file-card__subtitle { color: var(--oc-ink-secondary); font-size: var(--oc-text-small-size); }
    .oc-file-card__action { display: inline-grid; flex: 0 0 auto; color: var(--oc-info-care-icon); font-size: 18px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OcFileCard {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
  readonly tone = input<OcFileCardTone>('care');
  readonly badge = input('PDF');
  readonly icon = input('download');
  /** Verb read before the title, e.g. « Télécharger ». */
  readonly actionLabel = input('Télécharger');
  readonly loading = input(false);
  readonly disabled = input(false);
  readonly activate = output<void>();

  readonly ariaLabel = computed(() =>
    [`${this.actionLabel()} : ${this.title()}`, this.subtitle()].filter(Boolean).join(', '));
}
