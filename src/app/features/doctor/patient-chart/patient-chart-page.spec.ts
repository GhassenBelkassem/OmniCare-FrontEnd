import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { provideNzIcons } from 'ng-zorro-antd/icon';

import { OMNICARE_ICONS } from '../../../app.icons';
import { RUNTIME_CONFIG } from '../../../core/config/runtime-config';
import type { PracticePatientDto } from '../practice-patient-api.models';
import { PatientChartPage } from './patient-chart-page';

function patientDto(overrides: Partial<PracticePatientDto> = {}): PracticePatientDto {
  return {
    id: 'patient-one',
    doctorId: 'doctor-1',
    firstName: 'Amira',
    lastName: 'Ben Salah',
    dateOfBirth: '1985-03-12',
    sex: 'F',
    phone: '+216 20 000 303',
    email: 'amira@example.test',
    address: '42 rue Habib-Bourguiba, Tunis',
    source: 'OMNICARE',
    linkedOmniCareUserId: 'user-1',
    mrsPatientId: 'mrs-never-rendered',
    mrsProvisioned: true,
    possibleOmniCareMatch: false,
    createdAt: '2024-02-12T09:00:00Z',
    updatedAt: '2026-10-20T09:00:00Z',
    ...overrides,
  };
}

describe('PatientChartPage', () => {
  let fixture: ComponentFixture<PatientChartPage>;
  let http: HttpTestingController;
  let patientId: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  beforeEach(() => {
    patientId = new BehaviorSubject(convertToParamMap({ id: 'patient-one' }));
    const queryParams = new BehaviorSubject(convertToParamMap({}));
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideNzIcons(OMNICARE_ICONS),
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: '/api/v1' } },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: patientId.asObservable(),
            queryParamMap: queryParams.asObservable(),
            snapshot: { queryParamMap: convertToParamMap({}) },
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PatientChartPage);
    fixture.detectChanges();
  });

  afterEach(() => http.verify({ ignoreCancelled: true }));

  it('renders only authoritative administrative DTO fields in the locked presentation', () => {
    http.expectOne('/api/v1/patients/patient-one').flush(patientDto());
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Amira Ben Salah');
    expect(text).toContain('+216 20 000 303');
    expect(text).toContain('Lié à OmniCare');
    expect(text).toContain('Dossier médical protégé');
    expect(text).toContain('Non disponible');
    expect(text).not.toContain('mrs-never-rendered');
    expect(text).not.toMatch(/diagnostic|allergie|médicament|prescription|groupe sanguin/i);
  });

  it('cancels the prior request and clears the prior identity when the route ID changes', () => {
    const first = http.expectOne('/api/v1/patients/patient-one');
    first.flush(patientDto());
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Amira Ben Salah');

    patientId.next(convertToParamMap({ id: 'patient-two' }));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Amira Ben Salah');
    expect(fixture.nativeElement.textContent).toContain('Chargement du patient');

    http
      .expectOne('/api/v1/patients/patient-two')
      .flush(patientDto({ id: 'patient-two', firstName: 'Leila', lastName: 'Mansouri' }));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Leila Mansouri');
    expect(fixture.nativeElement.textContent).not.toContain('Amira Ben Salah');
  });

  it.each([
    [404, 'Patient introuvable'],
    [403, 'Accès non autorisé'],
    [500, 'Impossible de charger le patient'],
  ])('maps HTTP %i to a safe non-clinical state', (status, heading) => {
    http.expectOne('/api/v1/patients/patient-one').flush(null, {
      status,
      statusText: 'Failure',
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(heading);
    expect(fixture.nativeElement.textContent).not.toContain('Amira Ben Salah');
    expect(fixture.nativeElement.querySelector('main[role="tabpanel"]')).toBeNull();
  });

  it('retries the same authoritative patient request after a server failure', () => {
    http.expectOne('/api/v1/patients/patient-one').flush(null, {
      status: 500,
      statusText: 'Failure',
    });
    fixture.detectChanges();

    fixture.nativeElement.querySelector('oc-button button').click();
    http.expectOne('/api/v1/patients/patient-one').flush(patientDto());
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Amira Ben Salah');
  });

  it('renders truthful fallbacks for missing administrative fields', () => {
    http.expectOne('/api/v1/patients/patient-one').flush(
      patientDto({
        firstName: '',
        lastName: '',
        dateOfBirth: null,
        sex: null,
        phone: '',
        email: null,
        address: null,
        source: 'MANUAL',
        linkedOmniCareUserId: null,
        possibleOmniCareMatch: false,
      }),
    );
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Patient sans nom');
    expect(text).toContain('Date de naissance non renseignée');
    expect(text).toContain('Non renseigné');
    expect(text).toContain('Non renseignée');
    expect(text).toContain('Non lié');
    expect(text).toContain('Saisie manuelle');
  });
});
