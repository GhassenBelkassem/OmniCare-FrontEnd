import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';

@Component({
  selector: 'oc-data-table-shell',
  imports: [NzAlertModule, NzSkeletonModule],
  template: `
    <section
      class="oc-table-shell"
      [class.oc-table-shell--compact]="density() === 'compact'"
      [class.oc-table-shell--flat]="flat()"
      aria-label="Operational data table"
    >
      <div class="oc-table-shell__header">
        <ng-content select="[ocTableTitle]" />
        <div class="oc-table-shell__tools"><ng-content select="[ocTableTools]" /></div>
      </div>
      @if (state() === 'loading') {
        <div class="oc-table-shell__state">
          <nz-skeleton [nzActive]="true" [nzParagraph]="{ rows: 5 }" />
        </div>
      } @else if (state() === 'error') {
        <div class="oc-table-shell__state">
          <nz-alert
            nzType="error"
            nzMessage="The table could not be loaded"
            nzDescription="Try again or contact support if the issue continues."
            nzShowIcon
          />
        </div>
      } @else if (state() === 'empty') {
        <div class="oc-table-shell__state"><ng-content select="oc-empty-state,[ocTableEmpty]" /></div>
      } @else {
        <div class="oc-table-shell__overflow" tabindex="0" aria-label="Scrollable table region">
          <ng-content />
        </div>
      }
      <div class="oc-table-shell__footer"><ng-content select="[ocTableFooter]" /></div>
    </section>
  `,
  styleUrl: './oc-data-table-shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OcDataTableShell {
  readonly state = input<'default' | 'loading' | 'empty' | 'error'>('default');
  readonly density = input<'compact' | 'comfortable'>('comfortable');
  readonly flat = input(false);
}
