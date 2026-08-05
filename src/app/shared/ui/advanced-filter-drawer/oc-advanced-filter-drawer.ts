import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';

import { OcButton } from '../button/oc-button';
import { OcIconButton } from '../icon-button/oc-icon-button';

@Component({
  selector: 'oc-advanced-filter-drawer',
  imports: [NzDrawerModule, OcButton, OcIconButton],
  template: `
    <nz-drawer
      [nzVisible]="open()"
      nzPlacement="right"
      nzWidth="min(460px, 100vw)"
      [nzClosable]="false"
      [nzMaskClosable]="true"
      [nzKeyboard]="true"
      (nzOnClose)="close()"
    >
      <ng-container *nzDrawerContent>
        <section class="oc-filter-drawer" aria-labelledby="oc-filter-drawer-title">
          <header class="oc-filter-drawer__header">
            <div>
              <p class="oc-filter-drawer__eyebrow">{{ activeFilterCount() }} active filters</p>
              <h2 id="oc-filter-drawer-title">{{ title() }}</h2>
            </div>
            <oc-icon-button
              label="Close advanced filters"
              icon="close"
              appearance="quiet"
              (click)="close()"
            />
          </header>
          <div class="oc-filter-drawer__reset-row">
            <p>Refine this view without changing saved defaults.</p>
            <oc-button variant="quiet" size="small" (click)="reset.emit()">Reset all</oc-button>
          </div>
          <div class="oc-filter-drawer__content"><ng-content /></div>
          <footer class="oc-filter-drawer__footer">
            <oc-button variant="secondary" (click)="reset.emit()">Reset</oc-button>
            <oc-button variant="primary" (click)="apply.emit()">Apply filters</oc-button>
          </footer>
        </section>
      </ng-container>
    </nz-drawer>
  `,
  styleUrl: './oc-advanced-filter-drawer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OcAdvancedFilterDrawer {
  readonly open = model(false);
  readonly title = input('Advanced filters');
  readonly activeFilterCount = input(0);
  readonly reset = output<void>();
  readonly apply = output<void>();
  readonly closed = output<void>();

  close(): void {
    this.open.set(false);
    this.closed.emit();
  }
}
