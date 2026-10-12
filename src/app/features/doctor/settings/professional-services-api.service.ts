import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { RUNTIME_CONFIG } from '../../../core/config/runtime-config';
import {
  CareCapabilityResponse,
  EquipmentConfigurationResponse,
  EquipmentOverviewResponse,
  PracticeLocationCoverageResponse,
  PracticeLocationEquipmentResponse,
  ReplaceCareCapabilitiesRequest,
  ReplaceEquipmentRequest,
  ReplacePracticeLocationCoverageRequest,
} from './professional-services-api.models';

@Injectable({ providedIn: 'root' })
export class CareCapabilityApiService {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(RUNTIME_CONFIG).apiBaseUrl}/me/care-capabilities`;

  get(): Observable<CareCapabilityResponse> {
    return this.http.get<CareCapabilityResponse>(this.url);
  }

  replace(request: ReplaceCareCapabilitiesRequest): Observable<CareCapabilityResponse> {
    return this.http.put<CareCapabilityResponse>(this.url, request);
  }
}

@Injectable({ providedIn: 'root' })
export class MedicalEquipmentApiService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(RUNTIME_CONFIG).apiBaseUrl;
  private readonly equipmentUrl = `${this.apiBaseUrl}/me/equipment`;
  private readonly locationsUrl = `${this.apiBaseUrl}/me/practice-locations`;

  getOverview(): Observable<EquipmentOverviewResponse> {
    return this.http.get<EquipmentOverviewResponse>(this.equipmentUrl);
  }

  replaceMobile(request: ReplaceEquipmentRequest): Observable<EquipmentConfigurationResponse> {
    return this.http.put<EquipmentConfigurationResponse>(`${this.equipmentUrl}/mobile`, request);
  }

  getPracticeLocation(locationId: string): Observable<PracticeLocationEquipmentResponse> {
    return this.http.get<PracticeLocationEquipmentResponse>(
      `${this.locationsUrl}/${locationId}/equipment`,
    );
  }

  replacePracticeLocation(
    locationId: string,
    request: ReplaceEquipmentRequest,
  ): Observable<PracticeLocationEquipmentResponse> {
    return this.http.put<PracticeLocationEquipmentResponse>(
      `${this.locationsUrl}/${locationId}/equipment`,
      request,
    );
  }
}

@Injectable({ providedIn: 'root' })
export class PracticeCoverageApiService {
  private readonly http = inject(HttpClient);
  private readonly locationsUrl = `${inject(RUNTIME_CONFIG).apiBaseUrl}/me/practice-locations`;

  get(locationId: string): Observable<PracticeLocationCoverageResponse> {
    return this.http.get<PracticeLocationCoverageResponse>(
      `${this.locationsUrl}/${locationId}/coverage`,
    );
  }

  replace(
    locationId: string,
    request: ReplacePracticeLocationCoverageRequest,
  ): Observable<PracticeLocationCoverageResponse> {
    return this.http.put<PracticeLocationCoverageResponse>(
      `${this.locationsUrl}/${locationId}/coverage`,
      request,
    );
  }
}
