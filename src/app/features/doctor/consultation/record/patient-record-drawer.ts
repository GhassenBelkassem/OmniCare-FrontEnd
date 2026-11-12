import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';

import { ConsultationSessionStore } from '../consultation-session.store';
import { ConsultationUi } from '../consultation-ui';
import { PatientRecordPanel } from './patient-record-panel';

/**
 * « Dossier patient » as a right-side panel over the consultation (no navigation). It only reads
 * the patient chart: opening or closing it never touches the drafts, the autosave queues or the
 * page's scroll position. Esc, the mask and the header's close button close it. The content is created on first open (`nzDrawerContent`)
 * and its code is loaded then (`@defer`).
 */
@Component({
  selector: 'app-patient-record-drawer',
  imports: [NzDrawerModule, NzSkeletonModule, PatientRecordPanel],
  template: `
    <nz-drawer
      nzPlacement="right"
      nzWrapClassName="consultation-record-drawer"
      [nzVisible]="ui.recordOpen()"
      [nzWidth]="width()"
      [nzClosable]="false"
      [nzBodyStyle]="bodyStyle()"
      [nzKeyboard]="true"
      [nzMaskClosable]="true"
      (nzOnClose)="ui.recordOpen.set(false)"
    >
      <ng-container *nzDrawerContent>
        @if (opened() && chartId(); as id) {
          @defer (on immediate) {
            <app-patient-record-panel [chartId]="id" [consultationId]="consultationId()" [closable]="true" (closed)="ui.recordOpen.set(false)" />
          } @placeholder {
            <nz-skeleton [nzActive]="true" [nzParagraph]="{ rows: 6 }" />
          }
        }
      </ng-container>
    </nz-drawer>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientRecordDrawer {
  readonly ui = inject(ConsultationUi);
  private readonly session = inject(ConsultationSessionStore);

  readonly chartId = computed(() => this.session.consultation()?.patient?.chartId ?? null);
  readonly consultationId = computed(() => this.session.consultation()?.consultationId ?? null);
  /**
   * True from the first opening on. NG-ZORRO renders the drawer content up front, so the chart is
   * only requested once the doctor opens the panel; it then stays (tab kept between openings).
   */
  readonly opened = signal(false);

  constructor() {
    effect(() => {
      if (this.ui.recordOpen()) this.opened.set(true);
    });
  }

  /** White cards on the page grey (docs/ui-guidelines.md §8); 16px gutter on a phone. */
  bodyStyle(): Record<string, string> {
    const phone = (globalThis.innerWidth ?? 1280) < 768;
    return { background: 'var(--oc-bg)', padding: phone ? '16px' : '24px' };
  }

  /** ~60 % of the screen; the full width on a phone. */
  width(): string {
    return (globalThis.innerWidth ?? 1280) < 768 ? '100%' : '60%';
  }
}
