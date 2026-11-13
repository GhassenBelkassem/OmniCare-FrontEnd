import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import type { ArtifactType } from '../artifact.models';
import type { DocumentTemplate } from '../documents/document-template-api.models';
import { DocumentTemplateApiService } from '../documents/document-template-api.service';

export interface SickLeaveTemplateOption {
  readonly id: string;
  readonly label: string;
  readonly isDefault: boolean;
  /** Zones placed on the template's current version (catalog keys). */
  readonly fieldKeys?: readonly string[];
}

/** The doctor's ACTIVE « Arrêt de travail » templates, in list order, default first. */
export function sickLeaveTemplateOptions(
  templates: readonly DocumentTemplate[],
): readonly SickLeaveTemplateOption[] {
  return templates
    .filter((template) => template.type === 'SICK_LEAVE' && template.status === 'ACTIVE')
    .map((template) => ({
      id: template.id,
      label: template.isDefault ? `${template.name} (par défaut)` : template.name,
      isDefault: template.isDefault,
      fieldKeys: (template.fields ?? []).map((field) => field.fieldKey),
    }))
    .sort((left, right) => Number(right.isDefault) - Number(left.isDefault));
}

/** Last choice of the list: no template, the standard MRS document (prints no names). */
export const STANDARD_TEMPLATE_ID = 'standard';
export const STANDARD_TEMPLATE_CHOICE: SickLeaveTemplateOption = {
  id: STANDARD_TEMPLATE_ID,
  label: 'Modèle standard',
  isDefault: false,
};

/** Preselection: the default template, else the only active one, else nothing. */
export function preselectedTemplateId(options: readonly SickLeaveTemplateOption[]): string | null {
  const preferred = options.find((option) => option.isDefault);
  if (preferred) return preferred.id;
  return options.length === 1 ? options[0].id : null;
}

/**
 * « Modèle » picker of the consultation's sick-leave certificate (G-1 D5). Provided by the
 * consultation page. A failed list only hides the picker: « Terminer » is never blocked by it, and
 * then no template is sent (the standard rendering is used).
 */
@Injectable()
export class SickLeaveTemplatePicker {
  private readonly api = inject(DocumentTemplateApiService);
  private readonly destroyRef = inject(DestroyRef);
  private requested = false;

  readonly options = signal<readonly SickLeaveTemplateOption[]>([]);
  readonly selectedId = signal<string | null>(null);
  readonly visible = computed(() => this.options().length > 0);
  /** Zones of the template that will be used for the arrêt de travail (none for the standard one). */
  readonly selectedFieldKeys = computed<ReadonlySet<string>>(() => {
    const selected = this.selectedId();
    const option = this.options().find((candidate) => candidate.id === selected);
    return new Set(option?.fieldKeys ?? []);
  });
  /** What the « Modèle » list shows: the doctor's templates, then « Modèle standard ». */
  readonly choices = computed<readonly SickLeaveTemplateOption[]>(() =>
    this.visible() ? [...this.options(), STANDARD_TEMPLATE_CHOICE] : [],
  );

  /** Loads the list once (later calls are ignored). */
  ensureLoaded(): void {
    if (this.requested) return;
    this.requested = true;
    this.load();
  }

  /** Re-reads the list, e.g. after the chosen template was refused at signature. */
  reload(): void {
    this.requested = true;
    this.load();
  }

  select(id: string | null): void {
    this.selectedId.set(id !== null && this.isChoice(id) ? id : null);
  }

  /** `templateId` to send when finalizing this document: only for the sick-leave certificate. */
  templateIdFor(type: ArtifactType): string | null {
    if (type !== 'SICK_LEAVE_CERTIFICATE' || !this.visible()) return null;
    const selected = this.selectedId();
    return selected !== null && this.options().some((option) => option.id === selected) ? selected : null;
  }

  private isChoice(id: string): boolean {
    return this.choices().some((option) => option.id === id);
  }

  private load(): void {
    this.api
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (templates) => {
          const options = sickLeaveTemplateOptions(Array.isArray(templates) ? templates : []);
          const current = this.selectedId();
          this.options.set(options);
          this.selectedId.set(
            current !== null && (current === STANDARD_TEMPLATE_ID || options.some((option) => option.id === current))
              ? current
              : preselectedTemplateId(options),
          );
        },
        error: () => {
          this.options.set([]);
          this.selectedId.set(null);
        },
      });
  }
}
