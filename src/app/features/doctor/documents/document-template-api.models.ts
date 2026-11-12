export type DocumentTemplateStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE';
export type DocumentFieldAlignment = 'LEFT' | 'CENTER' | 'RIGHT';
export type DocumentFieldValueSource = 'MANUAL' | 'CALCULATED' | 'AUTOMATIC';
export type DocumentFieldType = 'TEXT' | 'DATE' | 'NUMBER' | 'QR_CODE' | 'SIGNATURE_AREA';
export type DocumentFieldDetectionSource = 'ACROFORM' | 'TEXT' | 'MANUAL';

export interface DocumentTemplateVersion {
  readonly id: string;
  readonly versionNumber: number;
  readonly originalFilename: string;
  readonly sizeBytes: number;
  readonly pageCount: number;
  readonly sha256: string;
  readonly createdAt: string;
}

export interface DocumentTemplateField {
  readonly id: string;
  readonly fieldKey: string;
  readonly label: string;
  readonly valueSource: DocumentFieldValueSource;
  readonly fieldType: DocumentFieldType;
  readonly required: boolean;
  readonly pageNumber: number;
  readonly xPercent: number;
  readonly yPercent: number;
  readonly widthPercent: number;
  readonly heightPercent: number;
  readonly fontFamily: string;
  readonly fontSize: number;
  readonly alignment: DocumentFieldAlignment;
  readonly formatPattern: string | null;
  readonly sampleValue: string | null;
  readonly displayOrder: number;
  readonly detectionSource: DocumentFieldDetectionSource | null;
  readonly confidence: number | null;
}

export interface DocumentTemplate {
  readonly id: string;
  readonly name: string;
  readonly type: 'SICK_LEAVE';
  readonly status: DocumentTemplateStatus;
  readonly isDefault: boolean;
  readonly currentVersionNumber: number;
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly currentVersion: DocumentTemplateVersion;
  readonly fields: readonly DocumentTemplateField[];
  readonly warnings: readonly string[];
  readonly unresolvedKeys: readonly string[];
}

export interface DocumentFieldDefinition {
  readonly key: string;
  readonly label: string;
  readonly valueSource: DocumentFieldValueSource;
  readonly fieldType: DocumentFieldType;
  readonly required: boolean;
  readonly formatPattern: string | null;
  readonly sampleValue: string;
  readonly defaultXPercent: number;
  readonly defaultYPercent: number;
  readonly defaultWidthPercent: number;
  readonly defaultHeightPercent: number;
  readonly defaultFontSize: number;
}

export interface DocumentFieldInput {
  readonly fieldKey: string;
  readonly label: string;
  readonly valueSource: DocumentFieldValueSource;
  readonly fieldType: DocumentFieldType;
  readonly required: boolean;
  readonly pageNumber: number;
  readonly xPercent: number;
  readonly yPercent: number;
  readonly widthPercent: number;
  readonly heightPercent: number;
  readonly fontFamily: string;
  readonly fontSize: number;
  readonly alignment: DocumentFieldAlignment;
  readonly formatPattern: string | null;
  readonly sampleValue: string | null;
  readonly detectionSource?: DocumentFieldDetectionSource | null;
  readonly confidence?: number | null;
}

export interface SaveDocumentTemplateDraftRequest {
  readonly name: string;
  readonly makeDefault: boolean;
  readonly fields: readonly DocumentFieldInput[];
}

export interface DocumentTemplatePreviewRequest {
  readonly fields: readonly DocumentFieldInput[];
  readonly values: Readonly<Record<string, string>>;
}

export const DOCUMENT_TEMPLATE_TYPE_LABEL = 'Arrêt maladie';

/**
 * Zones that hold no typed text: the verification QR code (drawn at signature) and the space left
 * for the handwritten signature / stamp. They have no font, alignment or format settings.
 */
export function isGraphicFieldType(fieldType: DocumentFieldType): boolean {
  return fieldType === 'QR_CODE' || fieldType === 'SIGNATURE_AREA';
}

export const DOCUMENT_TEMPLATE_STATUS_LABELS: Readonly<Record<DocumentTemplateStatus, string>> = {
  ACTIVE: 'Actif',
  DRAFT: 'Brouillon',
  INACTIVE: 'Inactif',
};

export const DOCUMENT_FIELD_DETECTION_SOURCE_LABELS: Readonly<
  Record<DocumentFieldDetectionSource, string>
> = {
  ACROFORM: 'Champ PDF détecté',
  TEXT: 'Libellé détecté',
  MANUAL: 'Positionné manuellement',
};

export function detectionWarningLabel(token: string): string {
  if (token === 'text.unavailable') {
    return 'Ce PDF ne contient pas de texte sélectionnable. Positionnez les champs manuellement.';
  }
  if (token === 'detection.pagesTruncated') {
    return 'Seules les 20 premières pages ont été analysées. Positionnez les champs des pages suivantes manuellement.';
  }
  if (token.startsWith('text.extractionFailed:')) {
    const page = token.slice('text.extractionFailed:'.length);
    return `Le texte de la page ${page} n’a pas pu être lu. Positionnez ses champs manuellement.`;
  }
  if (token.startsWith('text.truncated:')) {
    const page = token.slice('text.truncated:'.length);
    return `Le texte de la page ${page} est trop volumineux pour être analysé. Positionnez ses champs manuellement.`;
  }
  if (token.startsWith('detection.lowConfidence:')) {
    return 'Certaines zones ont été détectées avec une confiance faible. Vérifiez leur position.';
  }
  if (token.startsWith('detection.unresolvedRequired:')) {
    return 'Certains champs obligatoires n’ont pas été détectés. Ajoutez-les manuellement.';
  }
  if (token === 'acroform.unreadable') {
    return 'Les champs interactifs du PDF n’ont pas pu être analysés. Vérifiez les zones proposées.';
  }
  if (token === 'detection.failed') {
    return 'La détection automatique n’a pas pu aboutir. Positionnez les champs manuellement.';
  }
  return 'La détection automatique des champs a signalé une anomalie. Vérifiez les positions.';
}

export function missingRequiredFieldLabels(
  catalog: readonly DocumentFieldDefinition[],
  fields: readonly { readonly fieldKey: string }[],
): readonly string[] {
  const present = new Set(fields.map((field) => field.fieldKey));
  const missing = catalog
    .filter((field) => field.required && !present.has(field.key))
    .map((field) => field.label);
  const hasDateRange = present.has('leaveStartDate') && present.has('leaveEndDate');
  const hasDuration = present.has('leaveDurationDays');
  if (!hasDateRange && !hasDuration) {
    missing.push('Dates de début et de fin de l’arrêt, ou durée de l’arrêt');
  }
  return missing;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) return `${Math.max(1, Math.round(kilobytes))} Ko`;
  return `${(kilobytes / 1024).toFixed(1)} Mo`;
}
