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

  it('only allows a DOCTOR session into the workspace', async () => {
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
    await expect(TestBed.runInInjectionContext(() => roleCheck(emptySnapshot, emptyState))).resolves.toBe(true);

    tokens.setSession({
      accessToken: 'admin-access-token',
      tokenType: 'Bearer',
      expiresAt: '2999-08-06T12:00:00Z',
      refreshToken: 'admin-refresh-token',
      refreshExpiresAt: '2999-08-06T23:59:59Z',
      user: { id: 'admin-1', role: 'ADMIN', mustChangePassword: false },
    });
    await expect(TestBed.runInInjectionContext(() => roleCheck(emptySnapshot, emptyState))).resolves.toBeInstanceOf(UrlTree);
  });
});
