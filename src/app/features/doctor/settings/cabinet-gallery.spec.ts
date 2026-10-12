import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { describe, expect, it } from 'vitest';

import { OMNICARE_ICONS } from '../../../app.icons';
import { RUNTIME_CONFIG } from '../../../core/config/runtime-config';
import { CabinetGallery } from './cabinet-gallery';
import { PracticeLocationMediaResponse } from './practice-location-api.models';

const URL = '/api/v1/me/practice-locations/cabinet-1/media';

describe('CabinetGallery', () => {
  let fixture: ComponentFixture<CabinetGallery>;
  let component: CabinetGallery;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CabinetGallery],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideNzIcons(OMNICARE_ICONS),
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: '/api/v1' } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CabinetGallery);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('locationId', 'cabinet-1');
    fixture.componentRef.setInput('locationName', 'Cabinet La Marsa');
    fixture.componentRef.setInput('media', []);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('rejects unsupported client MIME types without making a request', () => {
    component.selectFile(fileEvent(new File(['text'], 'notes.txt', { type: 'text/plain' })));
    expect(component.error()).toContain('JPEG ou PNG');
    http.expectNone(URL);
  });

  it('blocks an upload when the gallery has reached the backend limit', () => {
    fixture.componentRef.setInput(
      'media',
      Array.from({ length: 10 }, (_, index) => ({
        ...media(),
        id: `media-${index}`,
        displayOrder: index,
      })),
    );
    component.selectFile(fileEvent(new File(['image'], 'cabinet.png', { type: 'image/png' })));
    expect(component.error()).toContain('limitée à 10 photos');
    http.expectNone(URL);
  });

  it('uploads backend-backed media and emits the returned URL without a local preview', () => {
    let gallery: readonly PracticeLocationMediaResponse[] = [];
    component.mediaChange.subscribe((value) => (gallery = value));
    const file = new File(['image'], 'cabinet.png', { type: 'image/png' });
    component.selectFile(fileEvent(file));
    const request = http.expectOne((candidate) => candidate.url === URL);
    expect(request.request.body).toBeInstanceOf(FormData);
    request.flush(media());
    expect(gallery).toEqual([media()]);
    expect(component.success()).toBe('Photo ajoutée.');
  });

  it('maps storage failure safely and never displays backend detail', () => {
    component.selectFile(fileEvent(new File(['image'], 'cabinet.jpg', { type: 'image/jpeg' })));
    http
      .expectOne((candidate) => candidate.url === URL)
      .flush(
        { code: 'OBJECT_STORAGE_UNAVAILABLE', detail: 'bucket secret/key' },
        { status: 503, statusText: 'Unavailable' },
      );
    expect(component.error()).toContain('Réessayez plus tard');
    expect(component.error()).not.toContain('bucket');
  });

  it('requires confirmation and keeps media until delete succeeds', () => {
    const existing = media();
    fixture.componentRef.setInput('media', [existing]);
    let gallery: readonly PracticeLocationMediaResponse[] = [existing];
    component.mediaChange.subscribe((value) => (gallery = value));
    component.requestDelete(existing);
    expect(component.deleteTarget()).toBe(existing);
    component.confirmDelete();
    expect(gallery).toEqual([existing]);
    http.expectOne(`${URL}/${existing.id}`).flush(null);
    expect(gallery).toEqual([]);
  });

  it('uses an accessible fallback instead of broken image chrome', () => {
    fixture.componentRef.setInput('media', [media()]);
    component.markBroken('media-1');
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Photo indisponible');
    expect(root.querySelector('img')).toBeNull();
  });

  it('bounds the card preview and exposes the remaining photo count', () => {
    fixture.componentRef.setInput(
      'media',
      Array.from({ length: 6 }, (_, index) => ({
        ...media(),
        id: `media-${index}`,
        displayOrder: index,
      })),
    );
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelectorAll('.cabinet-gallery__thumbnail')).toHaveLength(4);
    expect(root.textContent).toContain('+2');
    expect(root.textContent).toContain('6 / 10 photos');
  });

  it('integrates the upload action into the gallery grid', () => {
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.cabinet-gallery__grid .cabinet-gallery__upload')).not.toBeNull();
    expect(root.querySelector('input[type="file"]')?.getAttribute('accept')).toBe(
      'image/jpeg,image/png',
    );
    expect(root.querySelector('.cabinet-gallery__upload oc-icon')).not.toBeNull();
  });

  it('keeps primary media and destructive photo actions explicit and accessible', () => {
    fixture.componentRef.setInput('media', [media()]);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.cabinet-gallery__primary')?.textContent).toContain('Principale');
    expect(root.querySelector('.cabinet-gallery__delete')?.getAttribute('aria-label')).toBe(
      'Supprimer la photo 1',
    );
  });
});

function fileEvent(file: File): Event {
  const input = document.createElement('input');
  Object.defineProperty(input, 'files', { value: { item: () => file } });
  return { target: input } as unknown as Event;
}

function media(): PracticeLocationMediaResponse {
  return {
    id: 'media-1',
    url: '/uploads/cabinet.jpg',
    displayOrder: 0,
    createdAt: '2026-01-01T00:00:00Z',
  };
}
