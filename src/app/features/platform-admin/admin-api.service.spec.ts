import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { authInterceptor } from '../../core/auth/auth.interceptor';
import { AuthTokenStore } from '../../core/auth/auth-token.store';
import { RUNTIME_CONFIG } from '../../core/config/runtime-config';
import { AdminApiService } from './admin-api.service';

describe('AdminApiService', () => {
  let service: AdminApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: '/api/v1' } },
      ],
    });
    const tokens = TestBed.inject(AuthTokenStore);
    tokens.setSession({
      accessToken: 'admin-access-token', tokenType: 'Bearer', expiresAt: '2026-08-05T12:10:00Z',
      refreshToken: 'admin-refresh-token', refreshExpiresAt: '2026-08-06T00:00:00Z',
      user: { id: 'admin-1', role: 'ADMIN', mustChangePassword: false },
    });
    service = TestBed.inject(AdminApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('authorizes the professional directory with the in-memory access token', () => {
    service.listProfessionals('cardio').subscribe();
    const request = http.expectOne((candidate) => candidate.url === '/api/v1/admin/professionals');
    expect(request.request.headers.get('Authorization')).toBe('Bearer admin-access-token');
    expect(request.request.params.get('search')).toBe('cardio');
    request.flush({ items: [], page: 0, pageSize: 20, totalElements: 0, totalPages: 0 });
  });

  it('adds an idempotency key when creating a clinic', () => {
    service.createClinic({
      name: 'Clinique Jasmin', contactEmail: 'contact@jasmin.tn', contactPhone: '+21671111111',
      governorate: 'Tunis', address: '1 rue de Tunis', inpdpNumber: 'INPDP-42',
    }).subscribe();
    const request = http.expectOne('/api/v1/admin/clinics');
    expect(request.request.headers.get('Idempotency-Key')).toBeTruthy();
    request.flush({});
  });

  it('sends the initial password and idempotency key when creating a doctor', () => {
    service.createDoctor({
      email: 'doctor@omnicare.local',
      password: 'ChangeMe123!',
      phone: '+21653332480',
      professionalLicenseNumber: 'FGJKHFF',
      specialty: 'GENERAL',
      governorate: 'NABEUL',
    }).subscribe();

    const request = http.expectOne('/api/v1/admin/professionals');
    expect(request.request.headers.get('Authorization')).toBe('Bearer admin-access-token');
    expect(request.request.headers.get('Idempotency-Key')).toBeTruthy();
    expect(request.request.body).toEqual({
      email: 'doctor@omnicare.local',
      password: 'ChangeMe123!',
      phone: '+21653332480',
      professionalLicenseNumber: 'FGJKHFF',
      specialty: 'GENERAL',
      governorate: 'NABEUL',
      role: 'DOCTOR',
      affiliatedClinicId: null,
      alsoIndependent: true,
    });
    request.flush({});
  });
});
