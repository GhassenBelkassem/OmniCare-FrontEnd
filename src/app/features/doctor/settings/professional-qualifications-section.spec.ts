import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { describe, expect, it, vi } from 'vitest';

import { AuthService } from '../../../core/auth/auth.service';
import { RUNTIME_CONFIG } from '../../../core/config/runtime-config';
import { OMNICARE_ICONS } from '../../../app.icons';
import {
  ProfessionalCertificationResponse,
  ProfessionalEducationResponse,
} from './professional-profile-api.models';
import { ProfessionalQualificationsSection } from './professional-qualifications-section';

const EDUCATION_URL = '/api/v1/me/professional-profile/education';
const CERTIFICATION_URL = '/api/v1/me/professional-profile/certifications';

describe('ProfessionalQualificationsSection', () => {
  let fixture: ComponentFixture<ProfessionalQualificationsSection>;
  let component: ProfessionalQualificationsSection;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ProfessionalQualificationsSection],
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
    fixture = TestBed.createComponent(ProfessionalQualificationsSection);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('uses scoped skeletons while education and certifications load independently', () => {
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('[aria-label="Chargement des formations"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="Chargement des certifications"]')).not.toBeNull();
    expect(host.querySelectorAll('oc-skeleton')).toHaveLength(4);
    flushInitial([], []);
  });

  it('renders intentional empty states with independent add actions', () => {
    flushInitial([], []);
    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('Aucune formation renseignée');
    expect(host.textContent).toContain('Ajoutez vos diplômes et votre parcours académique.');
    expect(host.textContent).toContain('Aucune certification renseignée');
    expect(host.textContent).toContain(
      'Ajoutez les certifications utiles à votre activité professionnelle.',
    );
    expect(
      [...host.querySelectorAll('button')].filter((button) =>
        button.textContent?.includes('Ajouter une formation'),
      ).length,
    ).toBeGreaterThan(0);
    expect(
      [...host.querySelectorAll('button')].filter((button) =>
        button.textContent?.includes('Ajouter une certification'),
      ).length,
    ).toBeGreaterThan(0);
  });

  it('renders backend education and a real certification empty state', () => {
    flushInitial([education()], []);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Doctorat en médecine');
    expect(text).toContain('Faculté de Médecine de Tunis');
    expect(text).toContain('Aucune certification renseignée');
    expect(text).not.toContain('Université de démonstration');
  });

  it('renders populated qualifications as structured items with edit and overflow actions', () => {
    flushInitial([education()], [certification()]);
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelectorAll('.qualifications__item')).toHaveLength(2);
    expect(host.textContent).toContain('Obtenu en 2018');
    expect(host.textContent).toContain('Délivrée en 2022');
    expect(host.querySelectorAll('oc-action-menu')).toHaveLength(2);

    const editButton = [...host.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent?.trim() === 'Modifier',
    );
    editButton?.click();
    expect(component.dialogOpen()).toBe(true);
    expect(component.dialogKind()).toBe('education');
    expect(component.dialogEntry()?.id).toBe('education-1');
  });

  it('creates an education entry with deterministic display order', () => {
    flushInitial([], []);
    component.saveQualification({
      kind: 'education',
      id: null,
      revision: null,
      value: {
        institution: 'Faculté de Médecine de Tunis',
        qualification: 'Doctorat en médecine',
        fieldOfStudy: 'Cardiologie',
        completionYear: 2018,
        displayOrder: 0,
      },
    });
    const request = http.expectOne(EDUCATION_URL);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toMatchObject({ displayOrder: 0, completionYear: 2018 });
    request.flush(education());
    expect(component.education()).toEqual([education()]);
    expect(component.success()).toBe('Formation ajoutée.');
  });

  it('updates education with the resource revision and adopts the returned revision', () => {
    flushInitial([education()], []);
    component.saveQualification({
      kind: 'education',
      id: 'education-1',
      revision: 3,
      value: {
        institution: 'Faculté de Médecine de Tunis',
        qualification: 'Doctorat en médecine',
        fieldOfStudy: 'Cardiologie',
        completionYear: 2019,
        displayOrder: 0,
      },
    });
    const request = http.expectOne(`${EDUCATION_URL}/education-1`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toMatchObject({ expectedRevision: 3, completionYear: 2019 });
    request.flush(education({ completionYear: 2019, revision: 4 }));
    expect(component.education()[0].revision).toBe(4);
  });

  it('keeps the qualification dialog open on a stale revision and reloads only intentionally', () => {
    flushInitial([education()], []);
    component.edit('education', education());
    component.saveQualification({
      kind: 'education',
      id: 'education-1',
      revision: 3,
      value: {
        institution: 'Nouvel établissement',
        qualification: 'Doctorat en médecine',
        fieldOfStudy: null,
        completionYear: 2018,
        displayOrder: 0,
      },
    });
    http
      .expectOne(`${EDUCATION_URL}/education-1`)
      .flush({ code: 'RESOURCE_STATE_CONFLICT' }, { status: 409, statusText: 'Conflict' });
    expect(component.dialogOpen()).toBe(true);
    expect(component.dialogConflict()).toBe(true);

    component.refreshAfterConflict();
    expect(component.dialogOpen()).toBe(false);
    http.expectOne(EDUCATION_URL).flush([education({ revision: 4 })]);
    expect(component.education()[0].revision).toBe(4);
  });

  it('creates and revision-updates certifications', () => {
    flushInitial([], []);
    const value = {
      name: 'Échocardiographie clinique',
      issuer: 'Société tunisienne de cardiologie',
      issuedYear: 2022,
      expiryDate: '2028-12-31',
      displayOrder: 0,
    };
    component.saveQualification({ kind: 'certification', id: null, revision: null, value });
    http.expectOne(CERTIFICATION_URL).flush(certification());

    component.saveQualification({
      kind: 'certification',
      id: 'certification-1',
      revision: 2,
      value,
    });
    const update = http.expectOne(`${CERTIFICATION_URL}/certification-1`);
    expect(update.request.body).toMatchObject({ expectedRevision: 2, expiryDate: '2028-12-31' });
    update.flush(certification({ revision: 3 }));
    expect(component.certifications()[0].revision).toBe(3);
  });

  it('requires an explicit confirmation before deleting and updates the list on success', () => {
    const entry = certification();
    flushInitial([], [entry]);
    component.requestDelete('certification', entry);
    expect(component.deleteTarget()?.entry.id).toBe(entry.id);

    component.confirmDelete();
    expect(component.certifications()).toEqual([entry]);
    const request = http.expectOne(
      (candidate) => candidate.url === `${CERTIFICATION_URL}/${entry.id}`,
    );
    expect(request.request.method).toBe('DELETE');
    expect(request.request.params.get('expectedRevision')).toBe(String(entry.revision));
    request.flush(null);
    expect(component.certifications()).toEqual([]);
    expect(component.success()).toBe('Certification supprimée.');
  });

  it('keeps a stale-delete item visible and reloads only after an intentional action', () => {
    const entry = education();
    flushInitial([entry], []);
    component.requestDelete('education', entry);
    component.confirmDelete();

    const request = http.expectOne((candidate) => candidate.url === `${EDUCATION_URL}/${entry.id}`);
    expect(request.request.params.get('expectedRevision')).toBe(String(entry.revision));
    request.flush({ code: 'RESOURCE_STATE_CONFLICT' }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();

    expect(component.education()).toEqual([entry]);
    expect(component.deleteTarget()).toBeNull();
    expect(component.deleteConflict()).toBe('education');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Cette qualification a été modifiée ailleurs.',
    );
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Recharger les données');
    http.expectNone(EDUCATION_URL);

    component.refreshAfterDeleteConflict();
    http.expectOne(EDUCATION_URL).flush([education({ revision: 4 })]);
    expect(component.education()[0].revision).toBe(4);
  });

  function flushInitial(
    educationEntries: readonly ProfessionalEducationResponse[],
    certificationEntries: readonly ProfessionalCertificationResponse[],
  ): void {
    http.expectOne(EDUCATION_URL).flush(educationEntries);
    http.expectOne(CERTIFICATION_URL).flush(certificationEntries);
    fixture.detectChanges();
  }
});

function education(
  overrides: Partial<ProfessionalEducationResponse> = {},
): ProfessionalEducationResponse {
  return {
    id: 'education-1',
    institution: 'Faculté de Médecine de Tunis',
    qualification: 'Doctorat en médecine',
    fieldOfStudy: 'Cardiologie',
    completionYear: 2018,
    displayOrder: 0,
    revision: 3,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
    ...overrides,
  };
}

function certification(
  overrides: Partial<ProfessionalCertificationResponse> = {},
): ProfessionalCertificationResponse {
  return {
    id: 'certification-1',
    name: 'Échocardiographie clinique',
    issuer: 'Société tunisienne de cardiologie',
    issuedYear: 2022,
    expiryDate: '2028-12-31',
    displayOrder: 0,
    revision: 2,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
    ...overrides,
  };
}
