import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { RUNTIME_CONFIG } from '../../../core/config/runtime-config';
import {
  CreateProfessionalCertificationRequest,
  CreateProfessionalEducationRequest,
  MeProfessionalProfileResponse,
  ProfessionalCertificationResponse,
  ProfessionalEducationResponse,
  UpdateProfessionalCertificationRequest,
  UpdateProfessionalEducationRequest,
  UpdateProfessionalProfileRequest,
} from './professional-profile-api.models';

@Injectable({ providedIn: 'root' })
export class ProfessionalProfileApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RUNTIME_CONFIG);
  private readonly baseUrl = `${this.config.apiBaseUrl}/me/professional-profile`;

  getProfile(): Observable<MeProfessionalProfileResponse> {
    return this.http.get<MeProfessionalProfileResponse>(this.baseUrl);
  }

  updateProfile(
    input: UpdateProfessionalProfileRequest,
  ): Observable<MeProfessionalProfileResponse> {
    return this.http.patch<MeProfessionalProfileResponse>(this.baseUrl, input);
  }

  listEducation(): Observable<readonly ProfessionalEducationResponse[]> {
    return this.http.get<readonly ProfessionalEducationResponse[]>(`${this.baseUrl}/education`);
  }

  createEducation(
    input: CreateProfessionalEducationRequest,
  ): Observable<ProfessionalEducationResponse> {
    return this.http.post<ProfessionalEducationResponse>(`${this.baseUrl}/education`, input);
  }

  updateEducation(
    educationId: string,
    input: UpdateProfessionalEducationRequest,
  ): Observable<ProfessionalEducationResponse> {
    return this.http.patch<ProfessionalEducationResponse>(
      `${this.baseUrl}/education/${educationId}`,
      input,
    );
  }

  deleteEducation(educationId: string, expectedRevision: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/education/${educationId}`, {
      params: { expectedRevision },
    });
  }

  listCertifications(): Observable<readonly ProfessionalCertificationResponse[]> {
    return this.http.get<readonly ProfessionalCertificationResponse[]>(
      `${this.baseUrl}/certifications`,
    );
  }

  createCertification(
    input: CreateProfessionalCertificationRequest,
  ): Observable<ProfessionalCertificationResponse> {
    return this.http.post<ProfessionalCertificationResponse>(
      `${this.baseUrl}/certifications`,
      input,
    );
  }

  updateCertification(
    certificationId: string,
    input: UpdateProfessionalCertificationRequest,
  ): Observable<ProfessionalCertificationResponse> {
    return this.http.patch<ProfessionalCertificationResponse>(
      `${this.baseUrl}/certifications/${certificationId}`,
      input,
    );
  }

  deleteCertification(certificationId: string, expectedRevision: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/certifications/${certificationId}`, {
      params: { expectedRevision },
    });
  }
}
