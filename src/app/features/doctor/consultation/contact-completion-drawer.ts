import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';

import { OcButton } from '../../../shared/ui';
import { ChartContactCard } from '../patient-chart/chart-contact-card';
import type { PatientChartDto } from '../patient-chart/patient-chart-api.models';
import { PatientChartApiService } from '../patient-chart/patient-chart-api.service';
import { ConsultationSessionStore } from './consultation-session.store';
import { ConsultationUi } from './consultation-ui';

/**
 * G-1 D5 « Compléter les coordonnées » from the « Terminer » warning (external patients only): the
 * existing « Coordonnées » card of the patient page, opened in edit mode in a right-side panel.
 * Once saved, the consultation's patient identity is re-read and the panel closes back to the
 * checklist, where the warning is recomputed. Closing without saving changes nothing.
 */
@Component({
  selector: 'app-contact-completion-drawer',
  imports: [NzDrawerModule, NzSkeletonModule, ChartContactCard, OcButton],
  template: `
    <nz-drawer
      nzPlacement="right"
      nzTitle="Compléter les coordonnées"
      [nzVisible]="ui.contactOpen()"
      [nzWidth]="width()"
      [nzBodyStyle]="bodyStyle()"
      [nzKeyboard]="true"
      [nzMaskClosable]="true"
      (nzOnClose)="close()"
    >
      <ng-container *nzDrawerContent>
        @if (chart(); as value) {
          <app-chart-contact-card [chart]="value" (updated)="onSaved()" (reloadRequested)="load()" />
        } @else if (failed()) {
          <div class="k-failed" role="alert">
            <p>Les coordonnées n’ont pas pu être chargées.</p>
            <oc-button size="small" variant="outline" (click)="load()">Réessayer</oc-button>
          </div>
        } @else {
          <nz-skeleton [nzActive]="true" [nzParagraph]="{ rows: 4 }" />
        }
      </ng-container>
    </nz-drawer>
  `,
  styles: `
    .k-failed { display: grid; gap: var(--oc-space-2); justify-items: start; color: var(--oc-ink); }
    .k-failed p { margin: 0; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactCompletionDrawer {
  readonly ui = inject(ConsultationUi);
  private readonly session = inject(ConsultationSessionStore);
  private readonly api = inject(PatientChartApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly card = viewChild(ChartContactCard);
  private editStarted = false;

  readonly chartId = computed(() => this.session.consultation()?.patient?.chartId ?? null);
  readonly chart = signal<PatientChartDto | null>(null);
  readonly failed = signal(false);

  constructor() {
    // Each opening reloads the chart (fresh contact version) and starts the edit at once.
    effect(() => {
      if (!this.ui.contactOpen()) return;
      untracked(() => this.load());
    });
    effect(() => {
      const card = this.card();
      if (!card || this.editStarted) return;
      this.editStarted = true;
      untracked(() => card.startEdit());
    });
  }

  load(): void {
    const id = this.chartId();
    if (id === null) return;
    this.chart.set(null);
    this.failed.set(false);
    this.editStarted = false;
    this.api.getChart(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (chart) => this.chart.set(chart),
      error: () => this.failed.set(true),
    });
  }

  async onSaved(): Promise<void> {
    await this.session.refreshPatient();
    this.close();
  }

  close(): void {
    this.ui.contactOpen.set(false);
  }

  /** White cards on the page grey (docs/ui-guidelines.md §8); 16px gutter on a phone. */
  bodyStyle(): Record<string, string> {
    const phone = (globalThis.innerWidth ?? 1280) < 768;
    return { background: 'var(--oc-bg)', padding: phone ? '16px' : '24px' };
  }

  width(): string {
    return (globalThis.innerWidth ?? 1280) < 768 ? '100%' : '560px';
  }
}
