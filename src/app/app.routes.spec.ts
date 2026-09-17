import { Route } from '@angular/router';

import { createAppRoutes } from './app.routes';

describe('application routes', () => {
  it('does not expose the design system in production routes', () => {
    const production = createAppRoutes(false);

    expect(production.some((route) => route.path === 'design-system')).toBe(false);
  });

  it('exposes the design system only when development routes are requested', () => {
    const development = createAppRoutes(true);

    expect(development.some((route) => route.path === 'design-system')).toBe(true);
  });

  it('uses the canonical role routes and defaults to login', () => {
    const shell = createAppRoutes(false).find((route) => route.path === '');
    const children = shell?.children ?? [];
    const paths = children.map((route: Route) => route.path);

    expect(paths).toEqual([
      'login',
      'first-login',
      'forbidden',
      'admin',
      'platform-admin',
      'doctor',
      'clinic',
      'patient',
      '',
      '**',
    ]);
    expect(children.find((route) => route.path === 'platform-admin')?.redirectTo).toBe('admin');
    expect(children.find((route) => route.path === '')?.redirectTo).toBe('login');
    expect(children.find((route) => route.path === '**')?.redirectTo).toBe('login');
  });
});
