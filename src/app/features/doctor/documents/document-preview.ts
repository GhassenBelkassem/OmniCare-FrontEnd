import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { MappingField } from './document-template.models';

@Component({
  selector: 'app-document-preview',
  templateUrl: './document-preview.html',
  styleUrl: './document-preview.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentPreview {
  readonly fields = input.required<readonly MappingField[]>();
  readonly overlays = input(false);
  readonly sampleData = input(false);
  readonly selectedFieldId = input<string | null>(null);
  readonly fieldSelected = output<string>();

  selectField(fieldId: string): void {
    if (this.overlays()) this.fieldSelected.emit(fieldId);
  }
}
