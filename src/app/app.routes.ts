import { isDevMode } from '@angular/core';
import { Routes } from '@angular/router';

import { authenticatedGuard, roleGuard } from './core/auth/auth.guards';

const productionRoutes: Routes = [
  {
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
        path: 'patient',
        loadChildren: () =>
          import('./features/patient/patient.routes').then((routes) => routes.PATIENT_ROUTES),
      },
      { path: '', pathMatch: 'full', redirectTo: 'login' },
      { path: '**', redirectTo: 'login' },
    ],
  },
];

export function createAppRoutes(includeDevelopmentRoutes: boolean): Routes {
  const developmentRoutes: Routes = includeDevelopmentRoutes
    ? [
        {
          path: 'design-system',
          loadComponent: () =>
            import('./features/design-system/design-system').then(
              (component) => component.DesignSystemShowcase,
            ),
          title: 'OmniCare Design System',
        },
      ]
    : [];

  return [...developmentRoutes, ...productionRoutes];
}

export const routes = createAppRoutes(isDevMode());
