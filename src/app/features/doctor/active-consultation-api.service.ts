import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { RUNTIME_CONFIG } from '../../core/config/runtime-config';
import { ActiveConsultation } from './active-consultation.models';

@Injectable({ providedIn: 'root' })
export class ActiveConsultationApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RUNTIME_CONFIG);

  getActive(): Observable<ActiveConsultation | null> {
    return this.http.get<ActiveConsultation | null>(
      `${this.config.apiBaseUrl}/doctor/consultations/active`,
    );
  }
}
