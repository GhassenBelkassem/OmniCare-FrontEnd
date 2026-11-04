export type DocumentTemplateType =
  'PRESCRIPTION' | 'MEDICAL_CERTIFICATE' | 'SICK_LEAVE' | 'OTHER_CERTIFICATE';

export type DocumentTemplateStatus = 'ACTIVE' | 'DRAFT' | 'INACTIVE';
export type MappingFieldKind = 'patient' | 'date' | 'clinical' | 'verification';
export type TextAlignment = 'left' | 'center' | 'right';

export interface UploadedPdf {
  readonly id: string;
  readonly name: string;
  readonly sizeLabel: string;
  readonly uploadedAt: string;
  readonly usedBy: number;
}

export interface DocumentTemplate {
  readonly id: string;
  readonly name: string;
  readonly type: DocumentTemplateType;
  readonly pdfId: string;
  readonly pdfName: string;
  readonly status: DocumentTemplateStatus;
  readonly isDefault: boolean;
  readonly version: number;
}

export interface MappingField {
  readonly id: string;
  readonly key: string;
  readonly label: string;
  readonly kind: MappingFieldKind;
  readonly sample: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly fontSize: number;
  readonly alignment: TextAlignment;
}

export interface AvailableMappingField {
  readonly key: string;
  readonly label: string;
  readonly kind: MappingFieldKind;
  readonly sample: string;
}

export const DOCUMENT_TYPE_LABELS: Readonly<Record<DocumentTemplateType, string>> = {
  PRESCRIPTION: 'Ordonnance',
  MEDICAL_CERTIFICATE: 'Certificat médical',
  SICK_LEAVE: 'Arrêt maladie',
  OTHER_CERTIFICATE: 'Autre certificat',
};

export const TEMPLATE_STATUS_LABELS: Readonly<Record<DocumentTemplateStatus, string>> = {
  ACTIVE: 'Actif',
  DRAFT: 'Brouillon',
  INACTIVE: 'Inactif',
};
