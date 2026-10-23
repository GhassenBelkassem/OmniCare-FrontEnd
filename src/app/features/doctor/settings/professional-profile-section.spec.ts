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

function profile(
  overrides: Partial<MeProfessionalProfileResponse> = {},
): MeProfessionalProfileResponse {
  return {
    userId: 'doctor-1',
    firstName: 'Amina',
    lastName: 'Ben Salah',
    displayName: 'Dr Amina Ben Salah',
    photoUrl: null,
    professionalLicenseNumber: 'LIC-2020-001',
    specialty: 'Medecine generale',
    governorate: 'Tunis',
    affiliatedClinicId: 'clinic-9',
    affiliatedClinicName: 'Clinique Les Oliviers',
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
    revision: 7,
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
    http.expectOne((candidate) => candidate.url === PROFILE_URL).flush(data);
    fixture.detectChanges();
    http.expectOne('/api/v1/me/professional-profile/education').flush([]);
    http.expectOne('/api/v1/me/professional-profile/certifications').flush([]);
    fixture.detectChanges();
  }

  function expectPatch(): {
    body: unknown;
    flush: (data: unknown, options?: { status: number; statusText: string }) => void;
  } {
    const request = http.expectOne(
      (candidate) => candidate.url === PROFILE_URL && candidate.method === 'PATCH',
    );
    return {
      body: request.request.body,
      flush: (data: unknown, options?: { status: number; statusText: string }) =>
        request.flush(data as never, options),
    };
  }

  function card(title: string): HTMLElement {
    const match = [...host.querySelectorAll<HTMLElement>('.oc-card')].find(
      (candidate) => candidate.querySelector('.oc-card__title')?.textContent?.trim() === title,
    );
    if (match === undefined) throw new Error(`Card not found: ${title}`);
    return match;
  }

  it('renders a scoped Profile header and structured sections in the required order', () => {
    flushProfile();
    expect(host.querySelector('#professional-profile-title')?.textContent).toContain('Profil');
    expect(host.textContent).toContain(
      'Gérez les informations visibles dans votre profil professionnel et dans l’annuaire des médecins.',
    );
    expect(
      [...host.querySelectorAll<HTMLElement>('.oc-card__title')].map((title) =>
        title.textContent?.trim(),
      ),
    ).toEqual([
      'Identité',
      'Informations professionnelles',
      'Expertise & prise en charge',
      'Biographie',
      'Informations administrées',
      'Formation',
      'Certifications',
    ]);
  });

  it('shows a stable skeleton layout while the profile is loading', () => {
    expect(host.querySelector('[aria-label="Chargement du profil professionnel"]')).not.toBeNull();
    expect(host.querySelectorAll('oc-skeleton').length).toBe(6);
    flushProfile();
  });

  it('loads the profile and shows editable and read-only fields', async () => {
    flushProfile();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(host.textContent).toContain('LIC-2020-001');
    expect(host.textContent).toContain('Francais');
    expect(host.textContent).toContain('Dr Amina Ben Salah');
    const specialtyInput = host.querySelector<HTMLInputElement>('#pp-specialty');
    expect(specialtyInput?.value).toBe('Medecine generale');
  });

  it('presents identity as read-only account information', () => {
    flushProfile();
    const identity = card('Identité');
    expect(identity.textContent).toContain('Identité OmniCare');
    expect(identity.textContent).toContain('ne sont pas modifiables ici');
    expect(identity.querySelector('input, textarea, select')).toBeNull();
  });

  it('removes legacy Doctor-level location controls from the Profile UI', () => {
    flushProfile();
    expect(host.querySelector('#pp-city')).toBeNull();
    expect(host.querySelector('#pp-latitude')).toBeNull();
    expect(host.querySelector('#pp-longitude')).toBeNull();
    expect(host.textContent).not.toContain('Ville de pratique');
    expect(host.textContent).not.toContain('Utiliser ma position actuelle');
  });

  it('renders the administered (read-only) fields with their labels', () => {
    flushProfile();
    expect(host.textContent).toContain('Numéro de licence');
    expect(host.textContent).toContain('Gouvernorat');
    expect(host.textContent).toContain('Vérifié le');
    expect(host.textContent).toContain('2026-01-10');
    expect(host.textContent).toContain('Oui');
    expect(host.textContent).not.toContain('Clinique affiliée');
    expect(host.textContent).not.toContain('Clinique Les Oliviers');
    expect(host.textContent).not.toContain('clinic-9');
    const administered = card('Informations administrées');
    expect(administered.querySelectorAll('dt').length).toBe(4);
    expect(administered.querySelector('input, textarea, select')).toBeNull();
  });

  it('does not present the legacy affiliation as operational Clinic membership', () => {
    const internalId = '550e8400-e29b-41d4-a716-446655440000';
    flushProfile(
      profile({ affiliatedClinicId: internalId, affiliatedClinicName: 'Clinique Les Oliviers' }),
    );
    expect(host.textContent).not.toContain('Clinique affiliée');
    expect(host.textContent).not.toContain('Clinique Les Oliviers');
    expect(host.textContent).not.toContain(internalId);
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

  it('saves only changed fields with the expected revision and adopts the response revision', () => {
    flushProfile();
    component.updateScalar('specialty', 'Cardiologie');
    component.save();

    const patch = expectPatch();
    expect(patch.body).toEqual({ specialty: 'Cardiologie', expectedRevision: 7 });
    patch.flush(profile({ specialty: 'Cardiologie', revision: 8 }));

    expect(component.saved()).toBe('Profil mis à jour.');
    expect(component.draft().specialty).toBe('Cardiologie');
    expect(component.profile()?.revision).toBe(8);
  });

  it('sends an emptied list as an empty array and leaves other lists untouched', () => {
    flushProfile(profile({ languages: ['Francais', 'Arabe'] }));
    component.updateList('languages', []);
    component.save();

    const patch = expectPatch();
    expect(patch.body).toEqual({ languages: [], expectedRevision: 7 });
    patch.flush(profile({ languages: [], revision: 8 }));
    expect(component.draft().languages).toEqual([]);
  });

  it('saves the acceptingNewPatients toggle when toggled', () => {
    flushProfile();
    component.updateBoolean(false);
    component.save();

    const patch = expectPatch();
    expect(patch.body).toEqual({ acceptingNewPatients: false, expectedRevision: 7 });
    patch.flush(profile({ acceptingNewPatients: false, revision: 8 }));
    expect(component.saved()).toBe('Profil mis à jour.');
  });

  it('updates the accepting-new-patients draft through the semantic switch', () => {
    flushProfile();
    const toggle = host.querySelector<HTMLElement>('oc-switch [role="switch"]');
    expect(toggle?.getAttribute('role')).toBe('switch');
    toggle?.click();
    fixture.detectChanges();
    expect(component.draft().acceptingNewPatients).toBe(false);
  });

  it('keeps tag-entry interactions and premium chips functional', async () => {
    flushProfile(profile({ languages: ['Français'] }));
    await fixture.whenStable();
    fixture.detectChanges();
    const languageInput = host.querySelector<HTMLInputElement>('#pp-list-languages');
    expect(languageInput).not.toBeNull();
    languageInput!.value = 'Arabe';
    languageInput!.dispatchEvent(new Event('input'));
    languageInput!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.draft().languages).toEqual(['Français', 'Arabe']);
    expect(
      card('Expertise & prise en charge').querySelectorAll('.oc-tag-input__chip'),
    ).toHaveLength(2);
  });

  it('renders seven icon-led expertise domains with concise placeholders and labels', async () => {
    flushProfile();
    await fixture.whenStable();
    fixture.detectChanges();
    const expertise = card('Expertise & prise en charge');
    expect(expertise.querySelectorAll('.professional-profile__expertise-domain')).toHaveLength(7);
    expect(
      expertise.querySelectorAll('.professional-profile__expertise-icon oc-icon'),
    ).toHaveLength(7);
    expect(expertise.textContent).toContain(
      'Aidez les patients à mieux comprendre votre pratique et vos domaines d’expertise.',
    );
    expect(expertise.textContent).toContain('Saisissez une valeur puis appuyez sur Entrée.');
    expect(expertise.textContent).toContain(
      'Vous pouvez aussi coller une liste séparée par des virgules.',
    );

    const placeholders = [
      ...expertise.querySelectorAll<HTMLInputElement>('.oc-tag-input__text'),
    ].map((input) => input.placeholder);
    expect(placeholders).toEqual([
      'Ajouter une sous-spécialité',
      'Ajouter une langue',
      'Ajouter un domaine de soins',
      'Ajouter une expertise',
      'Ajouter un motif',
      'Ajouter une tranche d’âge',
      'Ajouter une modalité',
    ]);
    expect(expertise.textContent).toContain('Modalités de consultation');
    expect(expertise.textContent).toContain('Information descriptive affichée aux patients.');
    expect(expertise.textContent).toContain('n’activent aucun service');
    expect(expertise.textContent).toContain('l’éligibilité aux demandes');
    expect(expertise.querySelector('label[for="pp-list-languages"]')?.textContent).toContain(
      'Langues',
    );
    expect(
      expertise.querySelector('#pp-list-languages')?.getAttribute('aria-describedby'),
    ).toContain('pp-list-languages-hint');
    expect(expertise.querySelector('[aria-label="Retirer Francais"]')).not.toBeNull();
  });

  it('renders the biography writing surface, helper, and character count', async () => {
    flushProfile();
    await fixture.whenStable();
    fixture.detectChanges();
    const biography = card('Biographie');
    expect(biography.querySelector<HTMLTextAreaElement>('#pp-biography')?.value).toBe(
      'Generaliste a Tunis.',
    );
    expect(biography.textContent).toContain('5 000 caractères maximum');
    expect(biography.textContent).toContain('20 / 5000');
  });

  it('short-circuits when nothing changed without calling the API', () => {
    flushProfile();
    component.save();
    expect(component.saved()).toBe('Aucune modification a enregistrer.');
  });

  it('blocks the save when client-side validation fails', () => {
    flushProfile();
    component.updateScalar('consultationPriceTnd', 'invalid');
    component.save();
    expect(component.fieldErrors().consultationPriceTnd).toBeDefined();
    expect(component.saveError()).toBe("Corrigez les erreurs indiquees avant d'enregistrer.");
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
    expect(component.saveError()).toContain('Données invalides');
  });

  it('maps backend field errors back onto the form fields', () => {
    flushProfile();
    component.updateScalar('specialty', 'Cardiologie');
    component.save();
    const patch = expectPatch();
    patch.flush(
      {
        message: 'Validation failed',
        fieldErrors: { consultationPriceTnd: 'must be > 0', specialty: 'Trop long' },
      },
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
    expect(component.authError()).toBe(
      'Votre session n’est plus valide. Reconnectez-vous pour continuer.',
    );
    expect(host.textContent).toContain('Se reconnecter');
  });

  it('preserves local input and requires an intentional reload after a stale revision', () => {
    flushProfile();
    component.updateScalar('specialty', 'Cardiologie');
    component.save();
    const patch = expectPatch();
    patch.flush(
      { code: 'RESOURCE_STATE_CONFLICT', title: 'Resource has changed' },
      { status: 409, statusText: 'Conflict' },
    );
    fixture.detectChanges();

    expect(component.conflict()).toBe(true);
    expect(component.draft().specialty).toBe('Cardiologie');
    expect(host.textContent).toContain('Recharger les données');

    component.reloadServerProfile();
    http.expectOne(PROFILE_URL).flush(profile({ specialty: 'Neurologie', revision: 8 }));
    fixture.detectChanges();
    expect(component.conflict()).toBe(false);
    expect(component.draft().specialty).toBe('Neurologie');
  });

  it('shows a graceful error when the profile cannot be found', () => {
    http
      .expectOne((candidate) => candidate.url === PROFILE_URL)
      .flush({ message: 'Not Found' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(component.loadError()).toBe('Profil professionnel introuvable pour votre compte.');
    expect(host.textContent).toContain('Réessayer');
  });
});
