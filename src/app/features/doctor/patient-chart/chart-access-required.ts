import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';

/** Compact « Accès requis » block shown in place of a medical section (never a full page). */
@Component({
  selector: 'app-chart-access-required',
  imports: [NzIconModule],
  template: `
    <div class="chart-access-required" role="note" data-testid="access-required">
      <span class="chart-access-required__icon" aria-hidden="true"><nz-icon nzType="lock" /></span>
      <div>
        <p class="chart-access-required__title">{{ title() }}</p>
        <p class="chart-access-required__text">{{ message() }}</p>
      </div>
    </div>
  `,
  styles: `
    :host { display: block; }
    .chart-access-required {
      display: flex;
      gap: var(--oc-space-3);
      align-items: flex-start;
      padding: var(--oc-space-4);
      border: 1px dashed var(--oc-border);
      border-radius: var(--oc-radius-md);
      background: var(--oc-grey-50);
    }
    .chart-access-required__icon {
      display: inline-grid;
      flex: 0 0 32px;
      width: 32px;
      height: 32px;
      place-items: center;
      border-radius: var(--oc-radius-md);
      background: var(--oc-surface);
      color: var(--oc-text-muted);
    }
    p { margin: 0; }
    .chart-access-required__title {
      color: var(--oc-text-strong);
      font-weight: 600;
      font-size: var(--oc-text-body-size);
    }
    .chart-access-required__text {
      margin-block-start: 2px;
      color: var(--oc-text-muted);
      font-size: var(--oc-text-small-size);
      line-height: var(--oc-text-small-line-height);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChartAccessRequired {
  readonly title = input('Accès requis');
  readonly message = input(
    'Les données médicales de ce patient sont chiffrées. Le patient peut vous accorder l’accès depuis son application OmniCare (QR code ou autorisation).',
  );
}
