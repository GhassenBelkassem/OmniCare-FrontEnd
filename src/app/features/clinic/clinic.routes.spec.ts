import { Route } from '@angular/router';


import { CLINIC_ROUTES } from './clinic.routes';

describe('clinic routes', () => {
  const shell = CLINIC_ROUTES[0];

  it('guards the clinic workspace and exposes the phase 1 pages', () => {
    expect(shell.canActivate?.length).toBe(1);
    const paths = (shell.children ?? []).map((route: Route) => route.path);

    expect(paths).toEqual(['', 'select', 'overview', 'access-unavailable', '**']);
    expect((shell.children ?? []).find((route) => route.path === '**')?.redirectTo).toBe('');
  });

  it('lazy loads every clinic page', () => {
    for (const child of shell.children ?? []) {
      if (child.path === '**') continue;
      expect(typeof child.loadComponent).toBe('function');
    }
  });

});
