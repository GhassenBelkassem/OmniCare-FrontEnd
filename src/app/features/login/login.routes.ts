import { Routes } from '@angular/router';

import { anonymousOnlyGuard } from '../../core/auth/auth.guards';

export const LOGIN_ROUTES: Routes = [
  {
    path: '',
    canMatch: [anonymousOnlyGuard],
    loadComponent: () => import('./login-page').then((component) => component.LoginPage),
    title: 'Sign in | OmniCare',
  },
];
