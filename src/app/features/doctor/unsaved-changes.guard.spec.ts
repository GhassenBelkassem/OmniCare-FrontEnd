import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';

import { UnsavedChangesAware, unsavedChangesGuard } from './unsaved-changes.guard';

describe('unsavedChangesGuard', () => {
  const currentRoute = {} as ActivatedRouteSnapshot;
  const currentState = {} as RouterStateSnapshot;
  const nextState = {} as RouterStateSnapshot;

  it('lets navigation proceed when the component reports no unsaved changes', () => {
    const component: UnsavedChangesAware = { canDeactivate: () => true };

    expect(unsavedChangesGuard(component, currentRoute, currentState, nextState)).toBe(true);
  });

  it('blocks navigation when the component reports unsaved changes', () => {
    const component: UnsavedChangesAware = { canDeactivate: () => false };

    expect(unsavedChangesGuard(component, currentRoute, currentState, nextState)).toBe(false);
  });
});
