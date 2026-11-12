import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { RUNTIME_CONFIG } from '../../core/config/runtime-config';
import { PatientLookupDialog } from './patient-lookup-dialog';

describe('PatientLookupDialog', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      imports: [PatientLookupDialog],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: '/api/v1' } },
      ],
    });
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    vi.useRealTimers();
  });

  it('queries the doctor-owned patient API instead of local fixtures', async () => {
    const fixture = TestBed.createComponent(PatientLookupDialog);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();

    fixture.componentInstance.updateQuery({ target: { value: 'Trabelsi' } } as unknown as Event);
    await vi.advanceTimersByTimeAsync(250);

    const request = TestBed.inject(HttpTestingController).expectOne(
      (candidate) =>
        candidate.url === '/api/v1/patients' &&
        candidate.params.get('query') === 'Trabelsi' &&
        candidate.params.get('page') === '0' &&
        candidate.params.get('size') === '8',
    );
    expect(request.request.method).toBe('GET');
    request.flush({
      content: [
        {
          id: 'patient-1',
          doctorId: 'doctor-1',
          firstName: 'Amira',
          lastName: 'Trabelsi',
          dateOfBirth: '1988-04-16',
          sex: 'F',
          phone: '+21620000303',
          email: null,
          address: null,
          source: 'MANUAL',
          linkedOmniCareUserId: null,
          mrsPatientId: null,
          mrsProvisioned: false,
          possibleOmniCareMatch: false,
          createdAt: '2026-11-08T10:00:00Z',
          updatedAt: '2026-11-08T10:00:00Z',
        },
      ],
      totalElements: 1,
      totalPages: 1,
      size: 8,
      number: 0,
      first: true,
      last: true,
      empty: false,
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.lookup-result')?.textContent).toContain(
      'Amira Trabelsi',
    );
  });

  it('does not issue a request for an underspecified query', async () => {
    const fixture = TestBed.createComponent(PatientLookupDialog);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();

    fixture.componentInstance.updateQuery({ target: { value: 'T' } } as unknown as Event);
    await vi.advanceTimersByTimeAsync(300);

    TestBed.inject(HttpTestingController).expectNone('/api/v1/patients');
    expect(fixture.componentInstance.results()).toEqual([]);
  });
});
