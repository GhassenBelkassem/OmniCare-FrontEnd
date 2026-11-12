import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { RUNTIME_CONFIG } from '../../../core/config/runtime-config';
import {
  DocumentFieldDefinition,
  DocumentTemplate,
  DocumentTemplatePreviewRequest,
  SaveDocumentTemplateDraftRequest,
} from './document-template-api.models';

@Injectable({ providedIn: 'root' })
export class DocumentTemplateApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RUNTIME_CONFIG);
  private readonly baseUrl = `${this.config.apiBaseUrl}/me/document-templates`;

  list(): Observable<readonly DocumentTemplate[]> {
    return this.http.get<readonly DocumentTemplate[]>(this.baseUrl);
  }

  get(templateId: string): Observable<DocumentTemplate> {
    return this.http.get<DocumentTemplate>(`${this.baseUrl}/${templateId}`);
  }

  fieldCatalog(): Observable<readonly DocumentFieldDefinition[]> {
    return this.http.get<readonly DocumentFieldDefinition[]>(`${this.baseUrl}/field-catalog`);
  }

  create(file: File, name: string): Observable<DocumentTemplate> {
    const body = new FormData();
    body.append('file', file);
    return this.http.post<DocumentTemplate>(this.baseUrl, body, { params: { name } });
  }

  saveDraft(
    templateId: string,
    input: SaveDocumentTemplateDraftRequest,
    expectedRevision: number,
  ): Observable<DocumentTemplate> {
    return this.http.put<DocumentTemplate>(`${this.baseUrl}/${templateId}/draft`, input, {
      params: { expectedRevision },
    });
  }

  createVersion(templateId: string, file: File): Observable<DocumentTemplate> {
    const body = new FormData();
    body.append('file', file);
    return this.http.post<DocumentTemplate>(`${this.baseUrl}/${templateId}/versions`, body);
  }

  activate(
    templateId: string,
    makeDefault: boolean,
    expectedRevision: number,
  ): Observable<DocumentTemplate> {
    return this.http.post<DocumentTemplate>(`${this.baseUrl}/${templateId}/activate`, null, {
      params: { makeDefault, expectedRevision },
    });
  }

  setDefault(templateId: string, expectedRevision: number): Observable<DocumentTemplate> {
    return this.http.post<DocumentTemplate>(`${this.baseUrl}/${templateId}/default`, null, {
      params: { expectedRevision },
    });
  }

  deactivate(templateId: string, expectedRevision: number): Observable<DocumentTemplate> {
    return this.http.post<DocumentTemplate>(`${this.baseUrl}/${templateId}/deactivate`, null, {
      params: { expectedRevision },
    });
  }

  delete(templateId: string, expectedRevision: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${templateId}`, {
      params: { expectedRevision },
    });
  }

  pageImage(templateId: string, versionId: string, pageNumber = 1): Observable<Blob> {
    return this.http.get(
      `${this.baseUrl}/${templateId}/versions/${versionId}/pages/${pageNumber}`,
      { responseType: 'blob' },
    );
  }

  source(templateId: string, versionId: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${templateId}/versions/${versionId}/source`, {
      responseType: 'blob',
    });
  }

  preview(templateId: string, request?: DocumentTemplatePreviewRequest): Observable<Blob> {
    return this.http.post(`${this.baseUrl}/${templateId}/preview`, request ?? {}, {
      responseType: 'blob',
    });
  }
}
