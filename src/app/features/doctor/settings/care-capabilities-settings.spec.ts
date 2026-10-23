import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { describe, expect, it, vi } from 'vitest';

import { OMNICARE_ICONS } from '../../../app.icons';
import { AuthService } from '../../../core/auth/auth.service';
import { RUNTIME_CONFIG } from '../../../core/config/runtime-config';
import { CareCapabilitiesSettings } from './care-capabilities-settings';

const URL = '/api/v1/me/care-capabilities';

describe('CareCapabilitiesSettings', () => {
  let fixture: ComponentFixture<CareCapabilitiesSettings>;
  let component: CareCapabilitiesSettings;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CareCapabilitiesSettings],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNzIcons(OMNICARE_ICONS),
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: '/api/v1' } },
        { provide: AuthService, useValue: { logout: vi.fn() } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CareCapabilitiesSettings);
    fixture.componentRef.setInput('activeCabinetStatus', 'available');
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('renders only the three V1 capabilities and explains capability is not availability', () => {
    http
      .expectOne(URL)
      .flush({ revision: 2, capabilities: ['CABINET', 'HOME_VISIT', 'URGENT_HOME'] });
    fixture.detectChanges();
    const content = text();
    expect(content).toContain('Consultation au cabinet');
    expect(content).not.toContain('Visite à domicile');
    expect(content).toContain('Urgence à domicile');
    expect(content).toContain('Urgence au cabinet');
    expect(content).toContain('ni votre disponibilité actuelle');
    expect(content).not.toContain('Teleconsultation');
    expect(content).not.toContain('maintenant disponible');
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelectorAll('.care-capabilities__option')).toHaveLength(3);
    expect(root.querySelectorAll('.care-capabilities__option-icon')).toHaveLength(3);
    expect(root.querySelectorAll('[role="switch"]')).toHaveLength(3);
    expect(root.querySelectorAll('oc-status-badge')).toHaveLength(2);
    expect(component.baseline()).toEqual(['CABINET', 'HOME_VISIT', 'URGENT_HOME']);
    expect(component.draft()).toEqual(['CABINET', 'HOME_VISIT', 'URGENT_HOME']);
  });

  it('preserves a historical hidden HOME_VISIT during a full-replacement save', () => {
    http.expectOne(URL).flush({ revision: 2, capabilities: ['CABINET', 'HOME_VISIT'] });
    component.toggle(option('URGENT_HOME'));
    component.save();
    const request = http.expectOne(URL);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({
      expectedRevision: 2,
      capabilities: ['CABINET', 'HOME_VISIT', 'URGENT_HOME'],
    });
    request.flush({ revision: 3, capabilities: ['CABINET', 'HOME_VISIT', 'URGENT_HOME'] });
    expect(component.revision()).toBe(3);
    expect(component.dirty()).toBe(false);
  });

  it('preserves selections on a stale conflict and reloads only intentionally', () => {
    http.expectOne(URL).flush({ revision: 2, capabilities: [] });
    component.toggle(option('URGENT_HOME'));
    component.save();
    http
      .expectOne(URL)
      .flush({ code: 'RESOURCE_STATE_CONFLICT' }, { status: 409, statusText: 'Conflict' });
    expect(component.draft()).toEqual(['URGENT_HOME']);
    expect(component.conflict()).toBe(true);
    http.expectNone(URL);

    component.load();
    http.expectOne(URL).flush({ revision: 4, capabilities: ['URGENT_HOME'] });
    expect(component.draft()).toEqual(['URGENT_HOME']);
  });

  it('prevents adding cabinet modes when there is no active cabinet', () => {
    http.expectOne(URL).flush({ revision: 0, capabilities: [] });
    fixture.componentRef.setInput('activeCabinetStatus', 'none');
    fixture.detectChanges();
    component.toggle(option('CABINET'));
    component.toggle(option('URGENT_CABINET'));
    expect(component.draft()).toEqual([]);
    expect(text()).toContain('Ajoutez d’abord un cabinet actif');
    const switches = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
      '[role="switch"]',
    );
    expect(switches[0]?.disabled).toBe(true);
    expect(switches[1]?.disabled).toBe(false);
    expect(switches[2]?.disabled).toBe(true);
  });

  it('allows URGENT_HOME without HOME_VISIT or an active Cabinet', () => {
    http.expectOne(URL).flush({ revision: 5, capabilities: [] });
    fixture.componentRef.setInput('activeCabinetStatus', 'none');
    fixture.detectChanges();

    component.toggle(option('URGENT_HOME'));
    component.save();

    const request = http.expectOne(URL);
    expect(request.request.body).toEqual({
      expectedRevision: 5,
      capabilities: ['URGENT_HOME'],
    });
    request.flush({ revision: 6, capabilities: ['URGENT_HOME'] });
    expect(component.baseline()).toEqual(['URGENT_HOME']);
  });

  it('uses a scoped skeleton while capability state is loading', () => {
    expect(
      (fixture.nativeElement as HTMLElement).querySelector(
        '[aria-label="Chargement des modes proposés"]',
      ),
    ).not.toBeNull();
    http.expectOne(URL).flush({ revision: 0, capabilities: [] });
  });

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function option(value: 'CABINET' | 'URGENT_HOME' | 'URGENT_CABINET') {
    const match = component.options.find((candidate) => candidate.value === value);
    if (!match) throw new Error(`Missing visible capability option: ${value}`);
    return match;
  }
});
