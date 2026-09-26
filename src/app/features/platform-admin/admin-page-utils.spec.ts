import { describe, expect, it } from 'vitest';

import { professionalRoleDescription, professionalRoleLabel } from './admin-page-utils';

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
