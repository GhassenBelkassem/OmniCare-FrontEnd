import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AuthenticatedUser, DashboardRole } from '../../core/auth/auth.models';
import { AuthService } from '../../core/auth/auth.service';
import { LoginPage } from './login-page';

describe('LoginPage', () => {
  let fixture: ComponentFixture<LoginPage>;
  let router: Router;
  const user = signal<AuthenticatedUser | null>(null);

  beforeEach(() => {
    user.set(null);
    TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            user: user.asReadonly(),
            login: vi.fn(() => of<DashboardRole>('CLINIC_ADMIN')),
            routeFor: (role: DashboardRole) => role === 'CLINIC_ADMIN' ? '/clinic' : '/login',
          },
        },
      ],
    });
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('redirects away from login when an authenticated session is already present', () => {
    user.set({ id: 'clinic-user-1', role: 'CLINIC_ADMIN', mustChangePassword: false });

    fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/clinic');
  });
});
