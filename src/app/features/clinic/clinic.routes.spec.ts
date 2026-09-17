import { Route } from '@angular/router';


import { CLINIC_ROUTES } from './clinic.routes';

describe('clinic routes', () => {
  const shell = CLINIC_ROUTES[0];

  it('guards the clinic workspace and exposes the clinic pages', () => {
    expect(shell.canActivate?.length).toBe(1);
    const paths = (shell.children ?? []).map((route: Route) => route.path);

    expect(paths).toEqual([
      '',
      'select',
      'requests',
      'requests/:caseId',
      'tasks/queue',
      'tasks/my',
      'tasks/:taskId',
      'handovers',
      'routing-incidents',
      'routing-incidents/:incidentId',
      'positions',
      'positions/:positionId',
      'responsibilities',
      'responsibilities/:responsibilityId',
      'staff',
      'staff/:membershipId',
      'access-unavailable',
      '**',
    ]);
    expect((shell.children ?? []).find((route) => route.path === '**')?.redirectTo).toBe('requests');
    expect((shell.children ?? []).find((route) => route.path === 'requests')?.canActivate?.length).toBe(1);
    expect((shell.children ?? []).find((route) => route.path === 'requests/:caseId')?.canActivate?.length).toBe(1);
    expect((shell.children ?? []).find((route) => route.path === 'tasks/queue')?.canActivate?.length).toBe(1);
    expect((shell.children ?? []).find((route) => route.path === 'tasks/my')?.canActivate?.length).toBe(1);
    expect((shell.children ?? []).find((route) => route.path === 'tasks/:taskId')?.canActivate?.length).toBe(1);
    expect((shell.children ?? []).find((route) => route.path === 'handovers')?.canActivate?.length).toBe(1);
    expect((shell.children ?? []).find((route) => route.path === 'routing-incidents')?.canActivate?.length).toBe(1);
    expect((shell.children ?? []).find((route) => route.path === 'routing-incidents/:incidentId')?.canActivate?.length).toBe(1);
    expect((shell.children ?? []).find((route) => route.path === 'positions')?.canActivate?.length).toBe(1);
    expect((shell.children ?? []).find((route) => route.path === 'positions/:positionId')?.canActivate?.length).toBe(1);
    expect((shell.children ?? []).find((route) => route.path === 'responsibilities')?.canActivate?.length).toBe(1);
    expect((shell.children ?? []).find((route) => route.path === 'responsibilities/:responsibilityId')?.canActivate?.length).toBe(1);
    expect((shell.children ?? []).find((route) => route.path === 'staff')?.canActivate?.length).toBe(1);
    expect((shell.children ?? []).find((route) => route.path === 'staff/:membershipId')?.canActivate?.length).toBe(1);
  });

  it('lazy loads every clinic page', () => {
    for (const child of shell.children ?? []) {
      if (child.path === '**') continue;
      expect(typeof child.loadComponent).toBe('function');
    }
  });

});
