import { HttpErrorResponse } from '@angular/common/http';

import { ApiErrorBody } from '../../core/auth/auth.models';
import { AccountStatus } from './admin-api.models';
import { OcStatus } from '../../shared/ui';

export function apiMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    return (error.error as ApiErrorBody | null)?.message ?? 'The request could not be completed.';
  }
  return error instanceof Error ? error.message : 'The request could not be completed.';
}

export function statusTone(status: AccountStatus | 'ENDED'): OcStatus {
  if (status === 'ACTIVE') return 'confirmed';
  if (status === 'INVITED') return 'pending';
  if (status === 'SUSPENDED') return 'blocked';
  return 'cancelled';
}
