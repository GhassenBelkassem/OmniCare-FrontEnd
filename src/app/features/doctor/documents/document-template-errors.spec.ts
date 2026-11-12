import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';

import {
  DOCUMENT_TEMPLATE_ERROR_CODES,
  DOCUMENT_TEMPLATE_GENERIC_ERROR,
  DOCUMENT_TEMPLATE_NETWORK_ERROR,
  documentTemplateErrorMessage,
} from './document-template-errors';

const EXISTING_CODES = [
  'TEMPLATE_NOT_FOUND',
  'VERSION_NOT_FOUND',
  'PROFESSIONAL_PROFILE_NOT_FOUND',
  'INVALID_PDF',
  'INVALID_PAGE',
  'INVALID_FIELD',
  'INVALID_DOCUMENT_TYPE',
  'INVALID_TEMPLATE_STATE',
  'RESOURCE_STATE_CONFLICT',
  'VALIDATION_FAILED',
  'PREVIEW_FAILED',
  'OBJECT_STORAGE_UNAVAILABLE',
];
const D5_CODES = [
  'RATE_LIMITED',
  'TEMPLATE_INFECTED',
  'SCANNER_UNAVAILABLE',
  'PAGE_TOO_LARGE',
  'FILE_TOO_LARGE',
];
const ENGLISH = /(?<!\p{L})(the|template|file|error|invalid|failed|not found|unavailable|request|please|try)(?!\p{L})/iu;
const RAW_CODE = /\b[A-Z]{2,}(?:_[A-Z]{2,})+\b/;

function problem(status: number, code: string): HttpErrorResponse {
  return new HttpErrorResponse({
    status,
    error: { code, title: 'Invalid template', detail: 'The template is not in a valid state.' },
  });
}

describe('documentTemplateErrorMessage', () => {
  it.each([...EXISTING_CODES, ...D5_CODES])('%s has its own French message', (code) => {
    expect(DOCUMENT_TEMPLATE_ERROR_CODES).toContain(code);
    const message = documentTemplateErrorMessage(code);
    expect(message).not.toBe(DOCUMENT_TEMPLATE_GENERIC_ERROR);
    expect(message).not.toMatch(ENGLISH);
    expect(message).not.toMatch(RAW_CODE);
    expect(message.endsWith('.')).toBe(true);
  });

  it('reads the code of a ProblemDetail response and never shows the server text', () => {
    const message = documentTemplateErrorMessage(problem(422, 'TEMPLATE_INFECTED'));
    expect(message).toBe('Ce fichier a été bloqué par le contrôle de sécurité. Utilisez un autre fichier PDF.');
    expect(message).not.toContain('The template');
  });

  it('maps the legacy `errorCode` envelope too', () => {
    const error = new HttpErrorResponse({ status: 429, error: { errorCode: 'RATE_LIMITED' } });
    expect(documentTemplateErrorMessage(error)).toBe(
      'Trop d’envois en peu de temps. Patientez une minute puis réessayez.',
    );
  });

  it('gives the generic French sentence for an unknown code', () => {
    expect(documentTemplateErrorMessage('SOMETHING_NEW')).toBe(DOCUMENT_TEMPLATE_GENERIC_ERROR);
    expect(documentTemplateErrorMessage(problem(500, 'INTERNAL_SERVER_ERROR'))).toBe(
      DOCUMENT_TEMPLATE_GENERIC_ERROR,
    );
    expect(documentTemplateErrorMessage(null)).toBe(DOCUMENT_TEMPLATE_GENERIC_ERROR);
    expect(DOCUMENT_TEMPLATE_GENERIC_ERROR).not.toMatch(ENGLISH);
  });

  it('uses the caller sentence for an unknown code when one is given', () => {
    expect(documentTemplateErrorMessage(problem(500, 'BOOM_FAILURE'), 'Le PDF source n’a pas pu être téléchargé.')).toBe(
      'Le PDF source n’a pas pu être téléchargé.',
    );
  });

  it('has a dedicated message for a lost connection, a 413 and a 429 without a code', () => {
    expect(documentTemplateErrorMessage(new HttpErrorResponse({ status: 0 }))).toBe(DOCUMENT_TEMPLATE_NETWORK_ERROR);
    expect(documentTemplateErrorMessage(new HttpErrorResponse({ status: 413 }))).toBe(
      'Ce fichier dépasse la taille maximale autorisée de 10 Mo.',
    );
    expect(documentTemplateErrorMessage(new HttpErrorResponse({ status: 429 }))).not.toBe(
      DOCUMENT_TEMPLATE_GENERIC_ERROR,
    );
  });

  it('accepts an already normalized error', () => {
    expect(documentTemplateErrorMessage({ status: 503, code: 'SCANNER_UNAVAILABLE' })).toBe(
      'Le contrôle de sécurité des fichiers est momentanément indisponible. Réessayez dans un instant.',
    );
  });
});
