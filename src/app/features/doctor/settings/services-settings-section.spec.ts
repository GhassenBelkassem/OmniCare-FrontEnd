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
import { CareCapabilitiesSettings } from './care-capabilities-settings';
import { PracticeLocationResponse } from './practice-location-api.models';
import { ServicesSettingsSection } from './services-settings-section';
import { UrgentCareConfigurationSettings } from './urgent-care-configuration-settings';
import { UrgentCareReadinessSettings } from './urgent-care-readiness-settings';

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
    flushUrgentConfiguration(http, 1);
    flushReadiness(http, 1);
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
    flushUrgentConfiguration(http, 0);
    flushReadiness(http, 0);
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
    expect(content).toContain('Configuration permanente des urgences');
    expect(content).toContain('Les valeurs déjà enregistrées restent conservées');
    expect(content).not.toContain('Tarif de consultation à domicile');
    expect(content).not.toContain('Bilan sanguin');
  });

  it('distinguishes selected capability drafts from the canonical backend set', () => {
    http
      .expectOne('/api/v1/me/care-capabilities')
      .flush({ revision: 4, capabilities: ['URGENT_HOME'] });
    flushUrgentConfiguration(http, 4);
    flushReadiness(http, 4);
    http.expectOne('/api/v1/me/practice-locations').flush([location('cabinet-a', 'Cabinet A')]);
    http.expectOne('/api/v1/me/equipment').flush({
      catalog: [],
      mobile: { revision: 0, equipment: [] },
    });
    fixture.detectChanges();

    const capabilities = fixture.debugElement.query(By.directive(CareCapabilitiesSettings))
      .componentInstance as CareCapabilitiesSettings;
    const configuration = fixture.debugElement.query(By.directive(UrgentCareConfigurationSettings))
      .componentInstance as UrgentCareConfigurationSettings;
    expect(configuration.homeEnabled()).toBe(true);
    expect(configuration.homeActivationPending()).toBe(false);
    expect(configuration.cabinetEnabled()).toBe(false);

    capabilities.toggle(capabilities.options.find((option) => option.value === 'URGENT_CABINET')!);
    fixture.detectChanges();
    expect(configuration.cabinetEnabled()).toBe(true);
    expect(configuration.cabinetActivationPending()).toBe(true);
    expect(configuration.capabilityChangesPending()).toBe(true);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Enregistrez d’abord « Urgence au cabinet »',
    );

    capabilities.save();
    http.expectOne('/api/v1/me/care-capabilities').flush({
      revision: 5,
      capabilities: ['URGENT_HOME', 'URGENT_CABINET'],
    });
    flushReadiness(http, 5);
    fixture.detectChanges();
    expect(configuration.cabinetActivationPending()).toBe(false);
    expect(configuration.capabilityChangesPending()).toBe(false);
  });

  it('refreshes readiness after either save without replacing a dirty urgent draft', () => {
    http.expectOne('/api/v1/me/care-capabilities').flush({ revision: 1, capabilities: [] });
    flushUrgentConfiguration(http, 1);
    flushReadiness(http, 1);
    http.expectOne('/api/v1/me/practice-locations').flush([]);
    http.expectOne('/api/v1/me/equipment').flush({
      catalog: [],
      mobile: { revision: 0, equipment: [] },
    });
    fixture.detectChanges();

    const capabilities = fixture.debugElement.query(By.directive(CareCapabilitiesSettings))
      .componentInstance as CareCapabilitiesSettings;
    const configuration = fixture.debugElement.query(By.directive(UrgentCareConfigurationSettings))
      .componentInstance as UrgentCareConfigurationSettings;
    const readiness = fixture.debugElement.query(By.directive(UrgentCareReadinessSettings))
      .componentInstance as UrgentCareReadinessSettings;

    configuration.form.controls.homeFeeTnd.setValue('87.500');
    expect(configuration.dirty()).toBe(true);
    readiness.refresh();
    flushReadiness(http, 1);
    expect(configuration.form.controls.homeFeeTnd.value).toBe('87.500');
    expect(configuration.dirty()).toBe(true);

    capabilities.toggle(capabilities.options.find((option) => option.value === 'URGENT_HOME')!);
    capabilities.save();
    http.expectOne('/api/v1/me/care-capabilities').flush({
      revision: 2,
      capabilities: ['URGENT_HOME'],
    });
    flushReadiness(http, 2);
    expect(configuration.form.controls.homeFeeTnd.value).toBe('87.500');

    configuration.save();
    http
      .expectOne('/api/v1/me/care-capabilities/urgent-configuration')
      .flush(
        '{"revision":3,"home":{"consultationFeeTnd":87.500,"feeConfigured":true,"maxTravelKm":null,"maxTravelDistanceConfigured":false},"cabinet":{"consultationFeeTnd":null,"feeConfigured":false}}',
      );
    flushReadiness(http, 3);

    expect(readiness.readiness()?.revision).toBe(3);
    expect(configuration.dirty()).toBe(false);
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

function flushUrgentConfiguration(http: HttpTestingController, revision: number): void {
  http
    .expectOne('/api/v1/me/care-capabilities/urgent-configuration')
    .flush(
      `{"revision":${revision},"home":{"consultationFeeTnd":null,"feeConfigured":false,"maxTravelKm":null,"maxTravelDistanceConfigured":false},"cabinet":{"consultationFeeTnd":null,"feeConfigured":false}}`,
    );
}

function flushReadiness(http: HttpTestingController, revision: number): void {
  http.expectOne('/api/v1/me/care-capabilities/urgent-configuration/readiness').flush({
    revision,
    professionalEligible: true,
    home: {
      capabilityEnabled: false,
      configurationReady: false,
      runtimeAvailabilityIntent: false,
      effectiveCurrentEligibility: false,
      blockingReasons: ['CAPABILITY_DISABLED'],
    },
    cabinet: {
      capabilityEnabled: false,
      configurationReady: false,
      runtimeAvailabilityIntent: false,
      effectiveCurrentEligibility: false,
      blockingReasons: ['CAPABILITY_DISABLED'],
    },
    completeLiveMatchingEligibilityEvaluated: false,
    evaluatedAt: '2026-10-15T10:00:00Z',
  });
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
