import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const ZONE = 'Africa/Tunis';

function parse(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = /^\d{4}-\d{2}-\d{2}$/u.test(value) ? new Date(`${value}T12:00:00Z`) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Day + short month of a date in Tunis time: `{ day: '13', month: 'NOV.', full: '13 novembre 2026' }`. */
export function dateBlockParts(value: string | null | undefined): { day: string; month: string; full: string } | null {
  const date = parse(value);
  if (!date) return null;
  const day = new Intl.DateTimeFormat('fr-FR', { timeZone: ZONE, day: 'numeric' }).format(date);
  const month = new Intl.DateTimeFormat('fr-FR', { timeZone: ZONE, month: 'short' }).format(date);
  const full = new Intl.DateTimeFormat('fr-FR', { timeZone: ZONE, day: 'numeric', month: 'long', year: 'numeric' }).format(date);
  return { day, month: month.toLocaleUpperCase('fr-FR'), full };
}

/**
 * Calendar-style date block (day 26 / 800 + « NOV. »). `care` = the primary tint (most recent),
 * `neutral` = white tile with a hairline. The full date is read by screen readers.
 */
@Component({
  selector: 'oc-date-block',
  template: `
    @if (parts(); as value) {
      <span class="oc-date-block" [class.oc-date-block--care]="tone() === 'care'" [class.oc-date-block--small]="size() === 'small'">
        <span class="oc-date-block__day" aria-hidden="true">{{ value.day }}</span>
        <span class="oc-date-block__month" aria-hidden="true">{{ value.month }}</span>
        <span class="oc-sr-only">{{ value.full }}</span>
      </span>
    } @else {
      <span class="oc-date-block" [class.oc-date-block--small]="size() === 'small'">
        <span class="oc-date-block__month">Date inconnue</span>
      </span>
    }
  `,
  styles: `
    :host { display: inline-flex; flex: 0 0 auto; }
    .oc-date-block {
      position: relative;
      display: inline-grid;
      width: 64px;
      height: 70px;
      align-content: center;
      justify-items: center;
      gap: 2px;
      border: 1px solid var(--oc-hairline);
      border-radius: var(--oc-radius-tile);
      background: var(--oc-surface);
      color: var(--oc-ink);
      text-align: center;
    }
    .oc-date-block--care { border-color: transparent; background: var(--oc-info-care-tint); color: var(--oc-info-care); }
    .oc-date-block__day { font-size: 26px; font-weight: var(--oc-font-weight-heavy); line-height: 1; }
    .oc-date-block__month { font-size: 12px; font-weight: var(--oc-font-weight-strong); line-height: 1.2; }
    .oc-date-block--small { width: 44px; height: 48px; border-radius: var(--oc-radius-icon); }
    .oc-date-block--small .oc-date-block__day { font-size: 18px; }
    .oc-date-block--small .oc-date-block__month { font-size: 11px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OcDateBlock {
  readonly date = input<string | null>(null);
  readonly tone = input<'care' | 'neutral'>('neutral');
  readonly size = input<'default' | 'small'>('default');
  readonly parts = computed(() => dateBlockParts(this.date()));
}
