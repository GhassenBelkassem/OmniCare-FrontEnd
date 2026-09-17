import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, RouterOutlet, Routes, UrlTree, provideRouter } from '@angular/router';

import { anonymousOnlyGuard, authenticatedGuard } from './auth.guards';
import { AuthBootstrapService } from './auth-bootstrap.service';
import { LoginSession } from './auth.models';
import { AuthTokenStore } from './auth-token.store';

@Component({ template: '<p>Visible login content</p>' })
class LoginProbe {}

@Component({ template: '<p>Clinic destination</p>' })
class ClinicProbe {}

@Component({ imports: [RouterOutlet], template: '<router-outlet />' })
class RouterHost {}

describe('authentication guards', () => {
  let router: Router;
  let tokens: AuthTokenStore;
  let whenResolved: () => Promise<void>;

  beforeEach(() => {
    whenResolved = () => Promise.resolve();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'login', canMatch: [anonymousOnlyGuard], component: LoginProbe },
          { path: 'clinic', canActivate: [authenticatedGuard], component: ClinicProbe },
        ] satisfies Routes),
        { provide: AuthBootstrapService, useValue: { whenResolved: () => whenResolved() } },
      ],
    });
    router = TestBed.inject(Router);
    tokens = TestBed.inject(AuthTokenStore);
  });

  it('waits for resolved authentication before allowing a protected route', async () => {
    let resolve!: () => void;
    whenResolved = () => new Promise<void>((done) => { resolve = done; });
    const result = TestBed.runInInjectionContext(() => authenticatedGuard({} as never, {} as never));

    let settled = false;
    void (result as Promise<unknown>).then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);

    tokens.setSession(session());
    resolve();
    await expect(result).resolves.toBe(true);
  });

  it('returns a UrlTree once for an anonymous protected-route request', async () => {
    const result = await TestBed.runInInjectionContext(() => authenticatedGuard({} as never, {} as never));
    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/login');
  });

  it('redirects an anonymous protected-route request once to Login without a loop', async () => {
    const fixture: ComponentFixture<RouterHost> = TestBed.createComponent(RouterHost);

    await router.navigateByUrl('/clinic');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(router.url).toBe('/login');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Visible login content');
  });

  it('redirects authenticated /login navigation before visible Login content is created', async () => {
    tokens.setSession(session());
    const fixture: ComponentFixture<RouterHost> = TestBed.createComponent(RouterHost);

    await router.navigateByUrl('/login');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Clinic destination');
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Visible login content');
  });
});

function session(): LoginSession {
  return {
    accessToken: 'access', tokenType: 'Bearer', expiresAt: '2999-08-05T12:10:00Z',
    refreshToken: 'refresh', refreshExpiresAt: '2999-08-06T00:00:00Z',
    user: { id: 'clinic-user', role: 'CLINIC_ADMIN', mustChangePassword: false },
  };
}
