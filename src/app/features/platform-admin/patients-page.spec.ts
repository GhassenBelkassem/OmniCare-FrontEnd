import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { authInterceptor } from '../../core/auth/auth.interceptor';
import { AuthTokenStore } from '../../core/auth/auth-token.store';
import { RUNTIME_CONFIG } from '../../core/config/runtime-config';
import { AdminPatient, PatientPage } from './admin-api.models';
import { PatientsPage } from './patients-page';

describe('PatientsPage', () => {
  let fixture: ComponentFixture<PatientsPage>;
  let http: HttpTestingController;

  const NAMED: AdminPatient = {
    userId: '62dbb2a7-9619-4818-84c7-a83e4a901c99',
    email: 'patient@omnicare.local',
    phone: '+21653281899',
    role: 'PATIENT',
    status: 'ACTIVE',
    firstName: 'ghassen',
    lastName: 'Belkassem',
    lastActiveAt: '2026-10-04T15:33:54Z',
  };

  /** The real second row: an account with no name, no phone and no login yet. */
  const BARE: AdminPatient = {
    userId: '6c705b7d-9895-4069-9bad-ac5bb46c8d4a',
    email: 'ghassenu@gmail.com',
    phone: null,
    role: 'PATIENT',
    status: 'ACTIVE',
    firstName: null,
    lastName: null,
    lastActiveAt: null,
  };

  function page(items: readonly AdminPatient[], overrides: Partial<PatientPage> = {}): PatientPage {
    return {
      items,
      page: 0,
      pageSize: 20,
      totalElements: items.length,
      totalPages: items.length ? 1 : 0,
      ...overrides,
    };
  }

  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [PatientsPage],
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: '/api/v1' } },
      ],
    }).compileComponents();

    const tokens = TestBed.inject(AuthTokenStore);
    tokens.setSession({
      accessToken: 'admin-access-token', tokenType: 'Bearer', expiresAt: '2026-08-05T12:10:00Z',
      refreshToken: 'admin-refresh-token', refreshExpiresAt: '2026-08-06T00:00:00Z',
      user: { id: 'admin-1', role: 'ADMIN', mustChangePassword: false },
    });

    fixture = TestBed.createComponent(PatientsPage);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    fixture.destroy();
    sessionStorage.clear();
  });

  function settle(result: PatientPage): void {
    http.expectOne((request) => request.url === '/api/v1/admin/patients').flush(result);
    fixture.detectChanges();
  }

  function rows(): HTMLTableRowElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('tbody tr') as NodeListOf<HTMLTableRowElement>);
  }

  function cellTexts(row: HTMLTableRowElement): string[] {
    return Array.from(row.querySelectorAll('td') as NodeListOf<HTMLTableCellElement>)
      .map((cell) => (cell.textContent ?? '').trim());
  }

  function headers(): string[] {
    return Array.from(
      fixture.nativeElement.querySelectorAll('thead th') as NodeListOf<HTMLTableCellElement>,
    ).map((cell) => (cell.textContent ?? '').trim());
  }

  it('loads the first page on construction', () => {
    const request = http.expectOne((candidate) => candidate.url === '/api/v1/admin/patients');
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('page')).toBe('0');
    expect(request.request.params.get('pageSize')).toBe('20');
    request.flush(page([]));
  });

  it('renders exactly the six agreed columns in order', () => {
    fixture.detectChanges();
    settle(page([NAMED]));

    expect(headers()).toEqual(['Name', 'Email', 'Phone', 'Role', 'Status', 'Last active']);
  });

  it('shows the real values of a fully populated patient', () => {
    fixture.detectChanges();
    settle(page([NAMED]));

    const cells = cellTexts(rows()[0]);
    expect(cells[0]).toBe('ghassen Belkassem');
    expect(cells[1]).toBe('patient@omnicare.local');
    expect(cells[2]).toBe('+21653281899');
    expect(cells[3]).toBe('Patient');
    // The shared badge renders the confirmed tone, as it does on the professionals table.
    expect(cells[4]).toBe('Confirmed');
    expect(cells[5]).toContain('2026');
  });

  it('renders a patient with no name, phone or login as absent rather than fabricating values', () => {
    fixture.detectChanges();
    settle(page([BARE]));

    const cells = cellTexts(rows()[0]);
    // Falls back to the identifier so two nameless patients stay distinguishable.
    expect(cells[0]).toBe('ghassenu@gmail.com');
    expect(cells[1]).toBe('ghassenu@gmail.com');
    expect(cells[2]).toBe('—');
    expect(cells[5]).toBe('Never');
  });

  it('labels the role Patient on every row', () => {
    fixture.detectChanges();
    settle(page([NAMED, BARE]));

    expect(rows()).toHaveLength(2);
    for (const row of rows()) {
      expect(row.querySelectorAll('td')[3].textContent!.trim()).toBe('Patient');
    }
  });

  it('offers no per-row action, because the endpoint has no write path for patients', () => {
    fixture.detectChanges();
    settle(page([NAMED]));

    expect(fixture.nativeElement.querySelectorAll('tbody a, tbody button')).toHaveLength(0);
    expect(fixture.nativeElement.textContent).not.toContain('Add patient');
    expect(fixture.nativeElement.textContent).not.toContain('Suspend');
  });

  it('searches from the first page so a term cannot strand the admin on a stale page', () => {
    fixture.detectChanges();
    settle(page([NAMED, BARE], { page: 3, pageSize: 20, totalElements: 62, totalPages: 4 }));
    expect(fixture.componentInstance.currentPage()).toBe(3);

    const input: HTMLInputElement = fixture.nativeElement.querySelector('#patient-search');
    input.value = 'belkassem';
    input.dispatchEvent(new Event('input'));
    fixture.componentInstance.applySearch();

    const request = http.expectOne((candidate) => candidate.url === '/api/v1/admin/patients');
    expect(request.request.params.get('search')).toBe('belkassem');
    expect(request.request.params.get('page')).toBe('0');
    request.flush(page([NAMED], { totalElements: 1, totalPages: 1 }));
    fixture.detectChanges();
  });

  it('clears the search and reloads the unfiltered directory', () => {
    fixture.detectChanges();
    settle(page([NAMED, BARE]));

    const input: HTMLInputElement = fixture.nativeElement.querySelector('#patient-search');
    input.value = 'belkassem';
    input.dispatchEvent(new Event('input'));
    fixture.componentInstance.applySearch();
    http.expectOne((candidate) => candidate.url === '/api/v1/admin/patients').flush(page([NAMED]));
    fixture.detectChanges();

    fixture.componentInstance.clearSearch();

    const request = http.expectOne((candidate) => candidate.url === '/api/v1/admin/patients');
    expect(request.request.params.has('search')).toBe(false);
    request.flush(page([NAMED, BARE]));
    fixture.detectChanges();
  });

  it('walks forward and back within the reported range only', () => {
    fixture.detectChanges();
    settle(page([NAMED], { page: 0, totalElements: 45, totalPages: 3 }));
    expect(fixture.componentInstance.canGoBack()).toBe(false);
    expect(fixture.componentInstance.canGoForward()).toBe(true);

    fixture.componentInstance.nextPage();
    http.expectOne((candidate) => candidate.url === '/api/v1/admin/patients')
      .flush(page([NAMED], { page: 1, totalElements: 45, totalPages: 3 }));
    fixture.detectChanges();

    fixture.componentInstance.previousPage();
    const request = http.expectOne((candidate) => candidate.url === '/api/v1/admin/patients');
    expect(request.request.params.get('page')).toBe('0');
    request.flush(page([NAMED], { page: 0, totalElements: 45, totalPages: 3 }));
    fixture.detectChanges();
  });

  it('disables Next on the last page instead of requesting a page past the end', () => {
    fixture.detectChanges();
    settle(page([NAMED], { page: 2, totalElements: 45, totalPages: 3 }));

    expect(fixture.componentInstance.canGoForward()).toBe(false);
  });

  it('shows the empty state with no invented call to action when nothing matches', () => {
    fixture.detectChanges();
    settle(page([]));

    expect(fixture.componentInstance.tableState()).toBe('empty');
    expect(rows()).toHaveLength(0);
    expect(fixture.nativeElement.textContent).toContain('No patients found');
  });

  it('surfaces a server failure as an error instead of an empty directory', () => {
    fixture.detectChanges();
    http.expectOne((candidate) => candidate.url === '/api/v1/admin/patients')
      .flush({ code: 'AUTH_ROLE_NOT_ALLOWED', message: 'This account may not list patients.' }, {
        status: 403, statusText: 'Forbidden',
      });
    fixture.detectChanges();

    expect(fixture.componentInstance.tableState()).toBe('error');
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent)
      .toContain('may not list patients');
    // An error is not a result: it must not read as "there are no patients".
    expect(fixture.nativeElement.textContent).not.toContain('No patients found');
  });

  it('reports the total with the right singular and plural', () => {
    fixture.detectChanges();
    settle(page([NAMED], { totalElements: 1, totalPages: 1 }));
    expect(fixture.componentInstance.resultSummary()).toBe('1 patient');

    fixture.componentInstance.load();
    http.expectOne((candidate) => candidate.url === '/api/v1/admin/patients')
      .flush(page([NAMED, BARE], { totalElements: 2, totalPages: 1 }));
    expect(fixture.componentInstance.resultSummary()).toBe('2 patients');
  });
});