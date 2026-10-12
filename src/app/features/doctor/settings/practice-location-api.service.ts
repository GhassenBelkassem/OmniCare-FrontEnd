import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { RUNTIME_CONFIG } from '../../../core/config/runtime-config';
import {
  CreatePracticeLocationRequest,
  PracticeLocationMediaResponse,
  PracticeLocationResponse,
  UpdatePracticeLocationRequest,
} from './practice-location-api.models';

@Injectable({ providedIn: 'root' })
export class PracticeLocationApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RUNTIME_CONFIG);
  private readonly baseUrl = `${this.config.apiBaseUrl}/me/practice-locations`;

  list(): Observable<readonly PracticeLocationResponse[]> {
    return this.http.get<readonly PracticeLocationResponse[]>(this.baseUrl);
  }

  get(locationId: string): Observable<PracticeLocationResponse> {
    return this.http.get<PracticeLocationResponse>(`${this.baseUrl}/${locationId}`);
  }

  create(input: CreatePracticeLocationRequest): Observable<PracticeLocationResponse> {
    return this.http.post<PracticeLocationResponse>(this.baseUrl, input);
  }

  update(
    locationId: string,
    input: UpdatePracticeLocationRequest,
  ): Observable<PracticeLocationResponse> {
    return this.http.patch<PracticeLocationResponse>(`${this.baseUrl}/${locationId}`, input);
  }

  delete(locationId: string, expectedRevision: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${locationId}`, {
      params: { expectedRevision },
    });
  }

  uploadMedia(
    locationId: string,
    file: File,
    displayOrder: number,
  ): Observable<PracticeLocationMediaResponse> {
    const body = new FormData();
    body.append('file', file);
    return this.http.post<PracticeLocationMediaResponse>(
      `${this.baseUrl}/${locationId}/media`,
      body,
      { params: { displayOrder } },
    );
  }

  deleteMedia(locationId: string, mediaId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${locationId}/media/${mediaId}`);
  }
}
