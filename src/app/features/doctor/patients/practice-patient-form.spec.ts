import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { RUNTIME_CONFIG } from '../../../core/config/runtime-config';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { fr_FR, provideNzI18n } from 'ng-zorro-antd/i18n';

import { OMNICARE_ICONS } from '../../../app.icons';
import { PracticePatientForm, prefillFromSearch } from './practice-patient-form';

describe('PracticePatientForm', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PracticePatientForm],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNzIcons(OMNICARE_ICONS),
        provideNzI18n(fr_FR),
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: '/api/v1' } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('preflights duplicate candidates before creating an exact-birth-date patient', () => {
    const fixture = TestBed.createComponent(PracticePatientForm);
    fixture.detectChanges();
    fixture.componentInstance.form.patchValue({
      firstName: 'Amira',
      lastName: 'Trabelsi',
      dateOfBirth: '1988-04-16',
      sex: 'F',
      phone: '+21620000303',
      practiceIdentifier: 'CAB-42',
    });

    fixture.componentInstance.submit();

    const duplicateCheck = http.expectOne('/api/v1/patients/duplicate-candidates');
    expect(duplicateCheck.request.method).toBe('POST');
    expect(duplicateCheck.request.body).toEqual({
      firstName: 'Amira',
      lastName: 'Trabelsi',
      dateOfBirth: '1988-04-16',
      sex: 'F',
      phone: '+21620000303',
      practiceIdentifier: 'CAB-42',
    });
    duplicateCheck.flush([
      {
        id: 'existing-1',
        firstName: 'Amira',
        lastName: 'Trabelsi',
        dateOfBirth: '1988-04-16',
        approximateAgeYears: null,
        phone: '+21620000303',
        practiceIdentifier: 'CAB-42',
        matchReasons: ['SAME_PHONE', 'SAME_NAME_AND_BIRTH'],
      },
    ]);

    expect(fixture.componentInstance.duplicateCandidates()).toHaveLength(1);
    http.expectNone('/api/v1/patients');

    fixture.componentInstance.createAnyway();
    const create = http.expectOne('/api/v1/patients');
    expect(create.request.body).toEqual(duplicateCheck.request.body);
    expect(create.request.headers.get('Idempotency-Key')).toMatch(/\S{8,}/);
    const created = vi.fn();
    fixture.componentInstance.created.subscribe(created);
    create.flush(patientResponse());
    expect(created).toHaveBeenCalledWith(expect.objectContaining({ id: 'patient-1' }));
  });

  it('shows a similar patient inline and lets the doctor use it instead', () => {
    const fixture = TestBed.createComponent(PracticePatientForm);
    fixture.detectChanges();
    const useExisting = vi.fn();
    fixture.componentInstance.useExisting.subscribe(useExisting);
    fixture.componentInstance.form.patchValue({
      firstName: 'Amira', lastName: 'Trabelsi', dateOfBirth: '1988-04-16', sex: 'F',
    });

    fixture.componentInstance.submit();
    http.expectOne('/api/v1/patients/duplicate-candidates').flush([
      {
        id: 'existing-1', firstName: 'Amira', lastName: 'Trabelsi', dateOfBirth: '1988-04-16',
        approximateAgeYears: null, phone: null, practiceIdentifier: null,
        matchReasons: ['SAME_NAME_AND_BIRTH'],
      },
    ]);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Patient similaire trouvé');
    expect(root.textContent).toContain('Créer quand même');
    const use = Array.from(root.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Utiliser ce patient'),
    );
    use?.click();
    expect(useExisting).toHaveBeenCalledWith('existing-1');
    http.expectNone('/api/v1/patients');
  });

  it('reuses the same Idempotency-Key when the same create command is retried', () => {
    const fixture = TestBed.createComponent(PracticePatientForm);
    fixture.detectChanges();
    fixture.componentInstance.form.patchValue({
      firstName: 'Nour',
      lastName: 'Mechergui',
      dateOfBirth: '1991-05-06',
      sex: 'F',
    });

    fixture.componentInstance.submit();
    http.expectOne('/api/v1/patients/duplicate-candidates').flush([]);
    const first = http.expectOne('/api/v1/patients');
    const firstKey = first.request.headers.get('Idempotency-Key');
    first.flush(null, { status: 503, statusText: 'Service Unavailable' });

    fixture.componentInstance.submit();
    http.expectOne('/api/v1/patients/duplicate-candidates').flush([]);
    const retry = http.expectOne('/api/v1/patients');

    expect(firstKey).toBeTruthy();
    expect(retry.request.headers.get('Idempotency-Key')).toBe(firstKey);
    retry.flush(patientResponse());
  });

  it('warns, without blocking, when the date of birth is less than a year ago', () => {
    const fixture = TestBed.createComponent(PracticePatientForm);
    fixture.detectChanges();
    const tunisDate = (offsetDays: number) =>
      new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Tunis' }).format(
        new Date(Date.now() - offsetDays * 86_400_000),
      );
    const element = fixture.nativeElement as HTMLElement;

    fixture.componentInstance.form.patchValue({
      firstName: 'Bébé',
      lastName: 'Trabelsi',
      dateOfBirth: tunisDate(11),
      sex: 'F',
    });
    fixture.detectChanges();

    expect(element.querySelector('[data-testid="recent-birth-warning"]')?.textContent).toContain(
      'Date de naissance récente — vérifiez la saisie',
    );
    expect(element.querySelector('[data-testid="birth-age"]')?.textContent).toMatch(/Âge : \d+ jours?/u);
    expect(element.textContent).not.toContain('0 an');

    fixture.componentInstance.submit();
    http.expectOne('/api/v1/patients/duplicate-candidates').flush([]);
    http.expectOne('/api/v1/patients').flush(patientResponse());

    fixture.componentInstance.form.patchValue({ dateOfBirth: '1988-04-16' });
    fixture.detectChanges();
    expect(element.querySelector('[data-testid="recent-birth-warning"]')).toBeNull();
    expect(element.querySelector('[data-testid="birth-age"]')?.textContent).toMatch(/Âge : \d+ ans/u);
  });

  it('supports an approximate age and does not require a phone number', () => {
    const fixture = TestBed.createComponent(PracticePatientForm);
    fixture.detectChanges();
    fixture.componentInstance.setApproximate(true);
    fixture.componentInstance.form.patchValue({
      firstName: 'Sami',
      lastName: 'Mansour',
      approximateAgeYears: 74,
      sex: 'M',
      phone: '',
      practiceIdentifier: '',
    });

    fixture.componentInstance.submit();
    const duplicateCheck = http.expectOne('/api/v1/patients/duplicate-candidates');
    expect(duplicateCheck.request.body).toEqual({
      firstName: 'Sami',
      lastName: 'Mansour',
      approximateAgeYears: 74,
      sex: 'M',
    });
    duplicateCheck.flush([]);
    const create = http.expectOne('/api/v1/patients');
    expect(create.request.body.phone).toBeUndefined();
    create.flush(
      patientResponse({
        firstName: 'Sami',
        lastName: 'Mansour',
        dateOfBirth: null,
        approximateAgeYears: 74,
        phone: null,
      }),
    );
  });
});

function patientResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: 'patient-1',
    doctorId: 'doctor-1',
    firstName: 'Amira',
    lastName: 'Trabelsi',
    dateOfBirth: '1988-04-16',
    approximateAgeYears: null,
    sex: 'F',
    phone: '+21620000303',
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
    createdAt: '2026-11-09T08:00:00Z',
    updatedAt: '2026-11-09T08:00:00Z',
    ...overrides,
  };
}

describe('prefillFromSearch', () => {
  it('sends digits to the phone and words to the names', () => {
    expect(prefillFromSearch('Nour Mechergui')).toEqual({
      firstName: 'Nour', lastName: 'Mechergui', phone: '',
    });
    expect(prefillFromSearch('mechergui')).toEqual({ firstName: '', lastName: 'Mechergui', phone: '' });
    expect(prefillFromSearch('+216 20 123 456')).toEqual({
      firstName: '', lastName: '', phone: '+216 20 123 456',
    });
    expect(prefillFromSearch('Sami 98 000 000')).toEqual({
      firstName: '', lastName: 'Sami', phone: '98 000 000',
    });
  });
});
