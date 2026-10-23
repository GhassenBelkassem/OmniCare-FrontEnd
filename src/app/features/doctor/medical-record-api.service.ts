import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { RUNTIME_CONFIG } from '../../core/config/runtime-config';
import type { DoctorMedicalRecordWorkspace } from './medical-record.models';

@Injectable({ providedIn: 'root' })
export class MedicalRecordApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RUNTIME_CONFIG);

  getWorkspace(consultationId: string): Observable<DoctorMedicalRecordWorkspace> {
    return this.http.get<DoctorMedicalRecordWorkspace>(
      `${this.config.apiBaseUrl}/doctor/consultations/${encodeURIComponent(consultationId)}/medical-record`,
    );
  }
}
