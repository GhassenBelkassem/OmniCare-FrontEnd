import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { describe, expect, it, vi } from 'vitest';

import { OMNICARE_ICONS } from '../../../app.icons';
import { AuthService } from '../../../core/auth/auth.service';
import { RUNTIME_CONFIG } from '../../../core/config/runtime-config';
import { UrgentCareConfigurationSettings } from './urgent-care-configuration-settings';

const URL = '/api/v1/me/care-capabilities/urgent-configuration';

describe('UrgentCareConfigurationSettings', () => {
  let fixture: ComponentFixture<UrgentCareConfigurationSettings>;
  let component: UrgentCareConfigurationSettings;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [UrgentCareConfigurationSettings],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNzIcons(OMNICARE_ICONS),
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: '/api/v1' } },
        { provide: AuthService, useValue: { logout: vi.fn() } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(UrgentCareConfigurationSettings);
    fixture.componentRef.setInput('activeCabinetStatus', 'available');
    fixture.componentRef.setInput('capabilities', ['URGENT_HOME', 'URGENT_CABINET']);
    fixture.componentRef.setInput('committedCapabilities', ['URGENT_HOME', 'URGENT_CABINET']);
    fixture.componentRef.setInput('capabilitySelectionLoaded', true);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('loads canonical HOME and CABINET values and presents permanent, non-runtime context', () => {
    http.expectOne(URL).flush(configurationJson(4));
    fixture.detectChanges();
    expect(component.form.getRawValue()).toEqual({
      homeFeeTnd: '75.000',
      maxHomeTravelKm: '20.500000',
      cabinetFeeTnd: '60.000',
    });
    const content = text();
    expect(content).toContain('Urgence à domicile');
    expect(content).toContain('Urgence au cabinet');
    expect(content).toContain('disponibilité en temps réel');
    expect(content).toContain('position GPS en direct transmise par l’application mobile');
    expect(content).toContain('cabinet actif enregistré dans l’onglet Cabinets');
    expect(content).not.toContain('Disponible pour les urgences');
  });

  it('shows only selected mode cards while preserving hidden canonical values in replacement', () => {
    http.expectOne(URL).flush(configurationJson(4));
    fixture.componentRef.setInput('capabilities', ['URGENT_HOME']);
    fixture.componentRef.setInput('committedCapabilities', ['URGENT_HOME']);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelectorAll('.urgent-configuration__group')).toHaveLength(1);
    expect(root.querySelector('#urgent-home-fee')).not.toBeNull();
    expect(root.querySelector('#urgent-cabinet-fee')).toBeNull();
    expect(component.form.controls.cabinetFeeTnd.value).toBe('60.000');

    component.form.controls.homeFeeTnd.setValue('80.125');
    component.save();
    const request = http.expectOne(URL);
    expect(request.request.body).toBe(
      '{"expectedRevision":4,"homeFeeTnd":80.125,"cabinetFeeTnd":60.000,"maxHomeTravelKm":20.500000}',
    );
    request.flush(configurationJson(5, '20.500000', '80.125', '60.000'));
  });

  it('hides the detailed form when no urgent mode is selected without clearing stored values', () => {
    http.expectOne(URL).flush(configurationJson(4));
    fixture.componentRef.setInput('capabilities', []);
    fixture.componentRef.setInput('committedCapabilities', []);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('form')).toBeNull();
    expect(text()).toContain('Les valeurs déjà enregistrées restent conservées');
    expect(component.form.getRawValue()).toEqual({
      homeFeeTnd: '75.000',
      maxHomeTravelKm: '20.500000',
      cabinetFeeTnd: '60.000',
    });
  });

  it('marks a newly selected unsaved mode and blocks configuration mutation', () => {
    http.expectOne(URL).flush(configurationJson(4));
    fixture.componentRef.setInput('capabilities', ['URGENT_HOME']);
    fixture.componentRef.setInput('committedCapabilities', []);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(text()).toContain('À enregistrer');
    expect(text()).toContain('Enregistrez d’abord « Urgence à domicile »');
    expect(root.querySelector<HTMLInputElement>('#urgent-home-fee')?.readOnly).toBe(true);

    component.form.controls.homeFeeTnd.setValue('80.000');
    component.save();
    http.expectNone(URL);
    expect(root.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
  });

  it('sends one complete replacement without losing untouched fields and adopts canonical values', () => {
    http.expectOne(URL).flush(configurationJson(4));
    component.form.controls.homeFeeTnd.setValue('80.125');
    component.save();
    component.save();
    const requests = http.match(URL);
    expect(requests).toHaveLength(1);
    expect(requests[0].request.body).toBe(
      '{"expectedRevision":4,"homeFeeTnd":80.125,"cabinetFeeTnd":60.000,"maxHomeTravelKm":20.500000}',
    );
    requests[0].flush(configurationJson(5, '20.500000', '80.125', '60.000'));
    expect(component.revision()).toBe(5);
    expect(component.dirty()).toBe(false);
  });

  it('preserves null, supports explicit zero, and avoids a same-value mutation', () => {
    http.expectOne(URL).flush(configurationJson(4, null, null, null));
    component.save();
    http.expectNone(URL);
    component.form.controls.homeFeeTnd.setValue('0.000');
    component.save();
    const request = http.expectOne(URL);
    expect(request.request.body).toBe(
      '{"expectedRevision":4,"homeFeeTnd":0.000,"cabinetFeeTnd":null,"maxHomeTravelKm":null}',
    );
    request.flush(configurationJson(5, null, '0.000', null));
  });

  it('preserves edits on conflict and reconciles untouched fields with the latest server version', () => {
    http.expectOne(URL).flush(configurationJson(4));
    component.form.controls.homeFeeTnd.setValue('90.000');
    component.save();
    http
      .expectOne(URL)
      .flush({ code: 'RESOURCE_STATE_CONFLICT' }, { status: 409, statusText: 'Conflict' });
    expect(component.conflict()).toBe(true);
    expect(component.form.controls.homeFeeTnd.value).toBe('90.000');

    component.load(true);
    http.expectOne(URL).flush(configurationJson(7, '30.000000', '75.000', '65.000'));
    expect(component.form.getRawValue()).toEqual({
      homeFeeTnd: '90.000',
      maxHomeTravelKm: '30.000000',
      cabinetFeeTnd: '65.000',
    });
    expect(component.revision()).toBe(7);
    expect(component.dirty()).toBe(true);
  });

  it('adopts a successful capability revision without clearing a dirty configuration draft', () => {
    http.expectOne(URL).flush(configurationJson(4));
    component.form.controls.cabinetFeeTnd.setValue('70.000');
    component.adoptSharedRevision(5);
    expect(component.revision()).toBe(5);
    expect(component.form.controls.cabinetFeeTnd.value).toBe('70.000');
    expect(component.dirty()).toBe(true);
  });

  it.each([
    [400, 'INVALID_URGENT_FEE', 'Un tarif urgent est invalide'],
    [403, 'FORBIDDEN', 'Votre session n’est plus valide'],
  ])('maps HTTP %i without clearing the loaded form', (status, code, message) => {
    http.expectOne(URL).flush(configurationJson(4));
    component.form.controls.cabinetFeeTnd.setValue('70.000');
    component.save();
    http.expectOne(URL).flush({ code }, { status, statusText: 'Failure' });
    expect(component.error()).toContain(message);
    expect(component.form.controls.cabinetFeeTnd.value).toBe('70.000');
  });

  it('keeps canonical values visible when a refresh fails', () => {
    http.expectOne(URL).flush(configurationJson(4));
    component.load(false);
    http.expectOne(URL).flush('offline', { status: 503, statusText: 'Unavailable' });
    expect(component.form.getRawValue()).toEqual({
      homeFeeTnd: '75.000',
      maxHomeTravelKm: '20.500000',
      cabinetFeeTnd: '60.000',
    });
  });

  it('explains the mobile GPS authority without exposing coordinates, offers, or runtime controls', () => {
    http.expectOne(URL).flush(configurationJson(1));
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelectorAll('input')).toHaveLength(3);
    expect(root.querySelector('[role="switch"]')).toBeNull();
    expect(text()).toContain('ce tableau de bord ne lit pas votre position');
    expect(text()).not.toMatch(/patient|adresse|latitude|longitude|accepter|décliner/i);
  });

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }
});

function configurationJson(
  revision: number,
  distance: string | null = '20.500000',
  homeFee: string | null = '75.000',
  cabinetFee: string | null = '60.000',
): string {
  const value = (decimal: string | null) => decimal ?? 'null';
  return `{"revision":${revision},"home":{"consultationFeeTnd":${value(homeFee)},"feeConfigured":${homeFee !== null},"maxTravelKm":${value(distance)},"maxTravelDistanceConfigured":${distance !== null}},"cabinet":{"consultationFeeTnd":${value(cabinetFee)},"feeConfigured":${cabinetFee !== null}}}`;
}
