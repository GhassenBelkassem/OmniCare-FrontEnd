import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNzIcons } from 'ng-zorro-antd/icon';

import { OMNICARE_ICONS } from '../../../app.icons';
import { authInterceptor } from '../../../core/auth/auth.interceptor';
import { AuthTokenStore } from '../../../core/auth/auth-token.store';
import { RUNTIME_CONFIG } from '../../../core/config/runtime-config';
import { PracticePatientDto } from '../practice-patient-api.models';
import { PatientsPage } from './patients-page';

function patientDto(overrides: Partial<PracticePatientDto> = {}): PracticePatientDto {
  return {
    id: 'patient-1',
    doctorId: 'doctor-1',
    firstName: 'Ahmed',
    lastName: 'Ben Salah',
    dateOfBirth: '1990-04-12',
    approximateAgeYears: null,
    sex: 'M',
    phone: '+216 71 234 567',
    practiceIdentifier: null,
    email: null,
    address: null,
    source: 'MANUAL',
    linkedOmniCareUserId: null,
    mrsPatientId: null,
    mrsProvisioned: false,
    possibleOmniCareMatch: false,
    possibleDuplicate: false,
    mrsReadiness: 'PREPARING',
    externalPatientStatus: 'UNCLAIMED',
    lastConsultationAt: null,
    nextAppointmentAt: null,
    createdAt: '2026-08-21T09:00:00Z',
    updatedAt: '2026-08-21T09:00:00Z',
    ...overrides,
  };
}

function pageResponse(content: readonly PracticePatientDto[], totalElements = content.length) {
  return {
    content,
    totalElements,
    totalPages: 1,
    size: 20,
    number: 0,
    first: true,
    last: true,
    empty: content.length === 0,
  };
}

describe('PatientsPage', () => {
  let fixture: ComponentFixture<PatientsPage>;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
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
      expiresAt: '2026-08-21T12:10:00Z',
      refreshToken: 'doctor-refresh-token',
      refreshExpiresAt: '2026-08-22T00:00:00Z',
      user: { id: 'doctor-1', role: 'DOCTOR', mustChangePassword: false },
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function create(): ComponentFixture<PatientsPage> {
    fixture = TestBed.createComponent(PatientsPage);
    fixture.detectChanges();
    return fixture;
  }

  it('renders the loaded patients', () => {
    const component = create();
    const request = http.expectOne(
      (candidate) =>
        candidate.url === '/api/v1/patients' && candidate.params.get('filter') === 'ALL',
    );
    expect(request.request.params.get('page')).toBe('0');
    request.flush(
      pageResponse([
        patientDto(),
        patientDto({
          id: 'patient-2',
          firstName: 'Fatma',
          lastName: 'Trabelsi',
          source: 'OMNICARE',
          linkedOmniCareUserId: 'user-2',
        }),
      ]),
    );
    component.detectChanges();

    const rows = component.nativeElement.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    expect(component.nativeElement.textContent).toContain('Ben Salah Ahmed');
    expect(component.nativeElement.textContent).toContain('Lié à OmniCare');
  });

  it('reloads with the selected filter when the segmented control changes', () => {
    const component = create();
    http.expectOne((candidate) => candidate.url === '/api/v1/patients').flush(pageResponse([]));

    component.componentInstance.handleViewAction({
      kind: 'SELECT_CATEGORY',
      value: 'EXTERNAL',
    });
    const request = http.expectOne(
      (candidate) =>
        candidate.url === '/api/v1/patients' &&
        candidate.params.get('filter') === 'EXTERNAL' &&
        candidate.params.get('page') === '0',
    );
    request.flush(pageResponse([]));
    expect(component.componentInstance.activeFilter()).toBe('EXTERNAL');
  });

  it('debounces the search field into a server query', async () => {
    const component = create();
    http.expectOne((candidate) => candidate.url === '/api/v1/patients').flush(pageResponse([]));

    const root: HTMLElement = component.nativeElement;
    const search = root.querySelector<HTMLInputElement>('input[type="search"]');
    if (!search) {
      throw new Error('search input not rendered');
    }
    search.value = 'Trabelsi';
    search.dispatchEvent(new Event('input'));
    await new Promise((resolve) => setTimeout(resolve, 400));

    const request = http.expectOne(
      (candidate) =>
        candidate.url === '/api/v1/patients' &&
        candidate.params.get('query') === 'Trabelsi' &&
        candidate.params.get('filter') === 'ALL',
    );
    request.flush(pageResponse([]));
    expect(component.componentInstance.searchTerm()).toBe('Trabelsi');
  });

  it('shows a retry action when loading fails', () => {
    const component = create();
    http
      .expectOne((candidate) => candidate.url === '/api/v1/patients')
      .error(new ProgressEvent('network error'));

    component.detectChanges();
    expect(component.componentInstance.loadState()).toBe('error');
    expect(component.nativeElement.textContent).toContain('Impossible de charger les patients');

    component.componentInstance.handleViewAction({ kind: 'RETRY' });
    const retryRequest = http.expectOne((candidate) => candidate.url === '/api/v1/patients');
    retryRequest.flush(pageResponse([patientDto()]));
    expect(component.componentInstance.loadState()).toBe('ready');
  });

  it('opens the add-patient dialog and reloads after creation', () => {
    const component = create();
    http.expectOne((candidate) => candidate.url === '/api/v1/patients').flush(pageResponse([]));

    component.componentInstance.handleViewAction({ kind: 'ADD_PATIENT' });
    expect(component.componentInstance.addMethodDialogOpen()).toBe(true);
    expect(component.componentInstance.addDialogOpen()).toBe(false);

    component.componentInstance.chooseExternalPatient();
    expect(component.componentInstance.addDialogOpen()).toBe(true);

    component.componentInstance.onPatientCreated(
      patientDto({ id: 'patient-9', possibleOmniCareMatch: true }),
    );
    expect(component.componentInstance.lastCreated()?.id).toBe('patient-9');

    http.expectOne((candidate) => candidate.url === '/api/v1/patients').flush(pageResponse([]));
    component.detectChanges();
    expect(component.nativeElement.textContent).toContain(
      'Ahmed Ben Salah a été ajouté. Une correspondance OmniCare est possible.',
    );
    expect(component.componentInstance.totalElements()).toBe(0);
  });
});
