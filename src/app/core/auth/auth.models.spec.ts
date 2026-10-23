import { DASHBOARD_ROLES, dashboardRouteFor, isDashboardRole } from './auth.models';

describe('dashboard role contract', () => {
  it('recognizes the implemented role vocabulary', () => {
    expect(DASHBOARD_ROLES).toEqual([
      'PATIENT',
      'DOCTOR',
      'SECRETARY',
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
    expect(isDashboardRole('SECRETARY')).toBe(true);
  });

  it('routes each web role to its supported workspace', () => {
    expect(dashboardRouteFor('DOCTOR')).toBe('/doctor');
    expect(dashboardRouteFor('SECRETARY')).toBe('/doctor');
    expect(dashboardRouteFor('PATIENT')).toBe('/forbidden');
    expect(dashboardRouteFor('ADMIN')).toBe('/admin');
  });
});
