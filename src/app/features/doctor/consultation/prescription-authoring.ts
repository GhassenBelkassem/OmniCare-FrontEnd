import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, effect, inject, input, viewChildren } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OcButton } from '../../../shared/ui';
import { ClinicalRecordStore } from '../clinical-record.store';
import type { PrescriptionMedication, PrescriptionResponse } from '../prescription.models';
import { PrescriptionStore } from '../prescription.store';

@Component({
  selector: 'app-prescription-authoring',
  imports: [FormsModule, OcButton],
  templateUrl: './prescription-authoring.html',
  styleUrl: './prescription-authoring.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrescriptionAuthoring {
  readonly consultationId = input.required<string>();
  readonly consultationStatus = input<'IN_PROGRESS' | 'FINALIZING' | 'COMPLETED' | 'ABORTED'>('IN_PROGRESS');
  readonly store = inject(PrescriptionStore);
  readonly clinical = inject(ClinicalRecordStore);
  private readonly medicationNames = viewChildren<ElementRef<HTMLInputElement>>('medicationName');

  constructor() {
    const destroyRef = inject(DestroyRef);
    effect(() => this.store.attach(this.consultationId()));
    destroyRef.onDestroy(() => this.store.clear());
  }
  addMedication(): void {
    const item: PrescriptionMedication = { itemId: globalThis.crypto.randomUUID(), replacesItemId: null,
      medicationCode: null, name: null, strength: null, dose: { amount: 1, unit: 'mg' }, route: 'ORAL',
      frequency: { timesPerDay: 1, text: null }, duration: null, quantity: null, instructions: null };
    this.store.setDraft({ ...this.store.draft(), medications: [...this.store.draft().medications, item] });
    globalThis.setTimeout(() => this.medicationNames().at(-1)?.nativeElement.focus());
  }
  remove(itemId: string): void { this.store.setDraft({ ...this.store.draft(), medications: this.store.draft().medications.filter((item) => item.itemId !== itemId) }); }
  update(itemId: string, field: 'name' | 'medicationCode' | 'strength' | 'route' | 'instructions', value: string): void {
    this.replace(itemId, (item) => ({ ...item, [field]: nullable(value) ?? (field === 'route' ? '' : null) }));
  }
  updateDose(itemId: string, field: 'amount' | 'unit', value: string | number): void {
    this.replace(itemId, (item) => ({ ...item, dose: { ...item.dose, [field]: field === 'amount' ? Number(value) : String(value) } }));
  }
  updateFrequencyTimes(itemId: string, value: number | string): void {
    const times = Number(value);
    this.replace(itemId, (item) => ({ ...item, frequency: { timesPerDay: times > 0 ? times : null, text: times > 0 ? null : item.frequency.text } }));
  }
  updateFrequencyText(itemId: string, value: string): void {
    const text = nullable(value); this.replace(itemId, (item) => ({ ...item, frequency: { timesPerDay: text === null ? item.frequency.timesPerDay : null, text } }));
  }
  updateDurationValue(itemId: string, value: number | string): void {
    const duration = Number(value); this.replace(itemId, (item) => this.withDerivedQuantity({ ...item, duration: duration > 0 ? { value: duration, unit: item.duration?.unit ?? 'DAY' } : null }));
  }
  updateDurationUnit(itemId: string, unit: 'DAY' | 'WEEK' | 'MONTH'): void {
    this.replace(itemId, (item) => ({ ...item, duration: item.duration === null ? null : { ...item.duration, unit } }));
  }
  updateQuantity(itemId: string, value: number | string): void {
    const quantity = Number(value); this.replace(itemId, (item) => ({ ...item, quantity: quantity > 0 ? quantity : null }));
  }
  chooseFrequency(itemId: string, timesPerDay: number): void {
    this.replace(itemId, (item) => this.withDerivedQuantity({ ...item,
      frequency: { timesPerDay, text: null } }));
  }
  chooseDuration(itemId: string, days: number): void {
    this.replace(itemId, (item) => this.withDerivedQuantity({ ...item,
      duration: { value: days, unit: 'DAY' } }));
  }
  updateGeneral(value: string): void { this.store.setDraft({ ...this.store.draft(), generalInstructions: nullable(value) }); }
  canAuthor(): boolean { return this.consultationStatus() === 'IN_PROGRESS' && this.clinical.authoritative()?.clinicalRecord?.medicationDecision === 'MEDICATION_PRESCRIBED'; }
  readOnly(value: PrescriptionResponse): boolean { return value.finalized || value.status === 'ACTIVE'; }
  finalize(): void {
    if (globalThis.window?.confirm('Finaliser et signer cette prescription ? Son contenu deviendra immuable.') ?? false) void this.store.finalize();
  }
  private replace(itemId: string, change: (value: PrescriptionMedication) => PrescriptionMedication): void {
    this.store.setDraft({ ...this.store.draft(), medications: this.store.draft().medications.map((item) => item.itemId === itemId ? change(item) : item) });
  }
  private withDerivedQuantity(item: PrescriptionMedication): PrescriptionMedication {
    const times = item.frequency.timesPerDay;
    const days = item.duration?.unit === 'DAY' ? item.duration.value : null;
    const amount = item.dose.amount;
    return times !== null && days !== null && Number.isInteger(amount * times * days)
      ? { ...item, quantity: amount * times * days }
      : item;
  }
}
function nullable(value: string): string | null { const trimmed = value.trim(); return trimmed.length === 0 ? null : trimmed; }
