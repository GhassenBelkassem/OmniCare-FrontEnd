import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { RUNTIME_CONFIG } from '../../core/config/runtime-config';
import { NotificationListResponseDto, UnreadCountResponseDto } from './appointment-api.models';

@Injectable({ providedIn: 'root' })
export class DoctorNotificationApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RUNTIME_CONFIG);
  private readonly notificationsUrl = `${this.config.apiBaseUrl}/notifications`;

  list(): Observable<NotificationListResponseDto> {
    return this.http.get<NotificationListResponseDto>(this.notificationsUrl);
  }

  unreadCount(): Observable<UnreadCountResponseDto> {
    return this.http.get<UnreadCountResponseDto>(`${this.notificationsUrl}/unread-count`);
  }

  markRead(id: string): Observable<void> {
    return this.http.post<void>(`${this.notificationsUrl}/${id}/read`, null);
  }

  markAllRead(): Observable<void> {
    return this.http.post<void>(`${this.notificationsUrl}/read-all`, null);
  }
}
