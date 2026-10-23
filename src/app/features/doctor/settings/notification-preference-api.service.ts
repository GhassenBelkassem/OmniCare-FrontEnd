import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { RUNTIME_CONFIG } from '../../../core/config/runtime-config';
import {
  NotificationPreferenceResponse,
  NotificationPreferenceUpdateRequest,
} from './notification-preference-api.models';

@Injectable({ providedIn: 'root' })
export class NotificationPreferenceApiService {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(RUNTIME_CONFIG).apiBaseUrl}/notifications/preferences`;

  getAll(): Observable<readonly NotificationPreferenceResponse[]> {
    return this.http.get<readonly NotificationPreferenceResponse[]>(this.url);
  }

  update(
    category: string,
    request: NotificationPreferenceUpdateRequest,
  ): Observable<NotificationPreferenceResponse> {
    return this.http.put<NotificationPreferenceResponse>(
      `${this.url}/${encodeURIComponent(category)}`,
      request,
    );
  }
}
