import { HttpBackend, HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { RUNTIME_CONFIG } from '../../core/config/runtime-config';

/**
 * Public document verification (G-1 D5), opened from the QR code printed on a signed document.
 * Only the whitelisted fields below are ever read from the response: no medical content, no
 * patient data, even if the server sent some.
 */
export type VerificationView =
  | { readonly kind: 'loading' }
  | {
      readonly kind: 'valid';
      readonly typeLabel: string;
      readonly issuer: string | null;
      readonly signedOn: string | null;
    }
  | { readonly kind: 'invalid' }
  | { readonly kind: 'rate-limited' }
  | { readonly kind: 'unavailable' };

const TYPE_LABELS: Readonly<Record<string, string>> = {
  SICK_LEAVE_CERTIFICATE: 'Arrêt de travail',
  MEDICAL_CERTIFICATE: 'Certificat médical',
  PRESCRIPTION: 'Ordonnance',
  LAB_ORDER: 'Demande d’analyses',
  IMAGING_ORDER: 'Demande d’imagerie',
};

/** A reference is base64url, 40 to 100 characters (the server answers 400 otherwise). */
const REFERENCE = /^[A-Za-z0-9_-]{40,100}$/;

export function isWellFormedReference(ref: string | null | undefined): ref is string {
  return typeof ref === 'string' && REFERENCE.test(ref);
}

export function documentTypeLabel(type: unknown): string {
  return typeof type === 'string' && TYPE_LABELS[type] !== undefined ? TYPE_LABELS[type] : 'Document';
}

/** « 12 novembre 2026 », in Tunis time. */
export function formatSignedOn(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Africa/Tunis',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/** « Dr Nom · Spécialité » (the name is never prefixed twice). */
export function issuerLine(doctor: unknown): string | null {
  if (typeof doctor !== 'object' || doctor === null) return null;
  const { displayName, specialty } = doctor as { displayName?: unknown; specialty?: unknown };
  if (typeof displayName !== 'string') return null;
  const name = displayName.trim().replace(/^(dr\.?|docteur)\s+/i, '').slice(0, 120);
  if (name.length === 0) return null;
  const field = typeof specialty === 'string' ? specialty.trim().slice(0, 120) : '';
  return field.length > 0 ? `Dr ${name} · ${field}` : `Dr ${name}`;
}

/** Response body → view. Anything but an explicit VALID is « Invalide ». */
export function verificationView(body: unknown): VerificationView {
  if (typeof body !== 'object' || body === null) return { kind: 'invalid' };
  const response = body as { status?: unknown; artifactType?: unknown; signedAt?: unknown; doctor?: unknown };
  if (response.status !== 'VALID') return { kind: 'invalid' };
  return {
    kind: 'valid',
    typeLabel: documentTypeLabel(response.artifactType),
    issuer: issuerLine(response.doctor),
    signedOn: formatSignedOn(response.signedAt),
  };
}

/** HTTP failure → view: 400 / 404 « Invalide », 429 « Trop de vérifications », else retry. */
export function verificationFailureView(error: unknown): VerificationView {
  if (!(error instanceof HttpErrorResponse)) return { kind: 'unavailable' };
  if (error.status === 400 || error.status === 404) return { kind: 'invalid' };
  if (error.status === 429) return { kind: 'rate-limited' };
  return { kind: 'unavailable' };
}

/**
 * Calls the public endpoint without the application interceptors: a visitor's stored session is
 * never attached and an expired one can never redirect this page to the login.
 */
@Injectable({ providedIn: 'root' })
export class ArtifactVerificationApiService {
  private readonly http = new HttpClient(inject(HttpBackend));
  private readonly config = inject(RUNTIME_CONFIG);

  verify(ref: string): Observable<unknown> {
    return this.http.get<unknown>(
      `${this.config.apiBaseUrl}/artifacts/verify/${encodeURIComponent(ref)}`,
    );
  }
}
