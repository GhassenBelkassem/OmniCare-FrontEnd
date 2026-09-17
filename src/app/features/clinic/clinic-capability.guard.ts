import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import {
  CLINIC_REQUESTS_READ_CAPABILITY,
  hasClinicCapability,
} from './clinic-api.models';
import { ClinicContextStore } from './clinic-context.store';

/**
 * Navigation visibility is UX only; this guard also keeps unsupported feature routes out
 * of the activated tree. The backend remains the final authorization authority.
 */
export const clinicRequestsGuard: CanActivateFn = () => {
  const context = inject(ClinicContextStore);
  const router = inject(Router);

  if (!context.initialized()) return router.createUrlTree(['/clinic']);
  if (!hasClinicCapability(context.bootstrap(), CLINIC_REQUESTS_READ_CAPABILITY)) {
    return router.createUrlTree(['/clinic/access-unavailable']);
  }
  return true;
};

export const clinicStaffGuard: CanActivateFn = () => {
  const context = inject(ClinicContextStore);
  const router = inject(Router);

  if (!context.initialized()) return router.createUrlTree(['/clinic']);
  if (!hasClinicCapability(context.bootstrap(), 'CLINIC_STAFF_READ')) {
    return router.createUrlTree(['/clinic/access-unavailable']);
  }
  return true;
};

export const clinicTasksGuard: CanActivateFn = () => {
  const context = inject(ClinicContextStore);
  const router = inject(Router);

  if (!context.initialized()) return router.createUrlTree(['/clinic']);
  if (!hasClinicCapability(context.bootstrap(), 'CLINIC_TASK_READ')) {
    return router.createUrlTree(['/clinic/access-unavailable']);
  }
  return true;
};

export const clinicHandoversGuard: CanActivateFn = () => capabilityGuard('CLINIC_TASK_HANDOVER');
export const clinicRoutingIncidentsGuard: CanActivateFn = () =>
  capabilityGuard('CLINIC_ROUTING_INCIDENT_READ');
export const clinicPositionsGuard: CanActivateFn = () => capabilityGuard('CLINIC_POSITION_READ');
export const clinicResponsibilitiesGuard: CanActivateFn = () => capabilityGuard('CLINIC_RESPONSIBILITY_READ');

function capabilityGuard(capability: 'CLINIC_TASK_HANDOVER' | 'CLINIC_ROUTING_INCIDENT_READ' | 'CLINIC_POSITION_READ' | 'CLINIC_RESPONSIBILITY_READ') {
  const context = inject(ClinicContextStore);
  const router = inject(Router);
  if (!context.initialized()) return router.createUrlTree(['/clinic']);
  return hasClinicCapability(context.bootstrap(), capability)
    ? true
    : router.createUrlTree(['/clinic/access-unavailable']);
}
