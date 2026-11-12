import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DocumentTemplateApiService } from './document-template-api.service';
import type {
  DocumentFieldDefinition,
  DocumentFieldInput,
  DocumentTemplate,
} from './document-template-api.models';
import { isGraphicFieldType } from './document-template-api.models';
import { DocumentTemplateEditorWizard } from './document-template-editor-wizard';

function definition(patch: Partial<DocumentFieldDefinition>): DocumentFieldDefinition {
  return {
    key: 'leaveDurationDays',
    label: 'Durée de l’arrêt',
    valueSource: 'MANUAL',
    fieldType: 'NUMBER',
    required: false,
    formatPattern: null,
    sampleValue: '3',
    defaultXPercent: 10,
    defaultYPercent: 40,
    defaultWidthPercent: 20,
    defaultHeightPercent: 4,
    defaultFontSize: 11,
    ...patch,
  };
}

const CATALOG: readonly DocumentFieldDefinition[] = [
  definition({}),
  definition({
    key: 'verificationQr',
    label: 'QR code de vérification',
    valueSource: 'AUTOMATIC',
    fieldType: 'QR_CODE',
    sampleValue: '',
    defaultXPercent: 75,
    defaultYPercent: 80,
    defaultWidthPercent: 18,
    defaultHeightPercent: 18,
    defaultFontSize: 10,
  }),
  definition({
    key: 'signatureStamp',
    label: 'Signature / cachet',
    valueSource: 'MANUAL',
    fieldType: 'SIGNATURE_AREA',
    sampleValue: '',
    defaultXPercent: 55,
    defaultYPercent: 82,
    defaultWidthPercent: 35,
    defaultHeightPercent: 12,
  }),
];

const TEMPLATE: DocumentTemplate = {
  id: 'template-1',
  name: 'Arrêt maladie',
  type: 'SICK_LEAVE',
  status: 'DRAFT',
  isDefault: false,
  currentVersionNumber: 1,
  revision: 4,
  createdAt: '2026-11-01T08:00:00Z',
  updatedAt: '2026-11-01T08:00:00Z',
  currentVersion: {
    id: 'version-1',
    versionNumber: 1,
    originalFilename: 'arret.pdf',
    sizeBytes: 1000,
    pageCount: 1,
    sha256: 'a'.repeat(64),
    createdAt: '2026-11-01T08:00:00Z',
  },
  fields: [],
  warnings: [],
  unresolvedKeys: [],
};

function setup() {
  const api = {
    saveDraft: vi.fn((_id: string, _input: unknown) => of(TEMPLATE)),
    preview: vi.fn(() => throwError(() => new HttpErrorResponse({ status: 422, error: { code: 'PREVIEW_FAILED' } }))),
    pageImage: vi.fn(() => throwError(() => new Error('no image'))),
  };
  TestBed.configureTestingModule({
    imports: [DocumentTemplateEditorWizard],
    providers: [{ provide: DocumentTemplateApiService, useValue: api }],
  });
  const fixture = TestBed.createComponent(DocumentTemplateEditorWizard);
  fixture.componentRef.setInput('catalog', CATALOG);
  return { api, editor: fixture.componentInstance };
}

describe('DocumentTemplateEditorWizard — QR code and signature zones (G-1 D5)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('knows which zone types hold no typed text', () => {
    expect(isGraphicFieldType('QR_CODE')).toBe(true);
    expect(isGraphicFieldType('SIGNATURE_AREA')).toBe(true);
    expect(isGraphicFieldType('TEXT')).toBe(false);
    expect(isGraphicFieldType('DATE')).toBe(false);
    expect(isGraphicFieldType('NUMBER')).toBe(false);
  });

  it('places a QR code zone at its catalog position, with its own look and no text settings', () => {
    const { editor } = setup();
    editor.addField('verificationQr');
    const field = editor.fields().find((item) => item.fieldKey === 'verificationQr')!;
    expect(field).toMatchObject({ fieldType: 'QR_CODE', valueSource: 'AUTOMATIC', x: 75, y: 80, width: 18, height: 18 });
    expect(editor.selectedFieldId()).toBe(field.id);
    expect(editor.fieldKind(field)).toBe('qr');
    expect(editor.isGraphic(field)).toBe(true);
    expect(editor.graphicDescription(field)).toContain('QR code');
  });

  it('places a signature / stamp zone with its own look and no text settings', () => {
    const { editor } = setup();
    editor.addField('signatureStamp');
    const field = editor.fields().find((item) => item.fieldKey === 'signatureStamp')!;
    expect(field).toMatchObject({ fieldType: 'SIGNATURE_AREA', x: 55, y: 82, width: 35, height: 12 });
    expect(editor.fieldKind(field)).toBe('signature');
    expect(editor.isGraphic(field)).toBe(true);
    expect(editor.graphicDescription(field)).toContain('signature');
  });

  it('keeps text zones unchanged', () => {
    const { editor } = setup();
    editor.addField('leaveDurationDays');
    const field = editor.fields()[0];
    expect(editor.isGraphic(field)).toBe(false);
    expect(editor.graphicDescription(field)).toBeNull();
    expect(editor.fieldKind(field)).toBe('clinical');
  });

  it('moves a QR zone like any other zone', () => {
    const { editor } = setup();
    editor.addField('verificationQr');
    editor.nudgeSelected(-5, -10);
    expect(editor.fields()[0]).toMatchObject({ x: 70, y: 70, detectionSource: 'MANUAL' });
  });

  it('saves the QR code and signature zones with their types', () => {
    const { api, editor } = setup();
    editor.createdTemplate.set(TEMPLATE);
    editor.step.set(4);
    editor.addField('leaveDurationDays');
    editor.addField('verificationQr');
    editor.addField('signatureStamp');
    expect(editor.canContinue()).toBe(true);

    editor.continue();

    expect(api.saveDraft).toHaveBeenCalledTimes(1);
    const [templateId, request, revision] = api.saveDraft.mock.calls[0] as unknown as [
      string,
      { fields: readonly DocumentFieldInput[] },
      number,
    ];
    expect(templateId).toBe('template-1');
    expect(revision).toBe(4);
    const byKey = new Map(request.fields.map((field) => [field.fieldKey, field]));
    expect(byKey.get('verificationQr')).toMatchObject({
      fieldType: 'QR_CODE',
      xPercent: 75,
      yPercent: 80,
      widthPercent: 18,
      heightPercent: 18,
    });
    expect(byKey.get('signatureStamp')).toMatchObject({ fieldType: 'SIGNATURE_AREA', widthPercent: 35 });
    expect(editor.step()).toBe(5);
    // The preview failure is shown in French from the error catalog, never the server text.
    expect(editor.previewError()).toBe('L’aperçu de ce document n’a pas pu être généré.');
  });
});
