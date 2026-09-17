import { ChangeDetectionStrategy, Component, OnInit, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { MockVitals } from '../doctor-mock.models';

@Component({
  selector: 'app-vitals-form',
  imports: [FormsModule],
  templateUrl: './vitals-form.html',
  styleUrl: './vitals-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VitalsForm implements OnInit {
  readonly vitals = input.required<MockVitals>();
  readonly vitalsChange = output<MockVitals>();

  readonly systolicBP = signal<number | null>(null);
  readonly diastolicBP = signal<number | null>(null);
  readonly heartRate = signal<number | null>(null);
  readonly temperature = signal<number | null>(null);
  readonly weight = signal<number | null>(null);

  ngOnInit(): void {
    const vitals = this.vitals();
    this.systolicBP.set(vitals.systolicBP);
    this.diastolicBP.set(vitals.diastolicBP);
    this.heartRate.set(vitals.heartRate);
    this.temperature.set(vitals.temperature);
    this.weight.set(vitals.weight);
  }

  update(field: keyof MockVitals, value: string): void {
    const parsed = value.trim() === '' ? null : Number(value);
    this.setField(field, Number.isNaN(parsed) ? null : parsed);
  }

  private setField(field: keyof MockVitals, value: number | null): void {
    switch (field) {
      case 'systolicBP': this.systolicBP.set(value); break;
      case 'diastolicBP': this.diastolicBP.set(value); break;
      case 'heartRate': this.heartRate.set(value); break;
      case 'temperature': this.temperature.set(value); break;
      case 'weight': this.weight.set(value); break;
    }
    this.vitalsChange.emit({
      systolicBP: this.systolicBP(),
      diastolicBP: this.diastolicBP(),
      heartRate: this.heartRate(),
      temperature: this.temperature(),
      weight: this.weight(),
    });
  }
}
