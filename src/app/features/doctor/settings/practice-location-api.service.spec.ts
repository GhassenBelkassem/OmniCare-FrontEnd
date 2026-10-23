import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { RUNTIME_CONFIG } from '../../../core/config/runtime-config';
import {
  CreatePracticeLocationRequest,
  PracticeLocationResponse,
  UpdatePracticeLocationRequest,
} from './practice-location-api.models';
import { PracticeLocationApiService } from './practice-location-api.service';

const URL = '/api/v1/me/practice-locations';

describe('PracticeLocationApiService', () => {
  let service: PracticeLocationApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: '/api/v1' } },
      ],
    });
    service = TestBed.inject(PracticeLocationApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists and gets doctor-owned practice locations', () => {
    service.list().subscribe((result) => expect(result).toEqual([location()]));
    const list = http.expectOne(URL);
    expect(list.request.method).toBe('GET');
    list.flush([location()]);

    service.get('cabinet-1').subscribe((result) => expect(result.id).toBe('cabinet-1'));
    const detail = http.expectOne(`${URL}/cabinet-1`);
    expect(detail.request.method).toBe('GET');
    detail.flush(location());
  });

  it('creates and revision-updates a cabinet with typed JSON payloads', () => {
    const create = createRequest();
    service.create(create).subscribe();
    const post = http.expectOne(URL);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual(create);
    post.flush(location());

    const update: UpdatePracticeLocationRequest = {
      ...create,
      publicPhone: create.publicPhone ?? '',
      patientInstructions: create.patientInstructions ?? '',
      expectedRevision: 4,
    };
    service.update('cabinet-1', update).subscribe();
    const patch = http.expectOne(`${URL}/cabinet-1`);
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.body.expectedRevision).toBe(4);
    patch.flush(location({ revision: 5 }));
  });

  it('sends delete concurrency as the backend query parameter', () => {
    service.delete('cabinet-1', 7).subscribe();
    const request = http.expectOne((candidate) => candidate.url === `${URL}/cabinet-1`);
    expect(request.request.method).toBe('DELETE');
    expect(request.request.params.get('expectedRevision')).toBe('7');
    request.flush(null);
  });

  it('uploads a binary multipart file and deletes media through the exact endpoints', () => {
    const file = new File(['image'], 'cabinet.png', { type: 'image/png' });
    service.uploadMedia('cabinet-1', file, 3).subscribe();
    const upload = http.expectOne((candidate) => candidate.url === `${URL}/cabinet-1/media`);
    expect(upload.request.method).toBe('POST');
    expect(upload.request.params.get('displayOrder')).toBe('3');
    expect(upload.request.body).toBeInstanceOf(FormData);
    expect((upload.request.body as FormData).get('file')).toBe(file);
    upload.flush({ id: 'media-1', url: '/uploads/photo.jpg', displayOrder: 3, createdAt: '' });

    service.deleteMedia('cabinet-1', 'media-1').subscribe();
    const remove = http.expectOne(`${URL}/cabinet-1/media/media-1`);
    expect(remove.request.method).toBe('DELETE');
    remove.flush(null);
  });

  it('preserves RFC 9457 problem details for the feature mapper', () => {
    let received: unknown = null;
    service.create(createRequest()).subscribe({
      error: (error: HttpErrorResponse) => (received = error),
    });
    http.expectOne(URL).flush(
      {
        type: 'https://api.omnicare.tn/problems/practice-location/practice-location-limit-reached',
        code: 'PRACTICE_LOCATION_LIMIT_REACHED',
      },
      {
        status: 409,
        statusText: 'Conflict',
        headers: { 'Content-Type': 'application/problem+json' },
      },
    );
    expect((received as HttpErrorResponse).error.code).toBe('PRACTICE_LOCATION_LIMIT_REACHED');
  });
});

function createRequest(): CreatePracticeLocationRequest {
  return {
    type: 'CABINET',
    name: 'Cabinet La Marsa',
    governorate: 'Tunis',
    city: 'La Marsa',
    address: '10 avenue Habib Bourguiba',
    latitude: 36.8782,
    longitude: 10.3247,
    publicPhone: '+216 71 000 000',
    wheelchairAccessible: true,
    patientInstructions: '2e étage, ascenseur à droite.',
    primary: true,
    active: true,
  };
}

function location(overrides: Partial<PracticeLocationResponse> = {}): PracticeLocationResponse {
  return {
    id: 'cabinet-1',
    ...createRequest(),
    publicPhone: '+216 71 000 000',
    patientInstructions: '2e étage, ascenseur à droite.',
    revision: 4,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
    gallery: [],
    ...overrides,
  };
}
