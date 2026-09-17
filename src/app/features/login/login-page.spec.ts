import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { DashboardRole } from '../../core/auth/auth.models';
import { AuthService } from '../../core/auth/auth.service';
import { LoginPage } from './login-page';

describe('LoginPage', () => {
  let fixture: ComponentFixture<LoginPage>;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
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

  it('does not perform a second imperative redirect when constructed', () => {
    fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();

    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });
});
