import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, CanActivateFn, provideRouter, RouterStateSnapshot, UrlTree } from '@angular/router';

import { authenticatedGuard } from '../../core/auth/auth.guards';
import { AuthBootstrapService } from '../../core/auth/auth-bootstrap.service';
import { AuthTokenStore } from '../../core/auth/auth-token.store';
import { DOCTOR_ROUTES } from './doctor.routes';
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
    expect(shell.title).toBe('Doctor workspace | OmniCare');
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

  it('admits a DOCTOR or a SECRETARY into the workspace', async () => {
    const tokens = TestBed.inject(AuthTokenStore);
    const roleCheck = DOCTOR_ROUTES[0].canActivate?.[1] as CanActivateFn;
    const emptySnapshot = {} as ActivatedRouteSnapshot;
    const emptyState = {} as RouterStateSnapshot;

    tokens.setSession(session('doctor-1', 'DOCTOR'));
    await expect(
      TestBed.runInInjectionContext(() => roleCheck(emptySnapshot, emptyState)),
    ).resolves.toBe(true);

    tokens.setSession(session('secretary-1', 'SECRETARY'));
    await expect(
      TestBed.runInInjectionContext(() => roleCheck(emptySnapshot, emptyState)),
    ).resolves.toBe(true);

    tokens.setSession(session('admin-1', 'ADMIN'));
    await expect(
      TestBed.runInInjectionContext(() => roleCheck(emptySnapshot, emptyState)),
    ).resolves.toBeInstanceOf(UrlTree);
  });

  it('lets a secretary reach the agenda but not the doctor-only pages', () => {
    const children = DOCTOR_ROUTES[0].children ?? [];
    const agenda = children.find((route) => route.path === 'secretary-agenda');
    const team = children.find((route) => route.path === 'team');

    expect(agenda?.canActivate).toBeUndefined();
    expect(typeof team?.canActivate?.[0]).toBe('function');
  });

  it('guards every doctor-only destination against direct navigation', () => {
    const children = DOCTOR_ROUTES[0].children ?? [];
    const openPaths = children
      .filter((route) => route.path !== '' && route.canActivate === undefined)
      .map((route) => route.path);

    // Only the agenda and the empty-path redirect are reachable by a secretary.
    expect(openPaths).toEqual(['secretary-agenda']);
  });
});

function session(
  id: string,
  role: 'DOCTOR' | 'SECRETARY' | 'ADMIN',
): Parameters<AuthTokenStore['setSession']>[0] {
  return {
    accessToken: `${id}-access-token`,
    tokenType: 'Bearer',
    expiresAt: '2999-08-06T12:00:00Z',
    refreshToken: `${id}-refresh-token`,
    refreshExpiresAt: '2999-08-06T23:59:59Z',
    user: { id, role, mustChangePassword: false },
  };
}
