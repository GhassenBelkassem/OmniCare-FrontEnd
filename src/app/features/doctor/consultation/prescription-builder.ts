import { ChangeDetectionStrategy, Component, OnInit, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { MockPrescriptionLine } from '../doctor-mock.models';
import { OcButton } from '../../../shared/ui';

@Component({
  selector: 'app-prescription-builder',
  imports: [FormsModule, OcButton],
  templateUrl: './prescription-builder.html',
  styleUrl: './prescription-builder.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrescriptionBuilder implements OnInit {
  readonly lines = input.required<readonly MockPrescriptionLine[]>();
  readonly linesChange = output<readonly MockPrescriptionLine[]>();

  readonly current = signal<readonly MockPrescriptionLine[]>([]);

  ngOnInit(): void {
    this.current.set(this.lines());
  }

  addLine(): void {
    const blank: MockPrescriptionLine = { id: Date.now(), drugName: '', dosage: '', timing: '', duration: '' };
    this.emit([...this.current(), blank]);
  }

  removeLine(id: number): void {
    this.emit(this.current().filter((line) => line.id !== id));
  }

  updateLine(id: number, field: keyof MockPrescriptionLine, value: string): void {
    this.emit(this.current().map((line) => (line.id === id ? { ...line, [field]: value } : line)));
  }

  private emit(lines: readonly MockPrescriptionLine[]): void {
    this.current.set(lines);
    this.linesChange.emit(lines);
  }
}
