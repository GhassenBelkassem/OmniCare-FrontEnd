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
import { CabinetEquipmentSettings } from './cabinet-equipment-settings';
import { CabinetServiceConfig } from './cabinet-service-config';
import { PracticeLocationResponse } from './practice-location-api.models';
import { ServicesSettingsSection } from './services-settings-section';

describe('ServicesSettingsSection', () => {
  let fixture: ComponentFixture<ServicesSettingsSection>;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ServicesSettingsSection],
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
    fixture = TestBed.createComponent(ServicesSettingsSection);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('loads top-level aggregates separately and lazy-loads each expanded cabinet without bleed', () => {
    http.expectOne('/api/v1/me/care-capabilities').flush({ revision: 1, capabilities: [] });
    http
      .expectOne('/api/v1/me/practice-locations')
      .flush([location('cabinet-a', 'Cabinet A'), location('cabinet-b', 'Cabinet B')]);
    http.expectOne('/api/v1/me/equipment').flush({
      catalog: [
        { code: 'DEVICE_X', displayName: 'Dispositif serveur', portable: true, active: true },
      ],
      mobile: { revision: 2, equipment: [] },
    });
    fixture.detectChanges();

    expect(http.match((request) => request.url.includes('/cabinet-a/')).length).toBe(0);
    expect(http.match((request) => request.url.includes('/cabinet-b/')).length).toBe(0);

    const cabinets = fixture.debugElement.queryAll(By.directive(CabinetServiceConfig));
    expect(cabinets).toHaveLength(2);
    const summaries = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
      '.cabinet-service-config__summary',
    );
    expect(summaries[0]?.getAttribute('aria-expanded')).toBe('false');
    expect(summaries[0]?.getAttribute('aria-controls')).toContain('cabinet-a');
    expect(summaries[0]?.textContent).not.toContain('ActifConfigurer');
    expect(summaries[0]?.querySelector('oc-status-badge')).not.toBeNull();
    expect(summaries[0]?.querySelector('.cabinet-service-config__chevron')).not.toBeNull();
    (cabinets[0].componentInstance as CabinetServiceConfig).toggle();
    fixture.detectChanges();
    expect(summaries[0]?.getAttribute('aria-expanded')).toBe('true');
    http
      .expectOne('/api/v1/me/practice-locations/cabinet-a/equipment')
      .flush({ practiceLocationId: 'cabinet-a', revision: 3, equipment: [] });
    http
      .expectOne('/api/v1/me/practice-locations/cabinet-a/coverage')
      .flush(coverage('cabinet-a', 4));
    expect(http.match((request) => request.url.includes('/cabinet-b/')).length).toBe(0);

    (cabinets[1].componentInstance as CabinetServiceConfig).toggle();
    fixture.detectChanges();
    http
      .expectOne('/api/v1/me/practice-locations/cabinet-b/equipment')
      .flush({ practiceLocationId: 'cabinet-b', revision: 9, equipment: [] });
    http
      .expectOne('/api/v1/me/practice-locations/cabinet-b/coverage')
      .flush(coverage('cabinet-b', 10));

    const equipment = fixture.debugElement.queryAll(By.directive(CabinetEquipmentSettings));
    const first = equipment[0].componentInstance as CabinetEquipmentSettings;
    const second = equipment[1].componentInstance as CabinetEquipmentSettings;
    first.toggle(first.options()[0]);
    expect(first.draft()).toEqual(['DEVICE_X']);
    expect(second.draft()).toEqual([]);
    expect(first.revision()).toBe(3);
    expect(second.revision()).toBe(9);
  });

  it('retire les anciens services statiques et indique le vrai état sans cabinet', () => {
    http.expectOne('/api/v1/me/care-capabilities').flush({ revision: 0, capabilities: [] });
    http.expectOne('/api/v1/me/practice-locations').flush([]);
    http.expectOne('/api/v1/me/equipment').flush({
      catalog: [],
      mobile: { revision: 0, equipment: [] },
    });
    fixture.detectChanges();
    const content = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(content).toContain('Aucun cabinet actif');
    expect(content).toContain('Ajoutez ou activez un cabinet');
    expect(content).not.toContain('Teleconsultation');
    expect(content).not.toContain('TND');
    expect(content).not.toContain('Bilan sanguin');
  });
});

function location(id: string, name: string): PracticeLocationResponse {
  return {
    id,
    type: 'CABINET',
    name,
    governorate: 'Tunis',
    city: 'Tunis',
    address: '1 rue du Cabinet',
    latitude: 36.8,
    longitude: 10.1,
    publicPhone: null,
    wheelchairAccessible: false,
    patientInstructions: null,
    primary: id === 'cabinet-a',
    active: true,
    revision: 1,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    gallery: [],
  };
}

function coverage(practiceLocationId: string, revision: number) {
  const claim = { acceptance: 'NOT_DECLARED' as const, provenance: null, verified: false };
  return {
    practiceLocationId,
    revision,
    cnam: claim,
    privateInsurance: claim,
    selfPay: claim,
    specificPrivateInsurerDetailsAvailable: false,
  };
}
