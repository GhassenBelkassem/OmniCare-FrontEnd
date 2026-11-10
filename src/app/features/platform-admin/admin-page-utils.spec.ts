import { describe, expect, it } from 'vitest';
import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';

import { apiMessage, createClinicErrorMessage, professionalRoleDescription, professionalRoleLabel } from './admin-page-utils';

describe('platform admin professional role labels', () => {
  it.each([
    ['DOCTOR', 'Independent doctor'],
    ['CLINIC_ADMIN', 'Clinic administrator'],
    ['CLINIC_ASSISTANT', 'Clinic assistant'],
    ['CLINIC_MEDECIN', 'Clinic doctor'],
    ['CLINIC_INFIRMIERE', 'Clinic nurse'],
    ['CLINIC_KINE', 'Clinic physiotherapist'],
  ])('renders %s as %s', (role, label) => {
    expect(professionalRoleLabel(role)).toBe(label);
  });

  it('uses the same role vocabulary in detail-page descriptions', () => {
    expect(professionalRoleDescription('CLINIC_ASSISTANT')).toBe('Clinic assistant account');
  });

  it('degrades unknown future roles to readable text', () => {
    expect(professionalRoleLabel('CLINIC_RECEPTIONIST')).toBe('Clinic Receptionist');
  });
});

describe('platform admin HTTP errors', () => {
  it('preserves a ProblemDetail conflict code for feature-specific handling', () => {
    const error = new HttpErrorResponse({ status: 409, error: { errorCode: 'DUPLICATE_CLINIC_INPDP' } });
    expect(createClinicErrorMessage(error)).toContain('INPDP number');
  });

  it('normalizes server failures without exposing backend details', () => {
    const error = new HttpErrorResponse({
      status: 503,
      error: { message: 'database host and patient email secret@example.test' },
      headers: new HttpHeaders({ 'X-Request-Id': 'd4e9d84b-7b6e-4ea9-80d8-c997c7ffca73' }),
    });
    expect(apiMessage(error)).toBe('The service is temporarily unavailable.');
  });
});
