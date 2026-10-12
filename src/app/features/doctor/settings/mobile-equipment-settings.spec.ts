import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { describe, expect, it, vi } from 'vitest';

import { OMNICARE_ICONS } from '../../../app.icons';
import { AuthService } from '../../../core/auth/auth.service';
import { RUNTIME_CONFIG } from '../../../core/config/runtime-config';
import {
  EquipmentDefinitionResponse,
  EquipmentOverviewResponse,
} from './professional-services-api.models';
import { MobileEquipmentSettings } from './mobile-equipment-settings';

const URL = '/api/v1/me/equipment/mobile';

describe('MobileEquipmentSettings', () => {
  let fixture: ComponentFixture<MobileEquipmentSettings>;
  let component: MobileEquipmentSettings;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MobileEquipmentSettings],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNzIcons(OMNICARE_ICONS),
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: '/api/v1' } },
        { provide: AuthService, useValue: { logout: vi.fn() } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MobileEquipmentSettings);
    fixture.componentRef.setInput('overview', overview());
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('renders backend display names and excludes nonportable catalog equipment', () => {
    expect(text()).toContain('Cardioscope portable');
    expect(text()).not.toContain('Équipement fixe');
    expect(text()).not.toContain('Stock');
    expect(component.options().every((definition) => definition.portable)).toBe(true);
    const checkbox = (fixture.nativeElement as HTMLElement).querySelector('[role="checkbox"]');
    expect(checkbox?.getAttribute('aria-labelledby')).toContain('PORTABLE_X-label');
    expect(text()).toContain('aucun stock, quantité ou suivi d’inventaire');
  });

  it('saves the complete portable set with the mobile revision', () => {
    component.toggle(PORTABLE);
    component.save();
    const request = http.expectOne(URL);
    expect(request.request.body).toEqual({ expectedRevision: 5, equipmentCodes: ['PORTABLE_X'] });
    request.flush({ revision: 6, equipment: [PORTABLE] });
    expect(component.revision()).toBe(6);
    expect(component.dirty()).toBe(false);
  });

  it('updates the mobile draft through the accessible checkbox control', () => {
    const checkbox = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '[role="checkbox"]',
    );
    checkbox?.click();
    fixture.detectChanges();
    expect(component.draft()).toEqual(['PORTABLE_X']);
    expect(checkbox?.getAttribute('aria-checked')).toBe('true');
  });

  it('preserves the draft and requests an intentional parent reload after conflict', () => {
    const reload = vi.fn();
    component.reloadRequested.subscribe(reload);
    component.toggle(PORTABLE);
    component.save();
    http
      .expectOne(URL)
      .flush({ code: 'RESOURCE_STATE_CONFLICT' }, { status: 409, statusText: 'Conflict' });
    expect(component.draft()).toEqual(['PORTABLE_X']);
    expect(component.conflict()).toBe(true);
    component.reload();
    expect(reload).toHaveBeenCalledOnce();
  });

  it('shows a real empty state for an empty portable catalog', () => {
    fixture.componentRef.setInput('overview', overview({ catalog: [FIXED] }));
    fixture.detectChanges();
    expect(text()).toContain('Aucun matériel portable');
  });

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }
});

const PORTABLE: EquipmentDefinitionResponse = {
  code: 'PORTABLE_X',
  displayName: 'Cardioscope portable',
  portable: true,
  active: true,
};

const FIXED: EquipmentDefinitionResponse = {
  code: 'FIXED_X',
  displayName: 'Équipement fixe',
  portable: false,
  active: true,
};

function overview(overrides: Partial<EquipmentOverviewResponse> = {}): EquipmentOverviewResponse {
  return {
    catalog: [PORTABLE, FIXED],
    mobile: { revision: 5, equipment: [] },
    ...overrides,
  };
}
