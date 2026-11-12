import { isDevMode } from '@angular/core';
import { Routes } from '@angular/router';

import { landingRedirect, passwordChangeRequiredGuard } from './core/auth/auth.guards';
import { DEVELOPMENT_ROOT_ROUTES, DEVELOPMENT_SHELL_ROUTES } from './development.routes';

function applicationShellRoute(additionalRoutes: Routes = []): Routes[number] {
  return {
    path: '',
    loadComponent: () =>
      import('./core/shell/application-shell').then((component) => component.ApplicationShell),
    children: [
      {
        path: 'login',
        loadChildren: () =>
          import('./features/login/login.routes').then((routes) => routes.LOGIN_ROUTES),
      },
      {
        path: 'password-change',
        canActivate: [passwordChangeRequiredGuard],
        loadComponent: () =>
          import('./features/login/password-change-page').then(
            (component) => component.PasswordChangePage,
          ),
        title: 'Change password | OmniCare',
      },
      {
        path: 'first-login',
        loadComponent: () =>
          import('./features/login/first-login-page').then((component) => component.FirstLoginPage),
        title: 'Complete invitation | OmniCare',
      },
      {
        path: 'forbidden',
        loadComponent: () =>
          import('./features/login/forbidden-page').then((component) => component.ForbiddenPage),
        title: 'Access unavailable | OmniCare',
      },
      {
        path: 'admin',
        loadChildren: () =>
          import('./features/platform-admin/platform-admin.routes').then(
            (routes) => routes.PLATFORM_ADMIN_ROUTES,
          ),
      },
      { path: 'platform-admin', pathMatch: 'full', redirectTo: 'admin' },
      {
        path: 'doctor',
        loadChildren: () =>
          import('./features/doctor/doctor.routes').then((routes) => routes.DOCTOR_ROUTES),
      },
      {
        path: 'clinic',
        loadChildren: () =>
          import('./features/clinic/clinic.routes').then((routes) => routes.CLINIC_ROUTES),
      },
      {
        // G-1 D5: public verification of a signed document (QR code). No login, no guard.
        path: 'verifier/:ref',
        loadComponent: () =>
          import('./features/verification/artifact-verification-page').then(
            (component) => component.ArtifactVerificationPage,
          ),
        title: 'Vérification d’un document OmniCare',
      },
      ...additionalRoutes,
      { path: '', pathMatch: 'full', redirectTo: landingRedirect },
      { path: '**', redirectTo: 'login' },
    ],
  };
}

const productionRoutes: Routes = [applicationShellRoute()];

export function createAppRoutes(includeDevelopmentRoutes: boolean): Routes {
  if (includeDevelopmentRoutes) {
    return [...DEVELOPMENT_ROOT_ROUTES, applicationShellRoute(DEVELOPMENT_SHELL_ROUTES)];
  }
  return productionRoutes;
}

export const routes = createAppRoutes(isDevMode());
