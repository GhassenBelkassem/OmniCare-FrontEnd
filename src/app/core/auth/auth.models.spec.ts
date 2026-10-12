import { DASHBOARD_ROLES, DashboardRole, dashboardRouteFor, isDashboardRole } from './auth.models';

describe('dashboard role contract', () => {
  it('recognizes the implemented role vocabulary and rejects unsupported SECRETARY', () => {
    expect(DASHBOARD_ROLES).toEqual([
      'PATIENT',
      'DOCTOR',
      'NURSE',
      'KINE',
      'CLINIC_MEDECIN',
      'CLINIC_INFIRMIERE',
      'CLINIC_KINE',
      'CLINIC_ASSISTANT',
      'CLINIC_ADMIN',
      'ADMIN',
    ]);
    expect(isDashboardRole('DOCTOR')).toBe(true);
    expect(isDashboardRole('SECRETARY')).toBe(false);
  });

  it('routes unsupported roles to forbidden rather than the Doctor workspace', () => {
    expect(dashboardRouteFor('DOCTOR')).toBe('/doctor');
    expect(dashboardRouteFor('PATIENT')).toBe('/forbidden');
    expect(dashboardRouteFor('ADMIN')).toBe('/admin');
    expect(dashboardRouteFor('SECRETARY' as DashboardRole)).toBe('/forbidden');
  });
});
