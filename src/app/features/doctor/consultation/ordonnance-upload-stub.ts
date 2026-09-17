import { ChangeDetectionStrategy, Component, ElementRef, OnInit, input, output, signal, viewChild } from '@angular/core';

import { OcButton } from '../../../shared/ui';

@Component({
  selector: 'app-ordonnance-upload-stub',
  imports: [OcButton],
  templateUrl: './ordonnance-upload-stub.html',
  styleUrl: './ordonnance-upload-stub.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrdonnanceUploadStub implements OnInit {
  readonly text = input('');
  readonly textChange = output<string>();

  readonly currentText = signal('');
  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  ngOnInit(): void {
    this.currentText.set(this.text());
  }

  onPick(): void {
    this.fileInput()?.nativeElement.click();
  }

  onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    const fileName = file ? ` - ${file.name}` : '';
    const extracted = [
      'Prescription extraite (maquette, aucune OCR reelle)' + fileName + ':',
      'Paracetamol 1000 mg - 1 comprime 3x/jour pendant 5 jours',
      'Amoxicilline 500 mg - 1 gelule 3x/jour pendant 7 jours',
    ].join('\n');
    this.currentText.set(extracted);
    this.textChange.emit(extracted);
    input.value = '';
  }

  update(event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    this.currentText.set(value);
    this.textChange.emit(value);
  }

  clear(): void {
    this.currentText.set('');
    this.textChange.emit('');
  }
}
