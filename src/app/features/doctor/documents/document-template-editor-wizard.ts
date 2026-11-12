import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs/operators';

import { OcButton, OcIcon, OcSheet } from '../../../shared/ui';
import { DocumentTemplateApiService } from './document-template-api.service';
import {
  DOCUMENT_FIELD_DETECTION_SOURCE_LABELS,
  DOCUMENT_TEMPLATE_TYPE_LABEL,
  DocumentFieldDefinition,
  DocumentFieldDetectionSource,
  DocumentFieldInput,
  DocumentTemplate,
  DocumentTemplateField,
  DocumentTemplatePreviewRequest,
  SaveDocumentTemplateDraftRequest,
  detectionWarningLabel,
  formatFileSize,
  isGraphicFieldType,
  missingRequiredFieldLabels,
} from './document-template-api.models';
import { documentTemplateErrorMessage } from './document-template-errors';

export interface TemplateWizardResult {
  readonly id: string;
  readonly name: string;
  readonly status: 'DRAFT' | 'ACTIVE' | 'INACTIVE';
  readonly isDefault: boolean;
}

interface EditorField {
  readonly id: string;
  readonly fieldKey: string;
  readonly label: string;
  readonly valueSource: DocumentFieldInput['valueSource'];
  readonly fieldType: DocumentFieldInput['fieldType'];
  readonly required: boolean;
  readonly pageNumber: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly fontFamily: string;
  readonly fontSize: number;
  readonly alignment: 'left' | 'center' | 'right';
  readonly formatPattern: string | null;
  readonly sampleValue: string | null;
  readonly detectionSource: DocumentFieldDetectionSource | null;
  readonly confidence: number | null;
}

interface PointerOperation {
  readonly id: string;
  readonly mode: 'move' | 'resize';
  readonly startX: number;
  readonly startY: number;
  readonly field: EditorField;
}

@Component({
  selector: 'app-document-template-editor-wizard',
  imports: [OcButton, OcIcon, OcSheet],
  templateUrl: './document-template-editor-wizard.html',
  styleUrls: [
    './document-template-wizard.scss',
    './document-template-wizard.responsive.scss',
    './document-template-editor-wizard.scss',
  ],
  host: {
    '(document:pointermove)': 'onPointerMove($event)',
    '(document:pointerup)': 'onPointerUp()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentTemplateEditorWizard {
  private readonly api = inject(DocumentTemplateApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly document = inject(DOCUMENT);

  readonly open = input(false);
  readonly initialStep = input<1 | 2 | 3 | 4 | 5>(1);
  readonly template = input<DocumentTemplate | null>(null);
  readonly catalog = input.required<readonly DocumentFieldDefinition[]>();
  readonly dismissed = output<void>();
  readonly completed = output<TemplateWizardResult>();

  readonly step = signal<1 | 2 | 3 | 4 | 5>(1);
  readonly fileName = signal<string | null>(null);
  readonly fileSize = signal<string | null>(null);
  readonly fileError = signal<string | null>(null);
  readonly templateName = signal(DOCUMENT_TEMPLATE_TYPE_LABEL);
  readonly makeDefault = signal(false);
  readonly fields = signal<readonly EditorField[]>([]);
  readonly selectedFieldId = signal<string | null>(null);
  readonly currentPage = signal(1);
  readonly detectionWarnings = signal<readonly string[]>([]);
  readonly unresolvedKeys = signal<readonly string[]>([]);
  readonly zoom = signal(100);
  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);
  readonly createdTemplate = signal<DocumentTemplate | null>(null);
  readonly pageImageUrl = signal<string | null>(null);
  readonly pageImageAspect = signal<string | null>(null);
  readonly pageImageLoading = signal(false);
  readonly pageImageError = signal(false);
  readonly previewUrl = signal<SafeResourceUrl | null>(null);
  readonly previewLoading = signal(false);
  readonly previewError = signal<string | null>(null);
  readonly stepLabels = ['Type', 'Document PDF', 'Nom', 'Champs', 'Tester'];
  readonly typeLabel = DOCUMENT_TEMPLATE_TYPE_LABEL;

  readonly pageCount = computed(() => this.createdTemplate()?.currentVersion.pageCount ?? 1);
  readonly pageFields = computed(() =>
    this.fields().filter((field) => field.pageNumber === this.currentPage()),
  );
  readonly selectedField = computed(() =>
    this.fields().find((field) => field.id === this.selectedFieldId()),
  );
  readonly detectionNotices = computed(() => {
    const notices = this.detectionWarnings()
      .filter((token) => !token.startsWith('detection.unresolvedRequired:'))
      .filter((token) => {
        if (!token.startsWith('detection.lowConfidence:')) return true;
        const key = token.slice('detection.lowConfidence:'.length);
        const field = this.fields().find((candidate) => candidate.fieldKey === key);
        return field !== undefined && field.detectionSource !== 'MANUAL';
      })
      .map((token) => detectionWarningLabel(token));
    return [...new Set(notices)];
  });
  readonly unresolvedLabels = computed(() => {
    const labels = new Map(this.catalog().map((field) => [field.key, field.label]));
    const present = new Set(this.fields().map((field) => field.fieldKey));
    return this.unresolvedKeys()
      .filter((key) => !present.has(key))
      .map((key) => labels.get(key) ?? key);
  });
  readonly requiredMissing = computed(() =>
    missingRequiredFieldLabels(this.catalog(), this.fields()),
  );
  readonly canContinue = computed(() => {
    if (this.step() === 1) return true;
    if (this.step() === 2) return this.fileName() !== null && this.fileError() === null;
    if (this.step() === 3) return this.templateName().trim().length >= 3;
    if (this.step() === 4) {
      return this.fields().length > 0 && this.requiredMissing().length === 0 && !this.saving();
    }
    return true;
  });
  readonly canGoBack = computed(() => {
    if (this.step() <= 1) return false;
    if (this.createdTemplate() !== null && this.step() === 3) return false;
    return true;
  });
  readonly sheetTitle = computed(() =>
    this.step() === 4 ? 'Positionner les champs' : 'Ajouter un modèle',
  );
  readonly sheetDescription = computed(() =>
    this.step() === 4
      ? 'Placez uniquement les données dynamiques sur votre document existant.'
      : `Étape ${this.step()} sur 5 — ${this.stepLabels[this.step() - 1]}`,
  );
  readonly sheetWidth = computed(() => (this.step() === 4 ? '94vw' : '56rem'));
  readonly footerContext = computed(
    () => `${this.stepLabels[this.step() - 1]} — étape ${this.step()} sur 5`,
  );
  readonly zoomScale = computed(() => this.zoom() / 100);

  private readonly editorCanvas = viewChild<ElementRef<HTMLElement>>('editorCanvas');
  private pointerOperation: PointerOperation | null = null;
  private initializedForOpen = false;
  private pageObjectUrl: string | null = null;
  private previewObjectUrl: string | null = null;
  private selectedFile: File | null = null;
  private localFieldSequence = 0;

  constructor() {
    effect(() => {
      if (this.open() && !this.initializedForOpen) {
        this.initialize();
        this.initializedForOpen = true;
      } else if (!this.open()) {
        this.initializedForOpen = false;
      }
    });
    this.destroyRef.onDestroy(() => {
      this.releasePageImage();
      this.releasePreview();
    });
  }

  choosePdfMode(): void {
    this.fileError.set(null);
  }

  handleFile(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    const file = inputElement.files?.[0];
    this.fileError.set(null);
    this.selectedFile = null;
    this.fileName.set(null);
    this.fileSize.set(null);
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLocaleLowerCase().endsWith('.pdf')) {
      this.fileError.set('Format non pris en charge. Sélectionnez un fichier PDF.');
      inputElement.value = '';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.fileError.set('Ce PDF dépasse la taille maximale autorisée de 10 Mo.');
      inputElement.value = '';
      return;
    }
    this.selectedFile = file;
    this.fileName.set(file.name);
    this.fileSize.set(formatFileSize(file.size));
  }

  updateName(event: Event): void {
    this.templateName.set((event.target as HTMLInputElement).value);
  }

  goBack(): void {
    if (!this.canGoBack()) return;
    const current = this.step();
    if (current > 1) this.step.set((current - 1) as 1 | 2 | 3 | 4);
  }

  continue(): void {
    if (!this.canContinue()) return;
    switch (this.step()) {
      case 1:
        this.step.set(2);
        break;
      case 2:
        this.step.set(3);
        break;
      case 3:
        this.ensureDraft();
        break;
      case 4:
        this.saveDraftAndPreview();
        break;
      default:
        break;
    }
  }

  addField(key: string): void {
    const definition = this.catalog().find((field) => field.key === key);
    if (!definition) return;
    const existing = this.fields().find((field) => field.fieldKey === key);
    if (existing) {
      this.goToPage(existing.pageNumber);
      this.selectedFieldId.set(existing.id);
      return;
    }
    const field: EditorField = {
      id: `local-${key}-${this.localFieldSequence++}`,
      fieldKey: definition.key,
      label: definition.label,
      valueSource: definition.valueSource,
      fieldType: definition.fieldType,
      required: definition.required,
      pageNumber: this.currentPage(),
      x: definition.defaultXPercent,
      y: definition.defaultYPercent,
      width: definition.defaultWidthPercent,
      height: definition.defaultHeightPercent,
      fontFamily: 'HELVETICA',
      fontSize: definition.defaultFontSize,
      alignment: 'left',
      formatPattern: definition.formatPattern,
      sampleValue: definition.sampleValue,
      detectionSource: 'MANUAL',
      confidence: null,
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
    const field = this.fields().find((item) => item.id === selected);
    if (!field || field.required) return;
    this.fields.update((fields) => fields.filter((item) => item.id !== selected));
    this.selectedFieldId.set(this.pageFields()[0]?.id ?? null);
  }

  resetFields(): void {
    const template = this.createdTemplate();
    if (template) {
      this.fields.set(template.fields.map((field) => this.toEditorField(field)));
      this.goToPage(1);
    } else {
      this.fields.set([]);
      this.currentPage.set(1);
    }
    this.selectedFieldId.set(this.pageFields()[0]?.id ?? null);
  }

  updateSelected(patch: Partial<EditorField>): void {
    const selected = this.selectedFieldId();
    if (!selected) return;
    this.fields.update((fields) =>
      fields.map((field) =>
        field.id === selected
          ? { ...field, ...patch, detectionSource: 'MANUAL', confidence: null }
          : field,
      ),
    );
  }

  updateNumber(property: 'x' | 'y' | 'width' | 'height' | 'fontSize', event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (!Number.isFinite(value)) return;
    this.updateSelected({ [property]: value });
  }

  setAlignment(alignment: 'left' | 'center' | 'right'): void {
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

  onFieldKeydown(event: KeyboardEvent, field: EditorField): void {
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

  startPointerOperation(event: PointerEvent, field: EditorField, mode: 'move' | 'resize'): void {
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

  changePage(delta: number): void {
    this.goToPage(this.currentPage() + delta);
  }

  goToPage(pageNumber: number): void {
    const target = Math.max(1, Math.min(this.pageCount(), pageNumber));
    if (target === this.currentPage()) return;
    this.currentPage.set(target);
    this.selectedFieldId.set(this.pageFields()[0]?.id ?? null);
    const template = this.createdTemplate();
    if (template) this.loadPageImage(template);
  }

  detectionSourceLabel(field: EditorField): string | null {
    if (!field.detectionSource) return null;
    return DOCUMENT_FIELD_DETECTION_SOURCE_LABELS[field.detectionSource];
  }

  confidencePercent(field: EditorField): number | null {
    return field.confidence === null ? null : Math.round(field.confidence * 100);
  }

  /** QR code and signature zones hold no typed text: no font, alignment or format settings. */
  isGraphic(field: Pick<EditorField, 'fieldType'>): boolean {
    return isGraphicFieldType(field.fieldType);
  }

  graphicDescription(field: Pick<EditorField, 'fieldType'>): string | null {
    if (field.fieldType === 'QR_CODE') {
      return 'Le QR code de vérification est ajouté automatiquement à la signature du document.';
    }
    if (field.fieldType === 'SIGNATURE_AREA') {
      return 'Zone laissée libre pour votre signature et votre cachet. Rien n’y est imprimé.';
    }
    return null;
  }

  fieldKind(field: EditorField): string {
    if (field.fieldType === 'QR_CODE') return 'qr';
    if (field.fieldType === 'SIGNATURE_AREA') return 'signature';
    if (field.fieldType === 'DATE') return 'date';
    if (field.valueSource === 'AUTOMATIC') return 'verification';
    if (field.fieldKey.startsWith('patient')) return 'patient';
    return 'clinical';
  }

  finish(): void {
    const template = this.createdTemplate();
    if (!template || this.saving()) return;
    this.saveError.set(null);
    this.saving.set(true);
    this.api
      .saveDraft(template.id, this.draftRequest(), template.revision)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
        next: (saved) => {
          this.api
            .activate(saved.id, this.makeDefault(), saved.revision)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (activated) => {
                this.completed.emit({
                  id: activated.id,
                  name: activated.name,
                  status: activated.status,
                  isDefault: activated.isDefault,
                });
              },
              error: (error: unknown) =>
                this.saveError.set(
                  `Le modèle est enregistré en brouillon mais n’a pas pu être activé. ${documentTemplateErrorMessage(
                    error,
                    'Vérifiez les champs obligatoires.',
                  )}`,
                ),
            });
        },
        error: (error: unknown) =>
          this.saveError.set(
            documentTemplateErrorMessage(
              error,
              'Impossible d’enregistrer le modèle. Vérifiez votre connexion puis réessayez.',
            ),
          ),
      });
  }

  retryPageImage(): void {
    const template = this.createdTemplate();
    if (template) this.loadPageImage(template);
  }

  onPageImageLoad(event: Event): void {
    const image = event.target as HTMLImageElement;
    if (image.naturalWidth > 0 && image.naturalHeight > 0) {
      this.pageImageAspect.set(`${image.naturalWidth} / ${image.naturalHeight}`);
    }
  }

  loadPreviewForCurrent(): void {
    const template = this.createdTemplate();
    if (template) this.loadPreview(template);
  }

  private initialize(): void {
    this.releasePreview();
    const existing = this.template();
    this.saveError.set(null);
    this.previewError.set(null);
    this.fileError.set(null);
    this.selectedFieldId.set(null);
    this.currentPage.set(1);
    this.zoom.set(100);
    if (existing) {
      this.createdTemplate.set(existing);
      this.templateName.set(existing.name);
      this.makeDefault.set(existing.isDefault);
      this.fileName.set(existing.currentVersion.originalFilename);
      this.fileSize.set(formatFileSize(existing.currentVersion.sizeBytes));
      this.detectionWarnings.set(existing.warnings);
      this.unresolvedKeys.set(existing.unresolvedKeys);
      const fields = existing.fields.map((field) => this.toEditorField(field));
      this.fields.set(fields);
      this.selectedFieldId.set(this.pageFields()[0]?.id ?? null);
      this.step.set(this.initialStep());
      this.loadPageImage(existing);
      return;
    }
    this.createdTemplate.set(null);
    this.selectedFile = null;
    this.fileName.set(null);
    this.fileSize.set(null);
    this.templateName.set(DOCUMENT_TEMPLATE_TYPE_LABEL);
    this.makeDefault.set(false);
    this.fields.set([]);
    this.detectionWarnings.set([]);
    this.unresolvedKeys.set([]);
    this.releasePageImage();
    this.step.set(this.initialStep());
  }

  private ensureDraft(): void {
    const existing = this.createdTemplate();
    if (existing) {
      this.step.set(4);
      return;
    }
    const file = this.selectedFile;
    if (!file) {
      this.fileError.set('Sélectionnez un fichier PDF avant de continuer.');
      return;
    }
    this.saving.set(true);
    this.saveError.set(null);
    this.api
      .create(file, this.templateName().trim())
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
        next: (template) => {
          this.createdTemplate.set(template);
          this.detectionWarnings.set(template.warnings);
          this.unresolvedKeys.set(template.unresolvedKeys);
          this.currentPage.set(1);
          const fields = template.fields.map((field) => this.toEditorField(field));
          this.fields.set(fields);
          this.selectedFieldId.set(this.pageFields()[0]?.id ?? null);
          this.loadPageImage(template);
          this.step.set(4);
        },
        error: (error: unknown) =>
          this.saveError.set(
            documentTemplateErrorMessage(
              error,
              'Le PDF n’a pas pu être importé. Vérifiez qu’il s’agit bien d’un PDF valide de moins de 10 Mo.',
            ),
          ),
      });
  }

  private saveDraftAndPreview(): void {
    const template = this.createdTemplate();
    if (!template) return;
    if (this.requiredMissing().length > 0) {
      this.saveError.set(`Champs obligatoires manquants : ${this.requiredMissing().join(', ')}.`);
      return;
    }
    this.saving.set(true);
    this.saveError.set(null);
    this.api
      .saveDraft(template.id, this.draftRequest(), template.revision)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
        next: (saved) => {
          this.createdTemplate.set(saved);
          this.detectionWarnings.set(saved.warnings);
          this.unresolvedKeys.set(saved.unresolvedKeys);
          this.step.set(5);
          this.loadPreview(saved);
        },
        error: (error: unknown) =>
          this.saveError.set(
            documentTemplateErrorMessage(
              error,
              'Les champs n’ont pas pu être enregistrés. Vérifiez les positions puis réessayez.',
            ),
          ),
      });
  }

  private loadPreview(template: DocumentTemplate): void {
    this.releasePreview();
    this.previewLoading.set(true);
    this.previewError.set(null);
    const values = this.sampleValues();
    const request: DocumentTemplatePreviewRequest = {
      fields: this.fieldInputs(),
      values,
    };
    this.api
      .preview(template.id, request)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.previewLoading.set(false)),
      )
      .subscribe({
        next: (blob) => {
          this.previewObjectUrl = URL.createObjectURL(blob);
          this.previewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.previewObjectUrl));
        },
        error: (error: unknown) =>
          this.previewError.set(
            documentTemplateErrorMessage(error, 'L’aperçu du document n’a pas pu être généré.'),
          ),
      });
  }

  private loadPageImage(template: DocumentTemplate): void {
    this.releasePageImage();
    this.pageImageError.set(false);
    this.pageImageLoading.set(true);
    this.api
      .pageImage(template.id, template.currentVersion.id, this.currentPage())
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.pageImageLoading.set(false)),
      )
      .subscribe({
        next: (blob) => {
          this.pageObjectUrl = URL.createObjectURL(blob);
          this.pageImageUrl.set(this.pageObjectUrl);
        },
        error: () => this.pageImageError.set(true),
      });
  }

  private releasePageImage(): void {
    if (this.pageObjectUrl) URL.revokeObjectURL(this.pageObjectUrl);
    this.pageObjectUrl = null;
    this.pageImageUrl.set(null);
    this.pageImageAspect.set(null);
  }

  private releasePreview(): void {
    if (this.previewObjectUrl) URL.revokeObjectURL(this.previewObjectUrl);
    this.previewObjectUrl = null;
    this.previewUrl.set(null);
  }

  private draftRequest(): SaveDocumentTemplateDraftRequest {
    return {
      name: this.templateName().trim(),
      makeDefault: this.makeDefault(),
      fields: this.fieldInputs(),
    };
  }

  private fieldInputs(): readonly DocumentFieldInput[] {
    return this.fields().map((field) => ({
      fieldKey: field.fieldKey,
      label: field.label,
      valueSource: field.valueSource,
      fieldType: field.fieldType,
      required: field.required,
      pageNumber: field.pageNumber,
      xPercent: Number(field.x.toFixed(2)),
      yPercent: Number(field.y.toFixed(2)),
      widthPercent: Number(field.width.toFixed(2)),
      heightPercent: Number(field.height.toFixed(2)),
      fontFamily: field.fontFamily,
      fontSize: field.fontSize,
      alignment: field.alignment.toUpperCase() as DocumentFieldInput['alignment'],
      formatPattern: field.formatPattern,
      sampleValue: field.sampleValue,
      detectionSource: field.detectionSource,
      confidence: field.confidence,
    }));
  }

  private sampleValues(): Readonly<Record<string, string>> {
    const values: Record<string, string> = {};
    for (const definition of this.catalog()) {
      if (this.fields().some((field) => field.fieldKey === definition.key)) {
        values[definition.key] = definition.sampleValue;
      }
    }
    return values;
  }

  private toEditorField(field: DocumentTemplateField): EditorField {
    return {
      id: field.id,
      fieldKey: field.fieldKey,
      label: field.label,
      valueSource: field.valueSource,
      fieldType: field.fieldType,
      required: field.required,
      pageNumber: field.pageNumber,
      x: field.xPercent,
      y: field.yPercent,
      width: field.widthPercent,
      height: field.heightPercent,
      fontFamily: field.fontFamily,
      fontSize: field.fontSize,
      alignment: field.alignment.toLocaleLowerCase() as EditorField['alignment'],
      formatPattern: field.formatPattern,
      sampleValue: field.sampleValue,
      detectionSource: field.detectionSource,
      confidence: field.confidence,
    };
  }
}
