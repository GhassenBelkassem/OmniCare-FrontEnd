import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { RUNTIME_CONFIG } from '../../../core/config/runtime-config';
import { ProfessionalReadinessResponse } from './professional-readiness-api.models';

export interface ProfessionalReadinessFailure {
  readonly title: string;
  readonly description: string;
}

@Injectable({ providedIn: 'root' })
export class ProfessionalReadinessApiService {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(RUNTIME_CONFIG).apiBaseUrl}/me/professional-readiness`;

  get(): Observable<ProfessionalReadinessResponse> {
    return this.http.get<ProfessionalReadinessResponse>(this.url);
  }
}

/** Maps transport failures to bounded product copy and never exposes backend details. */
export function mapProfessionalReadinessFailure(error: unknown): ProfessionalReadinessFailure {
  const title = 'Impossible de vérifier votre visibilité';

  if (error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)) {
    return {
      title,
      description: 'Votre session n’est plus valide. Reconnectez-vous puis réessayez.',
    };
  }

  if (error instanceof HttpErrorResponse && error.status === 0) {
    return {
      title,
      description: 'Vérifiez votre connexion, puis réessayez dans quelques instants.',
    };
  }

  return {
    title,
    description: 'Les informations de visibilité sont momentanément indisponibles.',
  };
}
