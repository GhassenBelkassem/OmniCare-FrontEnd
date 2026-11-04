import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

import { OcButton, OcIcon, OcSheet } from '../../../shared/ui';
import { DocumentPreview } from './document-preview';
import { DEFAULT_MAPPING_FIELDS, PRESCRIPTION_FIELDS } from './document-template-demo.fixtures';
import {
  DOCUMENT_TYPE_LABELS,
  DocumentTemplateType,
  MappingField,
  TextAlignment,
  UploadedPdf,
} from './document-template.models';

export interface TemplateCreatedEvent {
  readonly name: string;
  readonly type: DocumentTemplateType;
  readonly pdf: UploadedPdf;
  readonly isDefault: boolean;
  readonly fields: readonly MappingField[];
}

interface PointerOperation {
  readonly id: string;
  readonly mode: 'move' | 'resize';
  readonly startX: number;
  readonly startY: number;
  readonly field: MappingField;
}

@Component({
  selector: 'app-document-template-wizard',
  imports: [OcButton, OcIcon, OcSheet, DocumentPreview],
  templateUrl: './document-template-wizard.html',
  styleUrls: ['./document-template-wizard.scss', './document-template-wizard.responsive.scss'],
  host: {
    '(document:pointermove)': 'onPointerMove($event)',
    '(document:pointerup)': 'onPointerUp()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentTemplateWizard {
  readonly open = input(false);
  readonly existingPdfs = input.required<readonly UploadedPdf[]>();
  readonly initialStep = input<1 | 2 | 3 | 4 | 5>(1);
  readonly forceSaveError = input(false);
  readonly dismissed = output<void>();
  readonly saved = output<TemplateCreatedEvent>();

  readonly step = signal<1 | 2 | 3 | 4 | 5>(1);
  readonly documentType = signal<DocumentTemplateType>('PRESCRIPTION');
  readonly pdfMode = signal<'upload' | 'existing'>('existing');
  readonly selectedPdfId = signal('pdf-lac2');
  readonly uploadedPdf = signal<UploadedPdf | null>(null);
  readonly uploadProgress = signal(0);
  readonly uploadError = signal<string | null>(null);
  readonly templateName = signal('Ordonnance — Cabinet Lac 2');
  readonly makeDefault = signal(false);
  readonly fields = signal<readonly MappingField[]>(DEFAULT_MAPPING_FIELDS);
  readonly selectedFieldId = signal<string | null>(DEFAULT_MAPPING_FIELDS[0]?.id ?? null);
  readonly zoom = signal(100);
  readonly saveError = signal<string | null>(null);
  readonly saving = signal(false);
  readonly mobileEditorNotice = signal(false);

  readonly typeOptions: readonly { value: DocumentTemplateType; label: string; detail: string }[] =
    [
      { value: 'PRESCRIPTION', label: 'Ordonnance', detail: 'Traitements et instructions' },
      {
        value: 'MEDICAL_CERTIFICATE',
        label: 'Certificat médical',
        detail: 'Attestation médicale générale',
      },
      { value: 'SICK_LEAVE', label: 'Arrêt maladie', detail: 'Durée et dates de repos' },
      {
        value: 'OTHER_CERTIFICATE',
        label: 'Autre certificat',
        detail: 'Document médical personnalisé',
      },
    ];
  readonly availableFields = PRESCRIPTION_FIELDS;
  readonly stepLabels = ['Type', 'Document PDF', 'Nom', 'Champs', 'Tester'];
  readonly selectedField = computed(() =>
    this.fields().find((field) => field.id === this.selectedFieldId()),
  );
  readonly chosenPdf = computed(() => {
    if (this.pdfMode() === 'upload') return this.uploadedPdf();
    return this.existingPdfs().find((pdf) => pdf.id === this.selectedPdfId()) ?? null;
  });
  readonly canContinue = computed(() => {
    if (this.step() === 1) return true;
    if (this.step() === 2) return this.chosenPdf() !== null && this.uploadError() === null;
    if (this.step() === 3) return this.templateName().trim().length >= 3;
    if (this.step() === 4) return this.fields().length > 0;
    return true;
  });
  readonly sheetTitle = computed(() =>
    this.step() === 4 ? 'Positionner les champs' : 'Ajouter un modèle',
  );
  readonly sheetDescription = computed(() =>
    this.step() === 4
      ? 'Placez uniquement les données dynamiques sur votre document existant.'
      : `Étape ${this.step()} sur 5 · ${this.stepLabels[this.step() - 1]}`,
  );
  readonly sheetWidth = computed(() => (this.step() === 4 ? '94vw' : '56rem'));

  private readonly editorCanvas = viewChild<ElementRef<HTMLElement>>('editorCanvas');
  private pointerOperation: PointerOperation | null = null;
  private initializedForOpen = false;

  constructor() {
    effect(() => {
      if (this.open() && !this.initializedForOpen) {
        this.step.set(this.initialStep());
        this.initializedForOpen = true;
      } else if (!this.open()) {
        this.initializedForOpen = false;
      }
    });
  }

  chooseType(type: DocumentTemplateType): void {
    this.documentType.set(type);
    if (type !== 'PRESCRIPTION') {
      this.templateName.set(DOCUMENT_TYPE_LABELS[type]);
    }
  }

  choosePdfMode(mode: 'upload' | 'existing'): void {
    this.pdfMode.set(mode);
    this.uploadError.set(null);
  }

  selectPdf(event: Event): void {
    this.selectedPdfId.set((event.target as HTMLSelectElement).value);
  }

  handleFile(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    const file = inputElement.files?.[0];
    this.uploadError.set(null);
    this.uploadProgress.set(0);
    this.uploadedPdf.set(null);
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLocaleLowerCase().endsWith('.pdf')) {
      this.uploadError.set('Format non pris en charge. Sélectionnez un fichier PDF.');
      inputElement.value = '';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.uploadError.set('Ce PDF dépasse la taille maximale autorisée de 10 Mo.');
      inputElement.value = '';
      return;
    }
    this.uploadProgress.set(100);
    this.uploadedPdf.set({
      id: `pdf-upload-${Date.now()}`,
      name: file.name,
      sizeLabel: `${Math.max(1, Math.round(file.size / 1024))} Ko`,
      uploadedAt: '31 oct. 2026',
      usedBy: 0,
    });
  }

  updateName(event: Event): void {
    this.templateName.set((event.target as HTMLInputElement).value);
  }

  goBack(): void {
    const current = this.step();
    if (current > 1) this.step.set((current - 1) as 1 | 2 | 3 | 4);
  }

  continue(): void {
    if (!this.canContinue()) return;
    const current = this.step();
    if (current < 5) this.step.set((current + 1) as 2 | 3 | 4 | 5);
  }

  addField(key: string): void {
    const option = this.availableFields.find((field) => field.key === key);
    if (!option) return;
    const index = this.fields().length;
    const field: MappingField = {
      id: `field-${option.key}-${index + 1}`,
      ...option,
      x: Math.min(65, 12 + (index % 4) * 8),
      y: Math.min(78, 35 + index * 5),
      width: option.kind === 'clinical' ? 64 : 34,
      height: option.kind === 'clinical' ? 10 : 6,
      fontSize: 10,
      alignment: 'left',
    };
    this.fields.update((fields) => [...fields, field]);
    this.selectedFieldId.set(field.id);
  }

  selectField(id: string): void {
    this.selectedFieldId.set(id);
  }

  removeSelectedField(): void {
    const selected = this.selectedFieldId();
    if (!selected) return;
    this.fields.update((fields) => fields.filter((field) => field.id !== selected));
    this.selectedFieldId.set(this.fields()[0]?.id ?? null);
  }

  resetFields(): void {
    this.fields.set(DEFAULT_MAPPING_FIELDS);
    this.selectedFieldId.set(DEFAULT_MAPPING_FIELDS[0]?.id ?? null);
  }

  updateSelected(patch: Partial<MappingField>): void {
    const selected = this.selectedFieldId();
    if (!selected) return;
    this.fields.update((fields) =>
      fields.map((field) => (field.id === selected ? { ...field, ...patch } : field)),
    );
  }

  updateNumber(property: 'x' | 'y' | 'width' | 'height' | 'fontSize', event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (!Number.isFinite(value)) return;
    this.updateSelected({ [property]: value });
  }

  setAlignment(alignment: TextAlignment): void {
    this.updateSelected({ alignment });
  }

  nudgeSelected(x: number, y: number): void {
    const field = this.selectedField();
    if (!field) return;
    this.updateSelected({
      x: Math.max(0, Math.min(100 - field.width, field.x + x)),
      y: Math.max(0, Math.min(100 - field.height, field.y + y)),
    });
  }

  onFieldKeydown(event: KeyboardEvent, field: MappingField): void {
    const step = event.shiftKey ? 2 : 0.5;
    const movement: Record<string, readonly [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const delta = movement[event.key];
    if (!delta) return;
    event.preventDefault();
    this.selectedFieldId.set(field.id);
    this.nudgeSelected(delta[0], delta[1]);
  }

  startPointerOperation(event: PointerEvent, field: MappingField, mode: 'move' | 'resize'): void {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    this.selectedFieldId.set(field.id);
    this.pointerOperation = {
      id: field.id,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      field,
    };
  }

  onPointerMove(event: PointerEvent): void {
    const operation = this.pointerOperation;
    const canvas = this.editorCanvas()?.nativeElement;
    if (!operation || !canvas) return;
    const bounds = canvas.getBoundingClientRect();
    if (bounds.width === 0 || bounds.height === 0) return;
    const deltaX = ((event.clientX - operation.startX) / bounds.width) * 100;
    const deltaY = ((event.clientY - operation.startY) / bounds.height) * 100;
    if (operation.mode === 'move') {
      this.updateSelected({
        x: Math.max(0, Math.min(100 - operation.field.width, operation.field.x + deltaX)),
        y: Math.max(0, Math.min(100 - operation.field.height, operation.field.y + deltaY)),
      });
      return;
    }
    this.updateSelected({
      width: Math.max(8, Math.min(100 - operation.field.x, operation.field.width + deltaX)),
      height: Math.max(3, Math.min(100 - operation.field.y, operation.field.height + deltaY)),
    });
  }

  onPointerUp(): void {
    this.pointerOperation = null;
  }

  changeZoom(delta: number): void {
    this.zoom.update((zoom) => Math.max(70, Math.min(130, zoom + delta)));
  }

  saveTemplate(): void {
    const pdf = this.chosenPdf();
    if (!pdf || this.saving()) return;
    this.saveError.set(null);
    if (this.forceSaveError()) {
      this.saveError.set(
        'Impossible d’enregistrer le modèle. Vérifiez votre connexion puis réessayez.',
      );
      return;
    }
    this.saving.set(true);
    this.saved.emit({
      name: this.templateName().trim(),
      type: this.documentType(),
      pdf,
      isDefault: this.makeDefault(),
      fields: this.fields(),
    });
    this.saving.set(false);
  }
}
