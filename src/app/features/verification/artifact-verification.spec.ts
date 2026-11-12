import { HttpErrorResponse, HttpHeaders, provideHttpClient, withInterceptors, type HttpInterceptorFn } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RUNTIME_CONFIG } from '../../core/config/runtime-config';
import { ArtifactVerificationPage } from './artifact-verification-page';
import {
  ArtifactVerificationApiService,
  documentTypeLabel,
  formatSignedOn,
  isWellFormedReference,
  issuerLine,
  verificationFailureView,
  verificationView,
} from './artifact-verification';

const REF = 'q3Xv9TzP0aBcDeFgHiJkLmNoPqRsTuVwXyZ01234567'; // 43 chars, base64url
const VERIFY_URL = `/api/v1/artifacts/verify/${REF}`;

/** A response carrying fields the page must never use. */
const VALID_WITH_EXTRA = {
  status: 'VALID',
  artifactType: 'SICK_LEAVE_CERTIFICATE',
  signedAt: '2026-11-12T23:30:00Z',
  doctor: { displayName: 'Sami Ben Ali', specialty: 'Médecine générale', phone: '+216 20 000 000' },
  patient: { fullName: 'Marwa Mechergui', dateOfBirth: '2006-01-01' },
  diagnosis: 'Angine',
  statement: 'Repos strict.',
  verificationReference: REF,
};

describe('verification view (pure logic)', () => {
  it('labels every document type in French', () => {
    expect(documentTypeLabel('SICK_LEAVE_CERTIFICATE')).toBe('Arrêt de travail');
    expect(documentTypeLabel('MEDICAL_CERTIFICATE')).toBe('Certificat médical');
    expect(documentTypeLabel('PRESCRIPTION')).toBe('Ordonnance');
    expect(documentTypeLabel('LAB_ORDER')).toBe('Demande d’analyses');
    expect(documentTypeLabel('IMAGING_ORDER')).toBe('Demande d’imagerie');
    expect(documentTypeLabel('SOMETHING_ELSE')).toBe('Document');
  });

  it('formats the date in Tunis time', () => {
    // 23:30 UTC on 12 Nov is 00:30 on 13 Nov in Tunis (UTC+1).
    expect(formatSignedOn('2026-11-12T23:30:00Z')).toBe('13 novembre 2026');
    expect(formatSignedOn('not a date')).toBeNull();
    expect(formatSignedOn(null)).toBeNull();
  });

  it('builds « Dr nom · spécialité » without doubling the title', () => {
    expect(issuerLine({ displayName: 'Sami Ben Ali', specialty: 'Cardiologie' })).toBe('Dr Sami Ben Ali · Cardiologie');
    expect(issuerLine({ displayName: 'Dr. Sami Ben Ali', specialty: null })).toBe('Dr Sami Ben Ali');
    expect(issuerLine(null)).toBeNull();
    expect(issuerLine({ displayName: '  ' })).toBeNull();
  });

  it('VALID: keeps only the type, the doctor and the date, even if the response carries more', () => {
    const view = verificationView(VALID_WITH_EXTRA);
    expect(view).toEqual({
      kind: 'valid',
      typeLabel: 'Arrêt de travail',
      issuer: 'Dr Sami Ben Ali · Médecine générale',
      signedOn: '13 novembre 2026',
    });
    const shown = JSON.stringify(view);
    for (const forbidden of ['Marwa', 'Mechergui', '2006', 'Angine', 'Repos', '+216', REF]) {
      expect(shown).not.toContain(forbidden);
    }
  });

  it('INVALID or anything that is not an explicit VALID is « Invalide »', () => {
    expect(verificationView({ status: 'INVALID' })).toEqual({ kind: 'invalid' });
    expect(verificationView({ status: 'valid' })).toEqual({ kind: 'invalid' });
    expect(verificationView(null)).toEqual({ kind: 'invalid' });
    expect(verificationView('VALID')).toEqual({ kind: 'invalid' });
  });

  it('maps failures: 400/404 invalid, 429 rate limited, network and server errors retryable', () => {
    expect(verificationFailureView(new HttpErrorResponse({ status: 400 }))).toEqual({ kind: 'invalid' });
    expect(verificationFailureView(new HttpErrorResponse({ status: 404 }))).toEqual({ kind: 'invalid' });
    expect(verificationFailureView(new HttpErrorResponse({ status: 429 }))).toEqual({ kind: 'rate-limited' });
    expect(verificationFailureView(new HttpErrorResponse({ status: 0 }))).toEqual({ kind: 'unavailable' });
    expect(verificationFailureView(new HttpErrorResponse({ status: 503 }))).toEqual({ kind: 'unavailable' });
    expect(verificationFailureView(new Error('offline'))).toEqual({ kind: 'unavailable' });
  });

  it('accepts only base64url references of 40 to 100 characters', () => {
    expect(isWellFormedReference(REF)).toBe(true);
    expect(isWellFormedReference('short')).toBe(false);
    expect(isWellFormedReference(`${REF}/../x`)).toBe(false);
    expect(isWellFormedReference('a'.repeat(101))).toBe(false);
    expect(isWellFormedReference(null)).toBe(false);
  });
});

describe('ArtifactVerificationPage (state, public endpoint)', () => {
  const interceptor = vi.fn<HttpInterceptorFn>((request, next) => next(request));

  afterEach(() => {
    TestBed.resetTestingModule();
    interceptor.mockClear();
  });

  function setup(ref: string | null = REF) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([interceptor])),
        provideHttpClientTesting(),
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: '/api/v1' } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap(ref === null ? {} : { ref }) } } },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    const page = TestBed.runInInjectionContext(() => new ArtifactVerificationPage());
    return { http, page };
  }

  it('valid document: « Valide » with type, doctor and date only', () => {
    const { http, page } = setup();
    expect(page.view()).toEqual({ kind: 'loading' });
    const request = http.expectOne(VERIFY_URL);
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush(VALID_WITH_EXTRA);
    expect(page.view()).toEqual({
      kind: 'valid',
      typeLabel: 'Arrêt de travail',
      issuer: 'Dr Sami Ben Ali · Médecine générale',
      signedOn: '13 novembre 2026',
    });
    http.verify();
  });

  it('bypasses the application interceptors (no session attached, no login redirect)', () => {
    const { http } = setup();
    http.expectOne(VERIFY_URL).flush({ status: 'INVALID' });
    expect(interceptor).not.toHaveBeenCalled();
  });

  it('invalid document: « Invalide »', () => {
    const { http, page } = setup();
    http.expectOne(VERIFY_URL).flush({ status: 'INVALID' });
    expect(page.view()).toEqual({ kind: 'invalid' });
  });

  it('400 from the server: « Invalide »', () => {
    const { http, page } = setup();
    http.expectOne(VERIFY_URL).flush({ code: 'VALIDATION_ERROR' }, { status: 400, statusText: 'Bad Request' });
    expect(page.view()).toEqual({ kind: 'invalid' });
  });

  it('429: rate limited, then a retry succeeds', () => {
    const { http, page } = setup();
    http.expectOne(VERIFY_URL).flush(
      { code: 'TOO_MANY_REQUESTS' },
      { status: 429, statusText: 'Too Many Requests', headers: new HttpHeaders({ 'Retry-After': '60' }) },
    );
    expect(page.view()).toEqual({ kind: 'rate-limited' });
    page.retry();
    expect(page.view()).toEqual({ kind: 'loading' });
    http.expectOne(VERIFY_URL).flush({ status: 'INVALID' });
    expect(page.view()).toEqual({ kind: 'invalid' });
  });

  it('network failure: retryable', () => {
    const { http, page } = setup();
    http.expectOne(VERIFY_URL).error(new ProgressEvent('error'));
    expect(page.view()).toEqual({ kind: 'unavailable' });
  });

  it('a malformed reference is « Invalide » without calling the server', () => {
    const { http, page } = setup('abc');
    http.expectNone(() => true);
    expect(page.view()).toEqual({ kind: 'invalid' });
  });

  it('the service calls the public endpoint with the encoded reference', () => {
    const { http } = setup();
    http.expectOne(VERIFY_URL).flush({ status: 'INVALID' });
    const api = TestBed.inject(ArtifactVerificationApiService);
    api.verify('a/b').subscribe({ error: () => undefined });
    http.expectOne('/api/v1/artifacts/verify/a%2Fb').flush({ status: 'INVALID' });
    http.verify();
  });
});
