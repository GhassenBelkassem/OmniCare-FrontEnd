import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { RUNTIME_CONFIG } from '../../core/config/runtime-config';
import type {
  UrgentCabinetClinicalCommitment,
  UrgentCabinetProtectedIntakeResponse,
} from './urgent-cabinet-clinical.models';

@Injectable({ providedIn: 'root' })
export class UrgentCabinetClinicalApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RUNTIME_CONFIG);

  list(): Observable<readonly UrgentCabinetClinicalCommitment[]> {
    return this.http.get<readonly UrgentCabinetClinicalCommitment[]>(
      `${this.config.apiBaseUrl}/me/urgent-cabinet/commitments?limit=20`,
    );
  }

  protectedIntake(requestId: string): Observable<UrgentCabinetProtectedIntakeResponse> {
    return this.http.get<UrgentCabinetProtectedIntakeResponse>(
      `${this.config.apiBaseUrl}/me/urgent-cabinet/targeted-requests/${encodeURIComponent(requestId)}`,
    );
  }
}
