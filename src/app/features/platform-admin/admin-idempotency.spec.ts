import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';

import { AdminApiService } from './admin-api.service';
import { ClinicDetailPage } from './clinic-detail-page';
import { ProfessionalsPage } from './professionals-page';

describe('platform admin idempotency attempts', () => {
  it('retains the doctor-creation key across an ambiguous user retry and rotates after success', () => {
    const api = {
      listProfessionals: vi.fn(() => of({ items: [], page: 0, pageSize: 20, totalElements: 0, totalPages: 0 })),
      createDoctor: vi.fn()
        .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 0 })))
        .mockReturnValueOnce(of({}))
        .mockReturnValueOnce(of({})),
    };
    TestBed.configureTestingModule({ providers: [{ provide: AdminApiService, useValue: api }] });
    const page = TestBed.runInInjectionContext(() => new ProfessionalsPage());
    page.form.setValue({
      email: 'doctor@example.test', firstName: 'Amira', lastName: 'Ben Salah', phone: '',
      professionalLicenseNumber: 'LICENSE-1', specialty: 'GENERAL', governorate: 'Tunis',
    });

    page.submit();
    page.submit();
    const firstKey = api.createDoctor.mock.calls[0][1];
    expect(api.createDoctor.mock.calls[1][1]).toBe(firstKey);

    page.form.setValue({
      email: 'other@example.test', firstName: 'Leila', lastName: 'Trabelsi', phone: '',
      professionalLicenseNumber: 'LICENSE-2', specialty: 'GENERAL', governorate: 'Tunis',
    });
    page.submit();
    expect(api.createDoctor.mock.calls[2][1]).not.toBe(firstKey);
  });

  it('retains the clinic-admin invitation key across an ambiguous user retry', () => {
    const api = {
      getClinic: vi.fn(() => of({})),
      listMemberships: vi.fn(() => of([])),
      inviteClinicAdmin: vi.fn()
        .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 0 })))
        .mockReturnValueOnce(of({})),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: AdminApiService, useValue: api },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ clinicId: 'clinic-1' }) } },
        },
      ],
    });
    const page = TestBed.runInInjectionContext(() => new ClinicDetailPage());
    page.form.setValue({ email: 'admin@example.test', phone: '' });

    page.invite();
    page.invite();

    expect(api.inviteClinicAdmin).toHaveBeenCalledTimes(2);
    expect(api.inviteClinicAdmin.mock.calls[0][3]).toBe(api.inviteClinicAdmin.mock.calls[1][3]);
  });
});
