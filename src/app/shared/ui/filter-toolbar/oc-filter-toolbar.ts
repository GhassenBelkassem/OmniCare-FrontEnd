import { ChangeDetectionStrategy, Component, input, model, output, viewChild } from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';

import { OcButton } from '../button/oc-button';
import { OcIconButton } from '../icon-button/oc-icon-button';
import { OcSegmentOption, OcSegmentedControl } from '../segmented-control/oc-segmented-control';

@Component({
  selector: 'oc-filter-toolbar',
  imports: [NzIconModule, NzInputModule, OcButton, OcIconButton, OcSegmentedControl],
  template: `
    <section class="oc-filter-toolbar" [class.oc-filter-toolbar--flat]="flat()" aria-label="Data filters">
      <div class="oc-filter-toolbar__primary">
        <label class="oc-search">
          <span class="oc-sr-only">{{ searchLabel() }}</span>
          <nz-icon nzType="search" aria-hidden="true" />
          <input
            nz-input
            type="search"
            [placeholder]="searchPlaceholder()"
            [value]="query()"
            (input)="updateQuery($event)"
          />
        </label>
        <ng-content select="[ocInlineFilter]" />
        <oc-button #advancedButton leadingIcon="filter" (click)="advancedFilter.emit()">
          {{ advancedLabel() }}
          @if (activeFilterCount() > 0) {
            <span class="oc-filter-toolbar__count">{{ activeFilterCount() }}</span>
          }
        </oc-button>
        @if (activeFilterCount() > 0) {
          <oc-button variant="quiet" size="small" (click)="clearAll.emit()">Clear all</oc-button>
        }
      </div>
      @if (showViewControls()) {
        <div class="oc-filter-toolbar__views">
          <oc-segmented-control label="View mode" [options]="viewOptions()" [(selected)]="viewMode" />
          <oc-icon-button
            label="Customize columns"
            tooltip="Customize columns"
            icon="table"
            appearance="quiet"
            (click)="customizeColumns.emit()"
          />
        </div>
      }
      <div class="oc-filter-toolbar__chips"><ng-content /></div>
    </section>
  `,
  styleUrl: './oc-filter-toolbar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OcFilterToolbar {
  readonly searchLabel = input('Search records');
  readonly searchPlaceholder = input('Search');
  readonly activeFilterCount = input(0);
  readonly showViewControls = input(true);
  readonly flat = input(false);
  readonly advancedLabel = input('Advanced filters');
  readonly query = model('');
  readonly viewMode = model('list');
  readonly viewOptions = input<readonly OcSegmentOption[]>([
    { value: 'list', label: 'List', icon: 'unordered-list' },
    { value: 'board', label: 'Board', icon: 'appstore' },
  ]);
  readonly advancedFilter = output<void>();
  readonly clearAll = output<void>();
  readonly customizeColumns = output<void>();
  private readonly advancedButton = viewChild.required<OcButton>('advancedButton');

  updateQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  focusAdvancedTrigger(): void {
    this.advancedButton().focus();
  }
}
