import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { describe, expect, it, vi } from 'vitest';

import { OMNICARE_ICONS } from '../../../app.icons';
import { AuthService } from '../../../core/auth/auth.service';
import { RUNTIME_CONFIG } from '../../../core/config/runtime-config';
import { OcActionMenu } from '../../../shared/ui';
import { CabinetSettingsSection } from './cabinet-settings-section';
import {
  CreatePracticeLocationRequest,
  PracticeLocationResponse,
} from './practice-location-api.models';

const URL = '/api/v1/me/practice-locations';

describe('CabinetSettingsSection', () => {
  let fixture: ComponentFixture<CabinetSettingsSection>;
  let component: CabinetSettingsSection;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CabinetSettingsSection],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideNzIcons(OMNICARE_ICONS),
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: '/api/v1' } },
        { provide: AuthService, useValue: { logout: vi.fn() } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CabinetSettingsSection);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('renders the real empty state and multiple readable cabinets without internal values', () => {
    http.expectOne(URL).flush([]);
    fixture.detectChanges();
    expect(text()).toContain('Aucun cabinet');
    expect(text()).toContain('informations visibles par vos patients');

    component.load();
    http.expectOne(URL).flush([
      location(),
      location({
        id: 'cabinet-2',
        name: 'Cabinet Carthage',
        city: 'Carthage',
        primary: false,
        active: false,
      }),
    ]);
    fixture.detectChanges();
    expect(text()).toContain('Cabinet La Marsa');
    expect(text()).toContain('Cabinet Carthage');
    expect(text()).toContain('Cabinet principal');
    expect(text()).toContain('Inactif');
    expect(text()).not.toContain('cabinet-1');
    expect(text()).not.toContain('revision');
  });

  it('keeps delete in the overflow menu and emits the selected cabinet', () => {
    const existing = location();
    http.expectOne(URL).flush([existing]);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('app-cabinet-card')).not.toBeNull();
    expect(root.querySelector('oc-action-menu')).not.toBeNull();
    expect(root.querySelector('app-cabinet-card')?.textContent).not.toContain('Supprimer');

    const menu = fixture.debugElement.query(By.directive(OcActionMenu))
      .componentInstance as OcActionMenu;
    menu.deleteRequested.emit();
    expect(component.deleteTarget()).toBe(existing);
  });

  it('renders the polished cabinet hierarchy and keeps every action discoverable', () => {
    http.expectOne(URL).flush([location()]);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const card = root.querySelector('.cabinet-card');
    expect(card?.querySelectorAll('.cabinet-card__detail-icon')).toHaveLength(3);
    expect(card?.querySelectorAll('.cabinet-card__badges .oc-status')).toHaveLength(2);
    expect(card?.querySelector('.cabinet-card__instructions')).not.toBeNull();
    expect(card?.querySelector('.cabinet-card__instructions-icon')).not.toBeNull();
    expect(card?.querySelector('.cabinet-gallery__upload')).not.toBeNull();
    expect(card?.querySelector('.cabinet-card__actions oc-button')?.textContent).toContain(
      'Modifier',
    );
    expect(card?.querySelector('.oc-action-menu__trigger')?.getAttribute('aria-label')).toContain(
      'Cabinet La Marsa',
    );
  });

  it('creates with the form payload and adds the returned cabinet', () => {
    http.expectOne(URL).flush([]);
    const value = createRequest();
    component.save({ id: null, revision: null, value });
    const request = http.expectOne(URL);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(value);
    request.flush(location());
    expect(component.locations()[0]?.name).toBe('Cabinet La Marsa');
    expect(component.success()).toBe('Cabinet ajouté.');
  });

  it('updates with expectedRevision, adopts the server revision and reloads primary state', () => {
    const first = location();
    const second = location({
      id: 'cabinet-2',
      name: 'Cabinet Carthage',
      primary: false,
      revision: 2,
    });
    http.expectOne(URL).flush([first, second]);
    component.save({
      id: second.id,
      revision: second.revision,
      value: { ...createRequest(), name: second.name, primary: true },
    });
    const update = http.expectOne(`${URL}/${second.id}`);
    expect(update.request.body.expectedRevision).toBe(2);
    update.flush({ ...second, primary: true, revision: 3 });
    expect(component.locations().find((item) => item.id === second.id)?.revision).toBe(3);

    http.expectOne(URL).flush([
      { ...second, primary: true, revision: 3 },
      { ...first, primary: false, revision: 5 },
    ]);
    expect(component.locations().find((item) => item.id === first.id)?.revision).toBe(5);
  });

  it('preserves the edit state on stale revision and reloads only intentionally', () => {
    const existing = location();
    http.expectOne(URL).flush([existing]);
    component.edit(existing);
    component.save({ id: existing.id, revision: existing.revision, value: createRequest() });
    http
      .expectOne(`${URL}/${existing.id}`)
      .flush({ code: 'RESOURCE_STATE_CONFLICT' }, { status: 409, statusText: 'Conflict' });
    expect(component.formOpen()).toBe(true);
    expect(component.editing()).toBe(existing);
    expect(component.formConflict()).toBe(true);
    http.expectNone(URL);

    component.refreshAfterConflict();
    http.expectOne(URL).flush([location({ revision: 5 })]);
    expect(component.locations()[0]?.revision).toBe(5);
  });

  it('maps the last-active-cabinet capability conflict to actionable French', () => {
    const existing = location();
    http.expectOne(URL).flush([existing]);
    component.edit(existing);
    component.save({
      id: existing.id,
      revision: existing.revision,
      value: { ...createRequest(), primary: false, active: false },
    });
    http
      .expectOne(`${URL}/${existing.id}`)
      .flush(
        { code: 'CARE_CAPABILITY_REQUIRES_ACTIVE_CABINET', detail: 'sensitive backend text' },
        { status: 409, statusText: 'Conflict' },
      );
    expect(component.formError()).toContain('Désactivez d’abord ces services');
    expect(component.formError()).not.toContain('sensitive backend text');
  });

  it('confirms deletion, does not remove optimistically, and keeps a stale item visible', () => {
    const existing = location();
    http.expectOne(URL).flush([existing]);
    component.requestDelete(existing);
    expect(component.deleteMessage()).toContain('Cabinet La Marsa');
    component.confirmDelete();
    expect(component.locations()).toEqual([existing]);
    const request = http.expectOne((candidate) => candidate.url === `${URL}/${existing.id}`);
    expect(request.request.params.get('expectedRevision')).toBe('4');
    request.flush({ code: 'RESOURCE_STATE_CONFLICT' }, { status: 409, statusText: 'Conflict' });
    expect(component.locations()).toEqual([existing]);
    expect(component.deleteConflict()).toBe(true);
  });

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }
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
    revision: 4,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
    gallery: [],
    ...overrides,
  };
}
