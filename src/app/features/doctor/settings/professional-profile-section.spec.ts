import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { describe, expect, it } from 'vitest';

import { OMNICARE_ICONS } from '../../../app.icons';
import { authInterceptor } from '../../../core/auth/auth.interceptor';
import { AuthTokenStore } from '../../../core/auth/auth-token.store';
import { RUNTIME_CONFIG } from '../../../core/config/runtime-config';
import { MeProfessionalProfileResponse } from './professional-profile-api.models';
import { ProfessionalProfileSection } from './professional-profile-section';

function profile(overrides: Partial<MeProfessionalProfileResponse> = {}): MeProfessionalProfileResponse {
  return {
    userId: 'doctor-1',
    professionalLicenseNumber: 'LIC-2020-001',
    specialty: 'Medecine generale',
    governorate: 'Tunis',
    affiliatedClinicId: 'clinic-9',
    alsoIndependent: true,
    verifiedAt: '2026-01-10T09:00:00Z',
    mfaMethod: 'NONE',
    consultationPriceTnd: 60,
    experienceYears: 12,
    practiceLatitude: 36.8065,
    practiceLongitude: 10.1815,
    practiceCity: 'Tunis',
    acceptingNewPatients: true,
    subSpecialties: null,
    languages: ['Francais', 'Arabe'],
    areasOfCare: null,
    expertise: null,
    visitReasons: null,
    patientAgeGroups: null,
    consultationTypes: null,
    biography: 'Generaliste a Tunis.',
    updatedAt: '2026-09-24T01:35:00Z',
    ...overrides,
  };
}

const PROFILE_URL = '/api/v1/me/professional-profile';

describe('ProfessionalProfileSection', () => {
  let fixture: ComponentFixture<ProfessionalProfileSection>;
  let component: ProfessionalProfileSection;
  let http: HttpTestingController;
  let host: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ProfessionalProfileSection],
      providers: [
        provideNzIcons(OMNICARE_ICONS),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: '/api/v1' } },
      ],
    });
    const tokens = TestBed.inject(AuthTokenStore);
    tokens.setSession({
      accessToken: 'doctor-access-token',
      tokenType: 'Bearer',
      expiresAt: '2026-09-24T12:10:00Z',
      refreshToken: 'doctor-refresh-token',
      refreshExpiresAt: '2026-09-25T00:00:00Z',
      user: { id: 'doctor-1', role: 'DOCTOR', mustChangePassword: false },
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ProfessionalProfileSection);
    component = fixture.componentInstance;
    host = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function flushProfile(data: MeProfessionalProfileResponse = profile()): void {
    http
      .expectOne((candidate) => candidate.url === PROFILE_URL)
      .flush(data);
    fixture.detectChanges();
  }

  function expectPatch(): { body: unknown; flush: (data: unknown, options?: { status: number; statusText: string }) => void } {
    const request = http.expectOne(
      (candidate) => candidate.url === PROFILE_URL && candidate.method === 'PATCH',
    );
    return {
      body: request.request.body,
      flush: (data: unknown, options?: { status: number; statusText: string }) => request.flush(data as never, options),
    };
  }

  function expectRead(data: MeProfessionalProfileResponse = profile()): void {
    http
      .expectOne((candidate) => candidate.url === PROFILE_URL && candidate.method === 'GET')
      .flush(data);
    fixture.detectChanges();
  }

  it('loads the profile and shows editable and read-only fields', async () => {
    flushProfile();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(host.textContent).toContain('LIC-2020-001');
    expect(host.textContent).toContain('Francais');
    const specialtyInput = host.querySelector<HTMLInputElement>('#pp-specialty');
    expect(specialtyInput?.value).toBe('Medecine generale');
  });

  it('renders the administered (read-only) fields with their labels', () => {
    flushProfile();
    expect(host.textContent).toContain('Numero de licence');
    expect(host.textContent).toContain('Gouvernorat');
    expect(host.textContent).toContain('Verifie le');
    expect(host.textContent).toContain('2026-01-10');
    expect(host.textContent).toContain('Oui');
    expect(host.textContent).toContain('clinic-9');
  });

  it('keeps the specialty editable while province is only displayed', async () => {
    flushProfile();
    await fixture.whenStable();
    fixture.detectChanges();
    const specialtyInput = host.querySelector<HTMLInputElement>('#pp-specialty');
    expect(specialtyInput).not.toBeNull();
    expect(specialtyInput?.value).toBe('Medecine generale');
    const editableGovernorate = host.querySelector<HTMLInputElement>('#governorate');
    expect(editableGovernorate).toBeNull();
  });

  it('saves only changed fields and re-reads the profile (write-then-read)', () => {
    flushProfile();
    component.updateScalar('specialty', 'Cardiologie');
    component.save();

    const patch = expectPatch();
    expect(patch.body).toEqual({ specialty: 'Cardiologie' });
    patch.flush(profile({ specialty: 'Cardiologie' }));

    expectRead(profile({ specialty: 'Cardiologie' }));

    expect(component.saved()).toBe('Profil mis a jour.');
    expect(component.draft().specialty).toBe('Cardiologie');
  });

  it('sends an emptied list as an empty array and leaves other lists untouched', () => {
    flushProfile(profile({ languages: ['Francais', 'Arabe'] }));
    component.updateList('languages', []);
    component.save();

    const patch = expectPatch();
    expect(patch.body).toEqual({ languages: [] });
    patch.flush(profile({ languages: [] }));
    expectRead(profile({ languages: [] }));
    expect(component.draft().languages).toEqual([]);
  });

  it('saves the acceptingNewPatients toggle when toggled', () => {
    flushProfile();
    component.updateBoolean(false);
    component.save();

    const patch = expectPatch();
    expect(patch.body).toEqual({ acceptingNewPatients: false });
    patch.flush(profile({ acceptingNewPatients: false }));
    expectRead(profile({ acceptingNewPatients: false }));
    expect(component.saved()).toBe('Profil mis a jour.');
  });

  it('short-circuits when nothing changed without calling the API', () => {
    flushProfile();
    component.save();
    expect(component.saved()).toBe('Aucune modification a enregistrer.');
  });

  it('blocks the save when client-side validation fails', () => {
    flushProfile();
    component.updateScalar('practiceLatitude', '999');
    component.save();
    expect(component.fieldErrors().practiceLatitude).toBeDefined();
    expect(component.saveError()).toBe('Corrigez les erreurs indiquees avant d\'enregistrer.');
  });

  it('surfaces the backend message on a 400 response', () => {
    flushProfile();
    component.updateScalar('specialty', 'Cardiologie');
    component.save();
    const patch = expectPatch();
    patch.flush(
      { message: 'At least one field must be provided.', fieldErrors: { specialty: 'Trop long' } },
      { status: 400, statusText: 'Bad Request' },
    );
    fixture.detectChanges();
    expect(component.saveError()).toContain('At least one field must be provided.');
  });

  it('maps backend field errors back onto the form fields', () => {
    flushProfile();
    component.updateScalar('specialty', 'Cardiologie');
    component.save();
    const patch = expectPatch();
    patch.flush(
      { message: 'Validation failed', fieldErrors: { consultationPriceTnd: 'must be > 0', specialty: 'Trop long' } },
      { status: 400, statusText: 'Bad Request' },
    );
    fixture.detectChanges();
    expect(component.fieldErrors().consultationPriceTnd).toBe('must be > 0');
  });

  it('shows a re-login prompt when the save is rejected with 403', () => {
    flushProfile();
    component.updateScalar('specialty', 'Cardiologie');
    component.save();
    const patch = expectPatch();
    patch.flush({ message: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();
    expect(component.authError()).toBe('Votre session n\'est plus valide. Reconnectez-vous pour continuer.');
    expect(host.textContent).toContain('Se reconnecter');
  });

  it('shows a graceful error when the profile cannot be found', () => {
    http
      .expectOne((candidate) => candidate.url === PROFILE_URL)
      .flush({ message: 'Not Found' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(component.loadError()).toBe('Profil professionnel introuvable pour votre compte.');
    expect(host.textContent).toContain('Reessayer');
  });

  it('fills the coordinates from the browser location', async () => {
    const original = navigator.geolocation;
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (
          success: (position: { coords: { latitude: number; longitude: number } }) => void,
        ) => success({ coords: { latitude: 36.8995, longitude: 10.1892 } }),
      },
    });
    try {
      flushProfile();
      await component.useCurrentLocation();
      expect(component.draft().practiceLatitude).toBe('36.899500');
      expect(component.draft().practiceLongitude).toBe('10.189200');
    } finally {
      Object.defineProperty(navigator, 'geolocation', { configurable: true, value: original });
    }
  });
});