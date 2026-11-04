import { DEMO_WORKSPACES, createDemoSession, isDemoWorkspaceRole } from './demo-auth';

describe('demo authentication', () => {
  it('offers every role backed by an Angular web workspace', () => {
    expect(DEMO_WORKSPACES.map((workspace) => workspace.role)).toEqual([
      'ADMIN',
      'DOCTOR',
      'SECRETARY',
      'CLINIC_ADMIN',
      'CLINIC_MEDECIN',
      'CLINIC_INFIRMIERE',
      'CLINIC_KINE',
      'CLINIC_ASSISTANT',
    ]);
  });

  it('does not present mobile-only or unimplemented web roles', () => {
    expect(isDemoWorkspaceRole('PATIENT')).toBe(false);
    expect(isDemoWorkspaceRole('NURSE')).toBe(false);
    expect(isDemoWorkspaceRole('KINE')).toBe(false);
  });

  it('creates a structurally valid, role-scoped session', () => {
    const session = createDemoSession('CLINIC_INFIRMIERE');

    expect(session.tokenType).toBe('Bearer');
    expect(session.accessToken).toContain('clinic_infirmiere');
    expect(session.user).toEqual({
      id: 'demo-clinic-infirmiere',
      role: 'CLINIC_INFIRMIERE',
      mustChangePassword: false,
    });
    expect(Date.parse(session.refreshExpiresAt)).toBeGreaterThan(Date.now());
  });
});
