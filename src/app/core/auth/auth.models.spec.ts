import { TestBed } from '@angular/core/testing';

import {
  DASHBOARD_ROLES,
  DashboardRole,
  dashboardRouteFor,
  isDashboardRole,
} from './auth.models';

describe('SECRETARY dashboard role', () => {
  it('is a recognised role', () => {
    expect(isDashboardRole('SECRETARY')).toBe(true);
    expect(DASHBOARD_ROLES).toContain('SECRETARY');
  });

  it('lands in the doctor workspace rather than /forbidden', () => {
    // This case must stay explicit: the generic fall-through would send a
    // freshly invited secretary to the forbidden page.
    expect(dashboardRouteFor('SECRETARY')).toBe('/doctor');
  });

  it('leaves every other role on its existing destination', () => {
    const expected: Readonly<Record<DashboardRole, string>> = {
      ADMIN: '/admin',
      DOCTOR: '/doctor',
      SECRETARY: '/doctor',
      PATIENT: '/patient',
      NURSE: '/forbidden',
      KINE: '/forbidden',
      CLINIC_MEDECIN: '/clinic',
      CLINIC_INFIRMIERE: '/clinic',
      CLINIC_KINE: '/clinic',
      CLINIC_ASSISTANT: '/clinic',
      CLINIC_ADMIN: '/clinic',
    };

    for (const [role, route] of Object.entries(expected)) {
      expect(dashboardRouteFor(role as DashboardRole)).toBe(route);
    }
  });
});