import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { RUNTIME_CONFIG } from '../../../core/config/runtime-config';
import { MeProfessionalProfileResponse, UpdateProfessionalProfileRequest } from './professional-profile-api.models';

@Injectable({ providedIn: 'root' })
export class ProfessionalProfileApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RUNTIME_CONFIG);
  private readonly baseUrl = `${this.config.apiBaseUrl}/me/professional-profile`;

  getProfile(): Observable<MeProfessionalProfileResponse> {
    return this.http.get<MeProfessionalProfileResponse>(this.baseUrl);
  }

  updateProfile(input: UpdateProfessionalProfileRequest): Observable<MeProfessionalProfileResponse> {
    return this.http.patch<MeProfessionalProfileResponse>(this.baseUrl, input);
  }
}