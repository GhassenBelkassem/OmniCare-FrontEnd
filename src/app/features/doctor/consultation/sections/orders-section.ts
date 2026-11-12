import { ChangeDetectionStrategy, Component, inject, input, linkedSignal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSegmentedModule } from 'ng-zorro-antd/segmented';
import { NzSelectModule } from 'ng-zorro-antd/select';

import { ConsultationSessionStore, type OrderRow } from '../consultation-session.store';
import { ConsultationSectionDirective } from '../consultation-section.directive';
import { ConsultationUi, DISCARD_MESSAGE } from '../consultation-ui';
import {
  ORDER_CATEGORY_LABELS,
  ORDER_TARGET_PLACEHOLDERS,
  TEXT_LIMITS,
  type OrderCategory,
} from '../model/consultation-rules';

const CHOICES = [
  { label: 'Aucun examen', value: 'NONE' },
  { label: 'Demander un examen', value: 'REQUEST' },
];

/** Section 5: lab tests, imaging and referrals. Each row is its own draft, saved on its own. */
@Component({
  selector: 'app-orders-section',
  imports: [ConsultationSectionDirective, FormsModule, NzButtonModule, NzIconModule, NzInputModule, NzSegmentedModule, NzSelectModule],
  template: `
    <section class="c-card" appConsultationSection="examens" aria-labelledby="orders-title">
      <header class="c-card__header">
        <div class="c-card__title">
          <span class="c-card__number" aria-hidden="true">{{ number() }}</span>
          <h2 id="orders-title">Examens et orientation</h2>
        </div>
      </header>
      <div class="c-card__body">
        <div class="c-field" id="consultation-examens">
          <nz-segmented
            [nzOptions]="choices"
            [ngModel]="choice()"
            (ngModelChange)="choose($event)"
            aria-labelledby="orders-title"
          />
        </div>
        @if (session.ordersRequested()) {
          @for (row of session.orders(); track row.key; let index = $index) {
            <div class="c-subcard c-order" role="group" [attr.aria-label]="'Demande ' + (index + 1)">
              <div class="c-order__fields">
                <div class="c-field">
                  <label class="c-field__label" [for]="'order-' + row.key + '-category'">Type</label>
                  <nz-select
                    [nzId]="'order-' + row.key + '-category'"
                    [ngModel]="row.form.category"
                    [nzDisabled]="row.server !== null"
                    (ngModelChange)="session.updateOrder(row.key, { category: $event })"
                  >
                    @for (category of categories; track category) {
                      <nz-option [nzValue]="category" [nzLabel]="categoryLabels[category]" />
                    }
                  </nz-select>
                  @if (row.server !== null && !finalized(row)) {
                    <p class="c-field__hint">Pour changer de type, retirez la demande et ajoutez-en une nouvelle.</p>
                  }
                </div>
                <div class="c-field">
                  <label class="c-field__label" [for]="'order-' + row.key + '-target'">{{ targetLabel(row.form.category) }} *</label>
                  <input
                    nz-input
                    [id]="'order-' + row.key + '-target'"
                    [placeholder]="placeholders[row.form.category]"
                    [value]="row.form.target"
                    [disabled]="finalized(row)"
                    [attr.maxlength]="maxTarget"
                    [attr.aria-invalid]="ui.error(key(row)) ? 'true' : null"
                    (input)="session.updateOrder(row.key, { target: text($event) })"
                  />
                  @if (ui.error(key(row)); as message) { <p class="c-field__error" role="alert">{{ message }}</p> }
                </div>
              </div>
              @if (!finalized(row)) {
                <button nz-button nzType="text" type="button" [attr.aria-label]="'Retirer la demande ' + (index + 1)" (click)="remove(row)">
                  <nz-icon nzType="delete" aria-hidden="true" /> Retirer
                </button>
              } @else {
                <span class="c-field__hint">Validée</span>
              }
            </div>
          }
          <div class="c-inline">
            <button nz-button type="button" (click)="session.addOrder('LAB')">
              <nz-icon nzType="plus" aria-hidden="true" /> Ajouter
            </button>
          </div>
        }
      </div>
    </section>
  `,
  styleUrl: './consultation-sections.scss',
  styles: `
    .c-order { grid-template-columns: 1fr auto; align-items: start; }
    .c-order__fields { display: grid; grid-template-columns: minmax(140px, 180px) 1fr; gap: var(--oc-space-3); min-width: 0; }
    @media (max-width: 640px) {
      .c-order { grid-template-columns: 1fr; }
      .c-order__fields { grid-template-columns: 1fr; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrdersSection {
  readonly session = inject(ConsultationSessionStore);
  readonly ui = inject(ConsultationUi);
  readonly number = input.required<number>();

  readonly choices = CHOICES;
  get categories(): OrderCategory[] { return Object.keys(ORDER_CATEGORY_LABELS) as OrderCategory[]; }
  get categoryLabels(): typeof ORDER_CATEGORY_LABELS { return ORDER_CATEGORY_LABELS; }
  get placeholders(): typeof ORDER_TARGET_PLACEHOLDERS { return ORDER_TARGET_PLACEHOLDERS; }
  get maxTarget(): number { return TEXT_LIMITS.orderTargetMax; }
  readonly choice = linkedSignal(() => (this.session.ordersRequested() ? 'REQUEST' : 'NONE'));

  async choose(value: string | number): Promise<void> {
    const requested = value === 'REQUEST';
    const previous = this.choice();
    this.choice.set(requested ? 'REQUEST' : 'NONE');
    if (requested === this.session.ordersRequested()) return;
    if (!requested && this.session.ordersHaveData()) {
      const confirmed = await this.ui.confirm({
        title: 'Retirer les demandes d’examen ?',
        message: DISCARD_MESSAGE,
        confirmLabel: 'Retirer',
        destructive: true,
      });
      if (!confirmed) {
        this.choice.set(previous);
        return;
      }
    }
    if (!(await this.session.setOrdersRequested(requested))) this.choice.set(previous);
  }

  async remove(row: OrderRow): Promise<void> {
    if (row.form.target.trim() !== '' || row.server !== null) {
      const confirmed = await this.ui.confirm({
        title: 'Retirer cette demande ?',
        message: DISCARD_MESSAGE,
        confirmLabel: 'Retirer',
        destructive: true,
      });
      if (!confirmed) return;
    }
    await this.session.removeOrder(row.key);
    if (this.session.orders().length === 0) this.session.ordersRequested.set(false);
  }

  finalized(row: OrderRow): boolean {
    return row.server?.status === 'FINALIZED';
  }

  key(row: OrderRow): string {
    return `order:${row.key}.target`;
  }

  targetLabel(category: OrderCategory): string {
    return category === 'LAB' ? 'Analyse demandée' : category === 'IMAGING' ? 'Imagerie demandée' : 'Spécialité';
  }

  text(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }
}
