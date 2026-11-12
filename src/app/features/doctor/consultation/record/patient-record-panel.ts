import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';

import { OcButton } from '../../../../shared/ui';
import type { PatientChartDto } from '../../patient-chart/patient-chart-api.models';
import { PatientChartApiService } from '../../patient-chart/patient-chart-api.service';
import { PatientRecordView } from '../../patient-chart/record/patient-record-view';

type LoadState = 'loading' | 'ready' | 'error';

/**
 * Content of the consultation's « Dossier patient » panel: loads the chart (same endpoint and audit
 * as the chart page) and renders the shared {@link PatientRecordView}, read-only, with the current
 * consultation pinned in Historique. Loaded only when the panel is first opened.
 */
@Component({
  selector: 'app-patient-record-panel',
  imports: [NgTemplateOutlet, NzIconModule, NzSkeletonModule, OcButton, PatientRecordView],
  template: `
    @switch (state()) {
      @case ('ready') {
        @if (chart(); as chart) {
          <app-patient-record-view [chart]="chart" [currentConsultationId]="consultationId()" [closable]="closable()" (closed)="closed.emit()" />
        }
      }
      @case ('error') {
        <ng-container *ngTemplateOutlet="close" />
        <p class="panel-error" role="alert">Le dossier du patient n’a pas pu être chargé.
          <oc-button size="small" (click)="load()">Réessayer</oc-button></p>
      }
      @default {
        <ng-container *ngTemplateOutlet="close" />
        <nz-skeleton [nzActive]="true" [nzAvatar]="true" [nzParagraph]="{ rows: 6 }" />
      }
    }
    <ng-template #close>
      @if (closable()) {
        <button type="button" class="panel-close" aria-label="Fermer le dossier" (click)="closed.emit()">
          <nz-icon nzType="close" aria-hidden="true" />
        </button>
      }
    </ng-template>
  `,
  styles: `
    :host { display: grid; gap: var(--oc-space-4); }
    .panel-close {
      display: inline-grid; width: 44px; height: 44px; place-items: center; justify-self: end;
      border: 1px solid var(--oc-hairline); border-radius: var(--oc-radius-icon); background: var(--oc-surface);
      color: var(--oc-ink); font-size: 18px; cursor: pointer;
    }
    .panel-close:focus-visible { outline: 2px solid var(--oc-color-border-focus); outline-offset: 2px; }
    .panel-error { display: flex; flex-wrap: wrap; align-items: center; gap: var(--oc-space-3); margin: 0; color: var(--oc-error-dark); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientRecordPanel {
  private readonly api = inject(PatientChartApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly chartId = input.required<string>();
  readonly consultationId = input<string | null>(null);
  /** In the drawer: the record header carries the close button. */
  readonly closable = input(false);
  readonly closed = output<void>();
  readonly state = signal<LoadState>('loading');
  readonly chart = signal<PatientChartDto | null>(null);

  constructor() {
    effect(() => {
      this.chartId();
      untracked(() => this.load());
    });
  }

  load(): void {
    this.state.set('loading');
    this.api.getChart(this.chartId()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (chart) => {
        this.chart.set(chart);
        this.state.set('ready');
      },
      error: () => this.state.set('error'),
    });
  }
}
