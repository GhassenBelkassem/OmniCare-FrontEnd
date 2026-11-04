import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OcButton } from '../../../shared/ui';
import { ClinicalOrderStore } from '../clinical-order.store';
import { orderLabel, type ClinicalOrder, type ClinicalOrderCategory } from '../clinical-order.models';

@Component({
  selector: 'app-clinical-orders',
  imports: [FormsModule, OcButton],
  templateUrl: './clinical-orders.html',
  styleUrl: './clinical-orders.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClinicalOrders {
  readonly consultationId = input.required<string>();
  readonly store = inject(ClinicalOrderStore);
  readonly categories: readonly ClinicalOrderCategory[] = ['LAB', 'IMAGING', 'REFERRAL'];

  constructor() {
    const destroyRef = inject(DestroyRef);
    effect(() => this.store.attach(this.consultationId()));
    destroyRef.onDestroy(() => this.store.clear());
  }
  label(order: ClinicalOrder): string { return orderLabel(order); }
  categoryLabel(value: ClinicalOrderCategory): string { return value === 'LAB' ? 'Laboratoire' : value === 'IMAGING' ? 'Imagerie' : 'Orientation'; }
  fieldLabel(value: ClinicalOrderCategory): string { return value === 'LAB' ? 'Examen demandé' : value === 'IMAGING' ? 'Étude demandée' : 'Spécialité recommandée'; }
  editorValue(): string {
    const editor = this.store.editor(); if (editor === null) return '';
    return editor.category === 'LAB' ? editor.draft.requestedExamination ?? '' : editor.category === 'IMAGING' ? editor.draft.requestedStudy ?? '' : editor.draft.targetSpecialty ?? '';
  }
  updateValue(event: Event): void { this.store.setValue((event.target as HTMLInputElement).value); }
}
