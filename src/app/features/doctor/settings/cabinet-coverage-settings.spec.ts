import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { describe, expect, it, vi } from 'vitest';

import { OMNICARE_ICONS } from '../../../app.icons';
import { AuthService } from '../../../core/auth/auth.service';
import { RUNTIME_CONFIG } from '../../../core/config/runtime-config';
import { CabinetCoverageSettings } from './cabinet-coverage-settings';
import { PracticeLocationCoverageResponse } from './professional-services-api.models';

const URL = '/api/v1/me/practice-locations/cabinet-a/coverage';

describe('CabinetCoverageSettings', () => {
  let fixture: ComponentFixture<CabinetCoverageSettings>;
  let component: CabinetCoverageSettings;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CabinetCoverageSettings],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNzIcons(OMNICARE_ICONS),
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: '/api/v1' } },
        { provide: AuthService, useValue: { logout: vi.fn() } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CabinetCoverageSettings);
    fixture.componentRef.setInput('locationId', 'cabinet-a');
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('renders all acceptance states with truthful CNAM, insurance, and self-pay wording', () => {
    http.expectOne(URL).flush(response());
    fixture.detectChanges();
    const content = text();
    expect(content).toContain('CNAM');
    expect(content).toContain('Assurance privée');
    expect(content).toContain('Paiement direct');
    expect(content).toContain('Non renseigné');
    expect(content).toContain('Accepté');
    expect(content).toContain('Non accepté');
    expect(content).toContain('Informations déclarées par le professionnel');
    expect(content).toContain('attestation de conventionnement CNAM');
    expect(content).not.toContain('Vérifié par OmniCare');
    expect(content).not.toContain('STAR');
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelectorAll('[role="radiogroup"]')).toHaveLength(3);
    expect(root.querySelectorAll('input[type="radio"]')).toHaveLength(9);
    expect(root.querySelectorAll('.coverage-settings__group')).toHaveLength(3);
  });

  it('saves all three values with expectedRevision and adopts the server response', () => {
    http.expectOne(URL).flush(response());
    component.form.setValue({
      cnam: 'ACCEPTED',
      privateInsurance: 'NOT_ACCEPTED',
      selfPay: 'ACCEPTED',
    });
    component.form.markAsDirty();
    component.save();
    const request = http.expectOne(URL);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({
      expectedRevision: 8,
      cnamAcceptance: 'ACCEPTED',
      privateInsuranceAcceptance: 'NOT_ACCEPTED',
      selfPayAcceptance: 'ACCEPTED',
    });
    request.flush(
      response({
        revision: 9,
        cnam: claim('ACCEPTED'),
        privateInsurance: claim('NOT_ACCEPTED'),
        selfPay: claim('ACCEPTED'),
      }),
    );
    expect(component.revision()).toBe(9);
    expect(component.form.pristine).toBe(true);
  });

  it('updates the typed reactive form through the Spartan radio group', () => {
    http.expectOne(URL).flush(response());
    fixture.detectChanges();

    const accepted = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
      '[role="radiogroup"] input[value="ACCEPTED"]',
    );
    accepted?.click();
    fixture.detectChanges();
    expect(component.form.controls.cnam.value).toBe('ACCEPTED');
    expect(component.form.dirty).toBe(true);
  });

  it('preserves coverage choices on conflict and reloads intentionally', () => {
    http.expectOne(URL).flush(response());
    component.form.controls.cnam.setValue('ACCEPTED');
    component.form.markAsDirty();
    component.save();
    http
      .expectOne(URL)
      .flush({ code: 'COVERAGE_CONFIGURATION_CONFLICT' }, { status: 409, statusText: 'Conflict' });
    expect(component.form.controls.cnam.value).toBe('ACCEPTED');
    expect(component.conflict()).toBe(true);

    component.load();
    http.expectOne(URL).flush(response({ revision: 10, cnam: claim('NOT_ACCEPTED') }));
    expect(component.form.controls.cnam.value).toBe('NOT_ACCEPTED');
  });

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }
});

function claim(acceptance: 'NOT_DECLARED' | 'ACCEPTED' | 'NOT_ACCEPTED') {
  return {
    acceptance,
    provenance: acceptance === 'NOT_DECLARED' ? null : ('DECLARED' as const),
    verified: false,
  };
}

function response(
  overrides: Partial<PracticeLocationCoverageResponse> = {},
): PracticeLocationCoverageResponse {
  return {
    practiceLocationId: 'cabinet-a',
    revision: 8,
    cnam: claim('NOT_DECLARED'),
    privateInsurance: claim('ACCEPTED'),
    selfPay: claim('NOT_ACCEPTED'),
    specificPrivateInsurerDetailsAvailable: false,
    ...overrides,
  };
}
