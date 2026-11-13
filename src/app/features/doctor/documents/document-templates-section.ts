import { CdkMenuModule } from '@angular/cdk/menu';
import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { Observable, forkJoin } from 'rxjs';

import {
  OcButton,
  OcConfirmDialog,
  OcEmptyState,
  OcIcon,
  OcSkeleton,
  OcStatusBadge,
  OcTabs,
} from '../../../shared/ui';
import { DocumentTemplateApiService } from './document-template-api.service';
import {
  DOCUMENT_TEMPLATE_STATUS_LABELS,
  DOCUMENT_TEMPLATE_TYPE_LABEL,
  DocumentFieldDefinition,
  DocumentTemplate,
  DocumentTemplateField,
  DocumentTemplateStatus,
  detectionWarningLabel,
  formatFileSize,
  missingRequiredFieldLabels,
} from './document-template-api.models';
import {
  DocumentTemplateEditorWizard,
  TemplateWizardResult,
} from './document-template-editor-wizard';
import { documentTemplateErrorMessage } from './document-template-errors';

type PageState = 'ready' | 'loading' | 'error' | 'empty';
type ConfirmationAction =
  | { readonly kind: 'deactivate'; readonly templateId: string }
  | { readonly kind: 'delete'; readonly templateId: string };

@Component({
  selector: 'app-document-templates-section',
  imports: [
    CdkMenuModule,
    NzIconModule,
    OcButton,
    OcConfirmDialog,
    OcEmptyState,
    OcIcon,
    OcSkeleton,
    OcStatusBadge,
    OcTabs,
    DocumentTemplateEditorWizard,
  ],
  templateUrl: './document-templates-section.html',
  styleUrls: [
    './documents-page.static-demo.scss',
    './documents-page.static-demo.responsive.scss',
    './document-templates-section.scss',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentTemplatesSection {
  private readonly api = inject(DocumentTemplateApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);

  readonly pageState = signal<PageState>('loading');
  readonly templates = signal<readonly DocumentTemplate[]>([]);
  readonly fieldCatalog = signal<readonly DocumentFieldDefinition[]>([]);
  readonly selectedTemplateId = signal<string | null>(null);
  readonly previewTab = signal('preview');
  readonly previewTabs = [
    { id: 'preview', label: 'Aperçu', icon: 'file-text' },
    { id: 'fields', label: 'Champs', icon: 'unordered-list' },
  ];
  readonly previewFullscreen = signal(false);
  readonly previewPage = signal(1);
  readonly pageImageUrl = signal<string | null>(null);
  readonly pageImageLoading = signal(false);
  readonly pageImageError = signal(false);
  readonly statusMessage = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly busyTemplateId = signal<string | null>(null);
  readonly confirmationOpen = signal(false);
  readonly confirmationAction = signal<ConfirmationAction | null>(null);
  readonly wizardOpen = signal(false);
  readonly wizardInitialStep = signal<1 | 2 | 3 | 4 | 5>(1);
  readonly wizardTemplate = signal<DocumentTemplate | null>(null);
  private readonly versionTarget = signal<DocumentTemplate | null>(null);
  private currentObjectUrl: string | null = null;

  readonly selectedTemplate = computed(() =>
    this.templates().find((template) => template.id === this.selectedTemplateId()),
  );
  readonly previewPageCount = computed(
    () => this.selectedTemplate()?.currentVersion.pageCount ?? 1,
  );
  readonly previewFields = computed(() =>
    (this.selectedTemplate()?.fields ?? []).filter(
      (field) => field.pageNumber === this.previewPage(),
    ),
  );
  readonly detectionNotices = computed(() => {
    const template = this.selectedTemplate();
    const notices = (template?.warnings ?? [])
      .filter((token) => !token.startsWith('detection.unresolvedRequired:'))
      .filter((token) => {
        if (!token.startsWith('detection.lowConfidence:')) return true;
        const key = token.slice('detection.lowConfidence:'.length);
        const field = template?.fields.find((candidate) => candidate.fieldKey === key);
        return field !== undefined && field.detectionSource !== 'MANUAL';
      })
      .map((token) => detectionWarningLabel(token));
    return [...new Set(notices)];
  });
  readonly unresolvedLabels = computed(() => {
    const labels = new Map(this.fieldCatalog().map((field) => [field.key, field.label]));
    const template = this.selectedTemplate();
    const present = new Set((template?.fields ?? []).map((field) => field.fieldKey));
    return (template?.unresolvedKeys ?? [])
      .filter((key) => !present.has(key))
      .map((key) => labels.get(key) ?? key);
  });
  readonly missingRequiredLabels = computed(() =>
    missingRequiredFieldLabels(this.fieldCatalog(), this.selectedTemplate()?.fields ?? []),
  );
  readonly confirmationTitle = computed(() =>
    this.confirmationAction()?.kind === 'delete'
      ? 'Supprimer ce modèle ?'
      : 'Désactiver ce modèle ?',
  );
  readonly confirmationMessage = computed(() =>
    this.confirmationAction()?.kind === 'delete'
      ? 'Le brouillon et son PDF source seront supprimés définitivement.'
      : 'Le modèle ne sera plus proposé pendant les consultations. Ses versions historiques restent conservées.',
  );
  readonly confirmationLabel = computed(() =>
    this.confirmationAction()?.kind === 'delete' ? 'Supprimer' : 'Désactiver',
  );

  readonly statusLabels = DOCUMENT_TEMPLATE_STATUS_LABELS;
  readonly typeLabel = DOCUMENT_TEMPLATE_TYPE_LABEL;
  readonly formatFileSize = formatFileSize;

  constructor() {
    this.load();
    this.destroyRef.onDestroy(() => this.releasePageImage());
  }

  load(): void {
    this.pageState.set('loading');
    this.actionError.set(null);
    forkJoin({
      templates: this.api.list(),
      catalog: this.api.fieldCatalog(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ templates, catalog }) => {
          this.fieldCatalog.set(catalog);
          this.templates.set(templates);
          const selected =
            templates.find((template) => template.id === this.selectedTemplateId()) ??
            templates[0] ??
            null;
          this.selectedTemplateId.set(selected?.id ?? null);
          this.previewPage.set(1);
          this.pageState.set(templates.length === 0 ? 'empty' : 'ready');
          if (selected) this.loadPageImage(selected);
        },
        error: () => {
          this.pageState.set('error');
        },
      });
  }

  selectTemplate(id: string): void {
    if (this.selectedTemplateId() === id) return;
    this.selectedTemplateId.set(id);
    this.previewTab.set('preview');
    this.previewFullscreen.set(false);
    this.previewPage.set(1);
    const template = this.templates().find((item) => item.id === id);
    if (template) this.loadPageImage(template);
  }

  selectTemplateFromEvent(event: Event): void {
    this.selectTemplate((event.target as HTMLSelectElement).value);
  }

  openWizard(step: 1 | 2 | 3 | 4 | 5 = 1, template: DocumentTemplate | null = null): void {
    this.wizardTemplate.set(template);
    this.wizardInitialStep.set(template ? 4 : step);
    this.wizardOpen.set(true);
  }

  closeWizard(): void {
    this.wizardOpen.set(false);
    this.wizardTemplate.set(null);
  }

  onWizardCompleted(result: TemplateWizardResult): void {
    this.wizardOpen.set(false);
    this.wizardTemplate.set(null);
    this.statusMessage.set(
      result.status === 'ACTIVE'
        ? `Le modèle « ${result.name} » est actif${result.isDefault ? ' et défini par défaut' : ''}.`
        : `Le modèle « ${result.name} » a été enregistré.`,
    );
    this.selectedTemplateId.set(result.id);
    this.load();
  }

  setDefault(template: DocumentTemplate): void {
    if (this.busyTemplateId()) return;
    this.actionError.set(null);
    this.busyTemplateId.set(template.id);
    this.api
      .setDefault(template.id, template.revision)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busyTemplateId.set(null);
          this.statusMessage.set(`« ${template.name} » est maintenant le modèle par défaut.`);
          this.load();
        },
        error: (error: unknown) => {
          this.busyTemplateId.set(null);
          this.actionError.set(
            documentTemplateErrorMessage(error, 'Le modèle par défaut n’a pas pu être modifié.'),
          );
        },
      });
  }

  activate(template: DocumentTemplate): void {
    if (this.busyTemplateId()) return;
    this.actionError.set(null);
    this.busyTemplateId.set(template.id);
    this.api
      .activate(template.id, template.isDefault, template.revision)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.busyTemplateId.set(null);
          this.statusMessage.set(`Le modèle « ${updated.name} » est maintenant actif.`);
          this.load();
        },
        error: (error: unknown) => {
          this.busyTemplateId.set(null);
          this.actionError.set(
            documentTemplateErrorMessage(
              error,
              'Le modèle ne peut pas être activé. Vérifiez que les champs obligatoires sont placés.',
            ),
          );
        },
      });
  }

  requestDeactivate(template: DocumentTemplate): void {
    this.confirmationAction.set({ kind: 'deactivate', templateId: template.id });
    this.confirmationOpen.set(true);
  }

  requestDelete(template: DocumentTemplate): void {
    this.confirmationAction.set({ kind: 'delete', templateId: template.id });
    this.confirmationOpen.set(true);
  }

  confirmAction(): void {
    const action = this.confirmationAction();
    if (!action || this.busyTemplateId()) return;
    const template = this.templates().find((item) => item.id === action.templateId);
    if (!template) return;
    this.busyTemplateId.set(template.id);
    this.actionError.set(null);
    const request: Observable<unknown> =
      action.kind === 'delete'
        ? this.api.delete(template.id, template.revision)
        : this.api.deactivate(template.id, template.revision);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.busyTemplateId.set(null);
        this.confirmationOpen.set(false);
        this.confirmationAction.set(null);
        this.statusMessage.set(
          action.kind === 'delete'
            ? 'Le modèle a été supprimé.'
            : 'Le modèle a été désactivé. Ses versions historiques sont conservées.',
        );
        this.load();
      },
      error: (error: unknown) => {
        this.busyTemplateId.set(null);
        this.confirmationOpen.set(false);
        this.confirmationAction.set(null);
        this.actionError.set(
          documentTemplateErrorMessage(error, 'Cette action n’a pas pu être effectuée.'),
        );
      },
    });
  }

  requestNewVersion(template: DocumentTemplate): void {
    this.versionTarget.set(template);
    const input = this.document.querySelector<HTMLInputElement>('#document-version-input');
    if (input) {
      input.value = '';
      input.click();
    }
  }

  onVersionFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    const template = this.versionTarget();
    if (!file || !template) return;
    const error = this.validatePdf(file);
    if (error) {
      this.actionError.set(error);
      input.value = '';
      return;
    }
    this.busyTemplateId.set(template.id);
    this.actionError.set(null);
    this.api
      .createVersion(template.id, file, template.revision)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.busyTemplateId.set(null);
          this.versionTarget.set(null);
          input.value = '';
          this.statusMessage.set(
            'Le nouveau PDF a été ajouté comme version en brouillon. Vérifiez la position des champs.',
          );
          this.openWizard(4, updated);
        },
        error: (error: unknown) => {
          this.busyTemplateId.set(null);
          input.value = '';
          this.actionError.set(
            documentTemplateErrorMessage(error, 'Le nouveau PDF n’a pas pu être importé.'),
          );
        },
      });
  }

  downloadPdf(template: DocumentTemplate): void {
    this.api
      .source(template.id, template.currentVersion.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const anchor = this.document.createElement('a');
          anchor.href = url;
          anchor.download = template.currentVersion.originalFilename;
          this.document.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
          setTimeout(() => URL.revokeObjectURL(url), 0);
        },
        error: (error: unknown) =>
          this.actionError.set(
            documentTemplateErrorMessage(error, 'Le PDF source n’a pas pu être téléchargé.'),
          ),
      });
  }

  statusBadge(status: DocumentTemplateStatus): 'confirmed' | 'draft' | 'cancelled' {
    if (status === 'ACTIVE') return 'confirmed';
    if (status === 'DRAFT') return 'draft';
    return 'cancelled';
  }

  fieldKind(field: DocumentTemplateField): string {
    if (field.fieldType === 'QR_CODE') return 'verification';
    if (field.fieldType === 'SIGNATURE_AREA') return 'signature';
    if (field.fieldType === 'DATE') return 'date';
    if (field.valueSource === 'AUTOMATIC') return 'verification';
    if (field.fieldKey.startsWith('patient')) return 'patient';
    return 'clinical';
  }

  requiredKeys(): ReadonlySet<string> {
    return new Set(
      this.fieldCatalog()
        .filter((field) => field.required)
        .map((field) => field.key),
    );
  }

  isRequired(field: DocumentTemplateField): boolean {
    return field.required || this.requiredKeys().has(field.fieldKey);
  }

  dismissStatus(): void {
    this.statusMessage.set(null);
  }

  dismissActionError(): void {
    this.actionError.set(null);
  }

  retry(): void {
    this.load();
  }

  retryPageImage(): void {
    const template = this.selectedTemplate();
    if (template) this.loadPageImage(template);
  }

  changePreviewPage(delta: number): void {
    const target = Math.max(1, Math.min(this.previewPageCount(), this.previewPage() + delta));
    if (target === this.previewPage()) return;
    this.previewPage.set(target);
    const template = this.selectedTemplate();
    if (template) this.loadPageImage(template);
  }

  private loadPageImage(template: DocumentTemplate): void {
    this.releasePageImage();
    this.pageImageError.set(false);
    this.pageImageLoading.set(true);
    const versionId = template.currentVersion.id;
    const pageNumber = this.previewPage();
    this.api
      .pageImage(template.id, versionId, pageNumber)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          if (
            this.selectedTemplateId() !== template.id ||
            this.previewPage() !== pageNumber
          ) {
            return;
          }
          this.currentObjectUrl = URL.createObjectURL(blob);
          this.pageImageUrl.set(this.currentObjectUrl);
          this.pageImageLoading.set(false);
        },
        error: () => {
          if (
            this.selectedTemplateId() !== template.id ||
            this.previewPage() !== pageNumber
          ) {
            return;
          }
          this.pageImageLoading.set(false);
          this.pageImageError.set(true);
        },
      });
  }

  private releasePageImage(): void {
    if (this.currentObjectUrl) URL.revokeObjectURL(this.currentObjectUrl);
    this.currentObjectUrl = null;
    this.pageImageUrl.set(null);
  }

  private validatePdf(file: File): string | null {
    if (file.type !== 'application/pdf' && !file.name.toLocaleLowerCase().endsWith('.pdf')) {
      return 'Format non pris en charge. Sélectionnez un fichier PDF.';
    }
    if (file.size > 10 * 1024 * 1024) {
      return 'Ce fichier dépasse la limite de 10 Mo.';
    }
    return null;
  }
}
