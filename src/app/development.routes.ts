import type { Routes } from '@angular/router';

/** Development-only routes. Production and static-demo builds replace this module with an empty one. */
export const DEVELOPMENT_ROOT_ROUTES: Routes = [
  {
    path: 'design-system',
    loadComponent: () =>
      import('./features/design-system/design-system').then(
        (component) => component.DesignSystemShowcase,
      ),
    title: 'OmniCare Design System',
  },
];

export const DEVELOPMENT_SHELL_ROUTES: Routes = [
  {
    path: 'patient',
    loadChildren: () =>
      import('./features/patient/patient.routes').then((routes) => routes.PATIENT_ROUTES),
  },
];
