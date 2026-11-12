import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  provideRouter,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';

import { authenticatedGuard } from '../../core/auth/auth.guards';
import { AuthBootstrapService } from '../../core/auth/auth-bootstrap.service';
import { AuthTokenStore } from '../../core/auth/auth-token.store';
import type { DashboardRole } from '../../core/auth/auth.models';
import { CalendarPage } from './calendar/calendar-page';
import { DOCTOR_ROUTES } from './doctor.routes';
import { ProductionUnavailablePage } from './unavailable/production-unavailable-page';
import { UrgentReadinessPage } from './urgent-readiness/urgent-readiness-page';
import { unsavedChangesGuard } from './unsaved-changes.guard';

describe('doctor routes', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthBootstrapService, useValue: { whenResolved: () => Promise.resolve() } },
      ],
    });
  });

  it('defines the shell with canonical guards and title', () => {
    expect(DOCTOR_ROUTES).toHaveLength(1);
    const shell = DOCTOR_ROUTES[0];
    expect(shell.path).toBe('');
    expect(shell.title).toBe('Espace médecin | OmniCare');
    expect(shell.canActivate?.[0]).toBe(authenticatedGuard);
    expect(typeof shell.canActivate?.[1]).toBe('function');
    expect(shell.children?.length).toBeGreaterThan(5);
  });

  it('lazy-loads every page component', () => {
    for (const route of DOCTOR_ROUTES) {
      expect(typeof route.loadComponent).toBe('function');
      for (const child of route.children ?? []) {
        if (child.path === '') continue; // redirect entry has no component
        expect(typeof child.loadComponent).toBe('function');
      }
    }
  });

  it('protects the consultation route with the unsaved changes guard', () => {
    const consultation = DOCTOR_ROUTES[0].children?.find(
      (route) => route.path === 'consultation/:id',
    );

    expect(consultation?.canDeactivate).toEqual([unsavedChangesGuard]);
  });

  it('exposes list and read-only detail routes for completed consultations', () => {
    const children = DOCTOR_ROUTES[0].children ?? [];
    expect(children.some((route) => route.path === 'history')).toBe(true);
    expect(children.some((route) => route.path === 'history/:consultationId')).toBe(true);
  });

  it('exposes only the production Calendar route after FullCalendar cutover', async () => {
    const children = DOCTOR_ROUTES[0].children ?? [];
    const calendar = children.find((route) => route.path === 'calendar');

    expect(calendar).toBeDefined();
    expect(children.some((route) => route.path === 'calendar-preview')).toBe(false);
    await expect(calendar?.loadComponent?.()).resolves.toBe(CalendarPage);
  });

  it('exposes the urgent readiness page inside the guarded Doctor shell', async () => {
    const urgentReadiness = DOCTOR_ROUTES[0].children?.find(
      (route) => route.path === 'urgent-readiness',
    );

    expect(urgentReadiness?.title).toBe('Préparation aux urgences | OmniCare');
    await expect(urgentReadiness?.loadComponent?.()).resolves.toBe(UrgentReadinessPage);
  });

  it('exposes the urgent request queue separately from scheduled requests', () => {
    const children = DOCTOR_ROUTES[0].children ?? [];
    const scheduledRequests = children.find((route) => route.path === 'requests');
    const urgentRequests = children.find((route) => route.path === 'urgent-requests');

    expect(scheduledRequests).toBeDefined();
    expect(urgentRequests?.title).toBe('Demandes urgentes | OmniCare');
    expect(urgentRequests?.providers).toBeDefined();
  });

  it.each(['waiting-room', 'prescriptions', 'results', 'analytics'])(
    'resolves %s to an explicit production-unavailable state',
    async (path) => {
      const route = DOCTOR_ROUTES[0].children?.find((candidate) => candidate.path === path);

      expect(route?.data?.['featureDescription']).toEqual(expect.any(String));
      await expect(route?.loadComponent?.()).resolves.toBe(ProductionUnavailablePage);
    },
  );

  it('allows DOCTOR and SECRETARY sessions into the workspace', async () => {
    const tokens = TestBed.inject(AuthTokenStore);
    const roleCheck = DOCTOR_ROUTES[0].canActivate?.[1] as CanActivateFn;
    const emptySnapshot = {} as ActivatedRouteSnapshot;
    const emptyState = {} as RouterStateSnapshot;

    tokens.setSession({
      accessToken: 'doctor-access-token',
      tokenType: 'Bearer',
      expiresAt: '2999-08-06T12:00:00Z',
      refreshToken: 'doctor-refresh-token',
      refreshExpiresAt: '2999-08-06T23:59:59Z',
      user: { id: 'doctor-1', role: 'DOCTOR', mustChangePassword: false },
    });
    await expect(
      TestBed.runInInjectionContext(() => roleCheck(emptySnapshot, emptyState)),
    ).resolves.toBe(true);

    tokens.setSession(sessionFor('SECRETARY'));
    await expect(
      TestBed.runInInjectionContext(() => roleCheck(emptySnapshot, emptyState)),
    ).resolves.toBe(true);
  });

  it.each(['PATIENT', 'ADMIN'] satisfies DashboardRole[])(
    'rejects a %s session from the Doctor workspace',
    async (role) => {
      const tokens = TestBed.inject(AuthTokenStore);
      const roleCheck = DOCTOR_ROUTES[0].canActivate?.[1] as CanActivateFn;
      const emptySnapshot = {} as ActivatedRouteSnapshot;
      const emptyState = {} as RouterStateSnapshot;

      tokens.setSession(sessionFor(role));
      const result = await TestBed.runInInjectionContext(() =>
        roleCheck(emptySnapshot, emptyState),
      );

      expect(result).toBeInstanceOf(UrlTree);
      expect((result as UrlTree).toString()).toBe('/forbidden');
    },
  );

  it('lets a secretary reach only the delegated agenda', () => {
    const children = DOCTOR_ROUTES[0].children ?? [];
    const openPaths = children
      .filter((route) => route.path !== '' && route.canActivate === undefined)
      .map((route) => route.path);

    expect(openPaths).toEqual(['secretary-agenda']);
  });
});

function sessionFor(role: DashboardRole) {
  return {
    accessToken: `${role.toLowerCase()}-access-token`,
    tokenType: 'Bearer' as const,
    expiresAt: '2999-08-06T12:00:00Z',
    refreshToken: `${role.toLowerCase()}-refresh-token`,
    refreshExpiresAt: '2999-08-06T23:59:59Z',
    user: { id: `${role.toLowerCase()}-1`, role, mustChangePassword: false },
  };
}
