import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';

import { RUNTIME_CONFIG } from '../../../core/config/runtime-config';
import { DocumentTemplateApiService } from './document-template-api.service';

describe('DocumentTemplateApiService writes (G-1 pass 2 item 5)', () => {
  afterEach(() => TestBed.resetTestingModule());

  function setup() {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: '/api/v1' } },
      ],
    });
    return { api: TestBed.inject(DocumentTemplateApiService), http: TestBed.inject(HttpTestingController) };
  }

  it('sends a fresh Idempotency-Key on every write and the expected revision on an existing template', () => {
    const { api, http } = setup();
    const file = new File(['%PDF-1.4'], 'arret.pdf', { type: 'application/pdf' });
    api.create(file, 'Arrêt').subscribe();
    api.createVersion('t1', file, 3).subscribe();
    api.saveDraft('t1', { fields: [] } as never, 3).subscribe();
    api.activate('t1', true, 3).subscribe();
    api.setDefault('t1', 3).subscribe();
    api.deactivate('t1', 3).subscribe();
    api.delete('t1', 3).subscribe();

    const requests = http.match(() => true);
    expect(requests).toHaveLength(7);
    const keys = requests.map((request) => request.request.headers.get('Idempotency-Key'));
    expect(keys.every((key) => typeof key === 'string' && key.startsWith('document-template-'))).toBe(true);
    expect(new Set(keys).size).toBe(7);
    for (const request of requests.slice(1)) {
      expect(request.request.params.get('expectedRevision')).toBe('3');
    }
    requests.forEach((request) => request.flush(null));
    http.verify();
  });
});
