import { CdkMenuModule } from '@angular/cdk/menu';
import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NzIconModule } from 'ng-zorro-antd/icon';

import {
  OcButton,
  OcConfirmDialog,
  OcEmptyState,
  OcIcon,
  OcSkeleton,
  OcStatusBadge,
  OcTabs,
} from '../../../shared/ui';
import { DocumentPreview } from './document-preview';
import {
  DEFAULT_MAPPING_FIELDS,
  DEMO_PDFS,
  DEMO_TEMPLATES,
} from './document-template-demo.fixtures';
import {
  DOCUMENT_TYPE_LABELS,
  DocumentTemplate,
  DocumentTemplateStatus,
  MappingField,
  TEMPLATE_STATUS_LABELS,
  UploadedPdf,
} from './document-template.models';
import { DocumentTemplateWizard, TemplateCreatedEvent } from './document-template-wizard';

type PageState = 'ready' | 'loading' | 'error' | 'empty';
type ConfirmationAction =
  | { readonly kind: 'deactivate'; readonly templateId: string }
  | { readonly kind: 'delete-pdf'; readonly pdfId: string };

@Component({
  selector: 'app-documents-page',
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
    DocumentPreview,
    DocumentTemplateWizard,
  ],
  templateUrl: './documents-page.static-demo.html',
  styleUrls: ['./documents-page.static-demo.scss', './documents-page.static-demo.responsive.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentsPage {
  private readonly route = inject(ActivatedRoute);
  private readonly document = inject(DOCUMENT);

  readonly pageState = signal<PageState>(this.initialPageState());
  readonly templates = signal<readonly DocumentTemplate[]>(
    this.pageState() === 'empty' ? [] : DEMO_TEMPLATES,
  );
  readonly pdfs = signal<readonly UploadedPdf[]>(this.pageState() === 'empty' ? [] : DEMO_PDFS);
  readonly selectedTemplateId = signal(this.templates()[0]?.id ?? null);
  readonly previewTab = signal('preview');
  readonly previewTabs = [
    { id: 'preview', label: 'Aperçu', icon: 'file-text' },
    { id: 'fields', label: 'Champs', icon: 'unordered-list' },
  ];
  readonly wizardOpen = signal(this.route.snapshot.queryParamMap.get('flow') === 'create');
  readonly wizardInitialStep = signal(this.initialWizardStep());
  readonly forceSaveError = this.route.snapshot.queryParamMap.get('save') === 'error';
  readonly previewFullscreen = signal(false);
  readonly statusMessage = signal<string | null>(null);
  readonly uploadError = signal<string | null>(null);
  readonly pdfLoadError = signal(this.route.snapshot.queryParamMap.get('state') === 'pdf-error');
  readonly confirmationOpen = signal(false);
  readonly confirmationAction = signal<ConfirmationAction | null>(null);
  readonly replacementWarning = signal<string | null>(null);
  readonly mappingFields = signal<readonly MappingField[]>(DEFAULT_MAPPING_FIELDS);

  readonly selectedTemplate = computed(() =>
    this.templates().find((template) => template.id === this.selectedTemplateId()),
  );
  readonly confirmationTitle = computed(() =>
    this.confirmationAction()?.kind === 'delete-pdf'
      ? 'Supprimer ce PDF ?'
      : 'Désactiver ce modèle ?',
  );
  readonly confirmationMessage = computed(() =>
    this.confirmationAction()?.kind === 'delete-pdf'
      ? 'Ce PDF inutilisé sera retiré de votre bibliothèque. Cette action est définitive.'
      : 'Le modèle ne sera plus proposé pendant les consultations. Ses versions historiques resteront associées aux documents déjà générés.',
  );
  readonly confirmationLabel = computed(() =>
    this.confirmationAction()?.kind === 'delete-pdf' ? 'Supprimer' : 'Désactiver',
  );

  readonly typeLabels = DOCUMENT_TYPE_LABELS;
  readonly statusLabels = TEMPLATE_STATUS_LABELS;

  selectTemplate(id: string): void {
    this.selectedTemplateId.set(id);
    this.pdfLoadError.set(false);
  }

  selectTemplateFromEvent(event: Event): void {
    this.selectTemplate((event.target as HTMLSelectElement).value);
  }

  openWizard(step: 1 | 2 | 3 | 4 | 5 = 1): void {
    this.wizardInitialStep.set(step);
    this.wizardOpen.set(true);
  }

  closeWizard(): void {
    this.wizardOpen.set(false);
  }

  createTemplate(event: TemplateCreatedEvent): void {
    const id = `template-${Date.now()}`;
    const template: DocumentTemplate = {
      id,
      name: event.name,
      type: event.type,
      pdfId: event.pdf.id,
      pdfName: event.pdf.name,
      status: 'ACTIVE',
      isDefault: event.isDefault,
      version: 1,
    };
    this.templates.update((templates) => [
      ...(event.isDefault ? templates.map((item) => ({ ...item, isDefault: false })) : templates),
      template,
    ]);
    if (!this.pdfs().some((pdf) => pdf.id === event.pdf.id)) {
      this.pdfs.update((pdfs) => [...pdfs, { ...event.pdf, usedBy: 1 }]);
    }
    this.mappingFields.set(event.fields);
    this.selectedTemplateId.set(id);
    this.pageState.set('ready');
    this.wizardOpen.set(false);
    this.statusMessage.set(`Le modèle « ${event.name} » a été enregistré en version v1.`);
  }

  setDefault(templateId: string): void {
    this.templates.update((templates) =>
      templates.map((template) => ({ ...template, isDefault: template.id === templateId })),
    );
    const template = this.templates().find((item) => item.id === templateId);
    if (template)
      this.statusMessage.set(`« ${template.name} » est maintenant le modèle par défaut.`);
  }

  duplicateTemplate(templateId: string): void {
    const source = this.templates().find((template) => template.id === templateId);
    if (!source) return;
    const copy: DocumentTemplate = {
      ...source,
      id: `template-copy-${Date.now()}`,
      name: `${source.name} — copie`,
      status: 'DRAFT',
      isDefault: false,
      version: 1,
    };
    this.templates.update((templates) => [...templates, copy]);
    this.selectedTemplateId.set(copy.id);
    this.statusMessage.set('Une copie en brouillon a été créée.');
  }

  requestDeactivate(templateId: string): void {
    this.confirmationAction.set({ kind: 'deactivate', templateId });
    this.confirmationOpen.set(true);
  }

  requestDeletePdf(pdfId: string): void {
    const pdf = this.pdfs().find((item) => item.id === pdfId);
    if (!pdf || pdf.usedBy > 0) {
      this.statusMessage.set('Ce PDF est utilisé par un modèle et ne peut pas être supprimé.');
      return;
    }
    this.confirmationAction.set({ kind: 'delete-pdf', pdfId });
    this.confirmationOpen.set(true);
  }

  confirmAction(): void {
    const action = this.confirmationAction();
    if (!action) return;
    if (action.kind === 'deactivate') {
      this.templates.update((templates) =>
        templates.map((template) =>
          template.id === action.templateId
            ? { ...template, status: 'INACTIVE' as DocumentTemplateStatus, isDefault: false }
            : template,
        ),
      );
      this.statusMessage.set(
        'Le modèle a été désactivé. Ses versions historiques sont conservées.',
      );
    } else {
      this.pdfs.update((pdfs) => pdfs.filter((pdf) => pdf.id !== action.pdfId));
      this.statusMessage.set('Le PDF a été supprimé.');
    }
    this.confirmationOpen.set(false);
    this.confirmationAction.set(null);
  }

  uploadPdf(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    const file = inputElement.files?.[0];
    this.uploadError.set(null);
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLocaleLowerCase().endsWith('.pdf')) {
      this.uploadError.set('Format non pris en charge. Sélectionnez un fichier PDF.');
      inputElement.value = '';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.uploadError.set('Ce fichier dépasse la limite de 10 Mo.');
      inputElement.value = '';
      return;
    }
    const pdf: UploadedPdf = {
      id: `pdf-${Date.now()}`,
      name: file.name,
      sizeLabel: `${Math.max(1, Math.round(file.size / 1024))} Ko`,
      uploadedAt: '31 oct. 2026',
      usedBy: 0,
    };
    this.pdfs.update((pdfs) => [...pdfs, pdf]);
    this.pageState.set('ready');
    this.statusMessage.set(`Le PDF « ${file.name} » a été téléversé.`);
    inputElement.value = '';
  }

  replacePdf(event: Event, pdfId: string): void {
    const inputElement = event.target as HTMLInputElement;
    const file = inputElement.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLocaleLowerCase().endsWith('.pdf')) {
      this.uploadError.set('Le remplacement doit être un fichier PDF.');
      inputElement.value = '';
      return;
    }
    this.pdfs.update((pdfs) =>
      pdfs.map((pdf) =>
        pdf.id === pdfId
          ? {
              ...pdf,
              name: file.name,
              sizeLabel: `${Math.max(1, Math.round(file.size / 1024))} Ko`,
              uploadedAt: '31 oct. 2026',
            }
          : pdf,
      ),
    );
    this.replacementWarning.set(
      'Le nouveau PDF a été ajouté en nouvelle version. Vérifiez la position des champs avant de l’activer.',
    );
    inputElement.value = '';
  }

  retry(): void {
    this.pageState.set('ready');
  }

  notify(message: string): void {
    this.statusMessage.set(message);
  }

  downloadDemoPdf(pdf: UploadedPdf): void {
    const content = `%PDF-1.4\n% OmniCare static-demo document: ${pdf.name}\n%%EOF`;
    const url = URL.createObjectURL(new Blob([content], { type: 'application/pdf' }));
    const anchor = this.document.createElement('a');
    anchor.href = url;
    anchor.download = pdf.name;
    anchor.click();
    URL.revokeObjectURL(url);
    this.statusMessage.set(`Le téléchargement de « ${pdf.name} » a démarré.`);
  }

  statusBadge(status: DocumentTemplateStatus): 'confirmed' | 'draft' | 'cancelled' {
    if (status === 'ACTIVE') return 'confirmed';
    if (status === 'DRAFT') return 'draft';
    return 'cancelled';
  }

  private initialPageState(): PageState {
    const state = this.route.snapshot.queryParamMap.get('state');
    if (state === 'loading' || state === 'error' || state === 'empty') return state;
    return 'ready';
  }

  private initialWizardStep(): 1 | 2 | 3 | 4 | 5 {
    const step = Number(this.route.snapshot.queryParamMap.get('step'));
    return step >= 1 && step <= 5 ? (step as 1 | 2 | 3 | 4 | 5) : 1;
  }
}
