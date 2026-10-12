import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { describe, expect, it, vi } from 'vitest';

import { OMNICARE_ICONS } from '../../../app.icons';
import { AuthService } from '../../../core/auth/auth.service';
import { RUNTIME_CONFIG } from '../../../core/config/runtime-config';
import { CabinetEquipmentSettings } from './cabinet-equipment-settings';
import { EquipmentDefinitionResponse } from './professional-services-api.models';

describe('CabinetEquipmentSettings', () => {
  let fixture: ComponentFixture<CabinetEquipmentSettings>;
  let component: CabinetEquipmentSettings;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CabinetEquipmentSettings],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNzIcons(OMNICARE_ICONS),
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: '/api/v1' } },
        { provide: AuthService, useValue: { logout: vi.fn() } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CabinetEquipmentSettings);
    fixture.componentRef.setInput('locationId', 'cabinet-a');
    fixture.componentRef.setInput('catalog', [EQUIPMENT]);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('loads the correct cabinet scope and renders the server catalog without quantities', () => {
    const request = http.expectOne('/api/v1/me/practice-locations/cabinet-a/equipment');
    expect(request.request.method).toBe('GET');
    request.flush({ practiceLocationId: 'cabinet-a', revision: 1, equipment: [] });
    fixture.detectChanges();
    expect(text()).toContain('Équipement cabinet');
    expect(text()).not.toContain('Quantité');
    expect(text()).not.toContain('cabinet-a');
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[role="checkbox"]'),
    ).not.toBeNull();
    expect(text()).toContain('Enregistrer le matériel');
  });

  it('saves the complete set with this cabinet revision and adopts the response revision', () => {
    http
      .expectOne('/api/v1/me/practice-locations/cabinet-a/equipment')
      .flush({ practiceLocationId: 'cabinet-a', revision: 3, equipment: [] });
    component.toggle(EQUIPMENT);
    component.save();
    const request = http.expectOne('/api/v1/me/practice-locations/cabinet-a/equipment');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ expectedRevision: 3, equipmentCodes: ['CABINET_X'] });
    request.flush({ practiceLocationId: 'cabinet-a', revision: 4, equipment: [EQUIPMENT] });
    expect(component.revision()).toBe(4);
  });

  it('preserves selections on stale conflict and reloads only this equipment aggregate', () => {
    http
      .expectOne('/api/v1/me/practice-locations/cabinet-a/equipment')
      .flush({ practiceLocationId: 'cabinet-a', revision: 3, equipment: [] });
    component.toggle(EQUIPMENT);
    component.save();
    http
      .expectOne('/api/v1/me/practice-locations/cabinet-a/equipment')
      .flush({ code: 'RESOURCE_STATE_CONFLICT' }, { status: 409, statusText: 'Conflict' });
    expect(component.draft()).toEqual(['CABINET_X']);
    expect(component.conflict()).toBe(true);

    component.load();
    http
      .expectOne('/api/v1/me/practice-locations/cabinet-a/equipment')
      .flush({ practiceLocationId: 'cabinet-a', revision: 5, equipment: [] });
    expect(component.draft()).toEqual([]);
  });

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }
});

const EQUIPMENT: EquipmentDefinitionResponse = {
  code: 'CABINET_X',
  displayName: 'Équipement cabinet',
  portable: false,
  active: true,
};
