import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of } from 'rxjs';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { fr_FR, provideNzI18n } from 'ng-zorro-antd/i18n';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OMNICARE_ICONS } from '../../../app.icons';

import type {
  PageDto,
  PracticePatientDto,
  PracticePatientReconciliationDto,
} from '../practice-patient-api.models';
import { PracticePatientApiService } from '../practice-patient-api.service';
import { PracticeLocationApiService } from '../settings/practice-location-api.service';
import { QuickBookingDrawer } from './quick-booking-drawer';

const location = {
  id: 'cabinet-1',
  type: 'CABINET' as const,
  name: 'Cabinet Lac',
  address: '1 rue du Lac',
  city: 'Tunis',
  governorate: 'Tunis',
  latitude: 36.8065,
  longitude: 10.1815,
  publicPhone: null,
  wheelchairAccessible: false,
  patientInstructions: null,
  primary: true,
  active: true,
  revision: 0,
  createdAt: '2030-01-01T08:00:00Z',
  updatedAt: '2030-01-01T08:00:00Z',
  gallery: [],
};

const slot = {
  start: '2030-01-02T08:00:00Z',
  end: '2030-01-02T08:45:00Z',
  durationMinutes: 45,
};

const patient: PracticePatientDto = {
  id: 'patient-1',
  doctorId: 'doctor-1',
  firstName: 'Amel',
  lastName: 'Test',
  dateOfBirth: '1990-01-01',
  approximateAgeYears: null,
  sex: 'F',
  phone: null,
  practiceIdentifier: null,
  email: null,
  address: null,
  source: 'MANUAL',
  linkedOmniCareUserId: null,
  mrsPatientId: null,
  mrsProvisioned: false,
  possibleOmniCareMatch: false,
  possibleDuplicate: false,
  mrsReadiness: 'ACTION_REQUIRED',
  externalPatientStatus: 'UNCLAIMED',
  lastConsultationAt: null,
  nextAppointmentAt: null,
  createdAt: '2030-01-01T08:00:00Z',
  updatedAt: '2030-01-01T08:00:00Z',
};

const availability = {
  doctorId: patient.doctorId,
  practiceLocationId: location.id,
  timezone: 'UTC',
  generatedAt: '2030-01-01T08:00:00Z',
  slots: [slot],
};

describe('QuickBookingDrawer MRS reconciliation', () => {
  it('uses a fresh idempotency key for a later explicit redrive', () => {
    const reconcileMrsPatient = vi.fn<
      (patientId: string, key: string) => Observable<PracticePatientReconciliationDto>
    >(() =>
      of({ patientId: patient.id, authorityVersion: 1, status: 'QUEUED', replayed: false }),
    );
    const patientsApi = {
      reconcileMrsPatient,
      getPatient: vi.fn(() => of(patient)),
      listPatients: vi.fn(
        (): Observable<PageDto<PracticePatientDto>> =>
          of({
            content: [],
            totalElements: 0,
            totalPages: 0,
            size: 8,
            number: 0,
            first: true,
            last: true,
            empty: true,
          }),
      ),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: PracticePatientApiService, useValue: patientsApi },
        { provide: PracticeLocationApiService, useValue: { list: vi.fn(() => of([])) } },
      ],
    });
    const drawer = TestBed.runInInjectionContext(() => new QuickBookingDrawer());
    drawer.selectedPatient.set(patient);

    drawer.retryMrsProvisioning();
    drawer.retryMrsProvisioning();

    expect(reconcileMrsPatient).toHaveBeenCalledTimes(2);
    expect(reconcileMrsPatient.mock.calls[0][0]).toBe(patient.id);
    expect(reconcileMrsPatient.mock.calls[1][0]).toBe(patient.id);
    expect(reconcileMrsPatient.mock.calls[1][1]).not.toBe(reconcileMrsPatient.mock.calls[0][1]);
    expect(drawer.selectedPatientReady()).toBe(false);
  });

  it('refreshes readiness after a retry without discarding the booking draft', () => {
    const readyPatient: PracticePatientDto = {
      ...patient,
      mrsPatientId: 'mrs-patient-1',
      mrsProvisioned: true,
      mrsReadiness: 'READY',
    };
    const getAppointmentAvailability = vi.fn(() =>
      of({
        doctorId: patient.doctorId,
        practiceLocationId: 'cabinet-1',
        timezone: 'Africa/Tunis',
        generatedAt: '2030-01-01T08:00:00Z',
        slots: [],
      }),
    );
    const patientsApi = {
      reconcileMrsPatient: vi.fn(() =>
        of({
          patientId: patient.id,
          authorityVersion: 1,
          status: 'QUEUED' as const,
          replayed: false,
        }),
      ),
      getPatient: vi.fn(() => of(readyPatient)),
      getAppointmentAvailability,
      listPatients: vi.fn(() => of({ content: [] })),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: PracticePatientApiService, useValue: patientsApi },
        { provide: PracticeLocationApiService, useValue: { list: vi.fn(() => of([])) } },
      ],
    });
    const drawer = TestBed.runInInjectionContext(() => new QuickBookingDrawer());
    drawer.selectedPatient.set(patient);
    drawer.selectedLocationId.set('cabinet-1');

    drawer.retryMrsProvisioning();

    expect(patientsApi.getPatient).toHaveBeenCalledWith(patient.id);
    expect(drawer.selectedPatient()).toEqual(readyPatient);
    expect(drawer.selectedPatientReady()).toBe(true);
    expect(getAppointmentAvailability).not.toHaveBeenCalled();
  });

  it('loads availability and enables confirmation while MRS provisioning is retrying', () => {
    const retryingPatient: PracticePatientDto = { ...patient, mrsReadiness: 'RETRYING' };
    const getAppointmentAvailability = vi.fn(() => of(availability));
    const patientsApi = {
      getAppointmentAvailability,
      listPatients: vi.fn(() => of({ content: [] })),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: PracticePatientApiService, useValue: patientsApi },
        { provide: PracticeLocationApiService, useValue: { list: vi.fn(() => of([])) } },
      ],
    });
    const drawer = TestBed.runInInjectionContext(() => new QuickBookingDrawer());
    drawer.locations.set([location]);
    drawer.selectedLocationId.set(location.id);
    drawer.selectedDate.set('2030-01-02');

    drawer.selectPatient(retryingPatient);
    drawer.selectSlot(`${slot.start}|${slot.end}`);

    expect(getAppointmentAvailability).toHaveBeenCalledWith(
      patient.id,
      location.id,
      expect.any(String),
      expect.any(String),
    );
    expect(drawer.selectedSlot()).toEqual(slot);
    expect(drawer.selectedSlot()?.durationMinutes).toBe(45);
    expect(drawer.selectedPatientReady()).toBe(false);
    expect(drawer.canSubmit()).toBe(true);
    expect(drawer.submitBlockedReason()).toBeNull();
  });

  it('keeps the draft and revalidates the slot on an explicit patient refresh', () => {
    const retryingPatient: PracticePatientDto = { ...patient, mrsReadiness: 'RETRYING' };
    const readyPatient: PracticePatientDto = {
      ...patient,
      mrsPatientId: 'mrs-patient-1',
      mrsProvisioned: true,
      mrsReadiness: 'READY',
    };
    const revalidation = new Subject<typeof availability>();
    const getAppointmentAvailability = vi
      .fn()
      .mockReturnValueOnce(of(availability))
      .mockReturnValueOnce(revalidation.asObservable());
    const patientsApi = {
      getAppointmentAvailability,
      getPatient: vi.fn(() => of(readyPatient)),
      listPatients: vi.fn(() => of({ content: [] })),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: PracticePatientApiService, useValue: patientsApi },
        { provide: PracticeLocationApiService, useValue: { list: vi.fn(() => of([])) } },
      ],
    });
    const drawer = TestBed.runInInjectionContext(() => new QuickBookingDrawer());
    drawer.locations.set([location]);
    drawer.selectedLocationId.set(location.id);
    drawer.selectedDate.set('2030-01-02');
    drawer.selectPatient(retryingPatient);
    drawer.selectSlot(`${slot.start}|${slot.end}`);
    expect(drawer.canSubmit()).toBe(true);

    drawer.refreshSelectedPatient();

    expect(drawer.selectedPatientReady()).toBe(true);
    expect(drawer.selectedLocationId()).toBe(location.id);
    expect(drawer.selectedDate()).toBe('2030-01-02');
    expect(drawer.selectedSlotKey()).toBe(`${slot.start}|${slot.end}`);
    expect(drawer.canSubmit()).toBe(false);

    revalidation.next(availability);
    revalidation.complete();

    expect(drawer.selectedSlot()).toEqual(slot);
    expect(drawer.canSubmit()).toBe(true);
    expect(getAppointmentAvailability).toHaveBeenCalledTimes(2);
  });

  it('clears a provisional slot with an explanation when revalidation removes it', () => {
    const retryingPatient: PracticePatientDto = { ...patient, mrsReadiness: 'RETRYING' };
    const readyPatient: PracticePatientDto = {
      ...patient,
      mrsPatientId: 'mrs-patient-1',
      mrsProvisioned: true,
      mrsReadiness: 'READY',
    };
    const getAppointmentAvailability = vi
      .fn()
      .mockReturnValueOnce(of(availability))
      .mockReturnValueOnce(of({ ...availability, slots: [] }));
    const patientsApi = {
      getAppointmentAvailability,
      getPatient: vi.fn(() => of(readyPatient)),
      listPatients: vi.fn(() => of({ content: [] })),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: PracticePatientApiService, useValue: patientsApi },
        { provide: PracticeLocationApiService, useValue: { list: vi.fn(() => of([])) } },
      ],
    });
    const drawer = TestBed.runInInjectionContext(() => new QuickBookingDrawer());
    drawer.locations.set([location]);
    drawer.selectedLocationId.set(location.id);
    drawer.selectedDate.set('2030-01-02');
    drawer.selectPatient(retryingPatient);
    drawer.selectSlot(`${slot.start}|${slot.end}`);

    drawer.refreshSelectedPatient();

    expect(drawer.selectedSlotKey()).toBe('');
    expect(drawer.slotSelectionNotice()).toContain('n’est plus disponible');
    expect(drawer.canSubmit()).toBe(false);
  });
});

describe('QuickBookingDrawer medical record readiness', () => {
  const preparingPatient: PracticePatientDto = {
    ...patient,
    mrsReadiness: 'PREPARING',
  };
  const readyPatient: PracticePatientDto = {
    ...patient,
    mrsPatientId: 'mrs-patient-1',
    mrsProvisioned: true,
    mrsReadiness: 'READY',
  };

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  function setup(getPatient: () => Observable<PracticePatientDto>) {
    const patientsApi = {
      getPatient: vi.fn(getPatient),
      getAppointmentAvailability: vi.fn(() => of(availability)),
      listPatients: vi.fn(() => of({ content: [] })),
      reconcileMrsPatient: vi.fn(() =>
        of({ patientId: patient.id, authorityVersion: 1, status: 'QUEUED' as const, replayed: false }),
      ),
    };
    TestBed.configureTestingModule({
      imports: [QuickBookingDrawer],
      providers: [
        provideNzIcons(OMNICARE_ICONS),
        provideNzI18n(fr_FR),
        { provide: PracticePatientApiService, useValue: patientsApi },
        { provide: PracticeLocationApiService, useValue: { list: vi.fn(() => of([location])) } },
      ],
    });
    const fixture = TestBed.createComponent(QuickBookingDrawer);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    const drawer = fixture.componentInstance;
    drawer.selectedDate.set('2030-01-02');
    return { fixture, drawer, patientsApi };
  }

  it('enables « Confirmer le rendez-vous » for a PREPARING patient once cabinet and slot are chosen', () => {
    vi.useFakeTimers();
    const { drawer } = setup(() => of(preparingPatient));

    drawer.selectPatient(preparingPatient);
    expect(drawer.canSubmit()).toBe(false);
    expect(drawer.submitBlockedReason()).toBe('Choisissez un créneau pour confirmer.');

    drawer.selectSlot(`${slot.start}|${slot.end}`);

    expect(drawer.selectedPatientRecordState()).toBe('PREPARING');
    expect(drawer.canSubmit()).toBe(true);
    expect(drawer.submitBlockedReason()).toBeNull();
  });

  it('shows the French preparation status with a spinner', () => {
    vi.useFakeTimers();
    const { fixture, drawer } = setup(() => of(preparingPatient));

    drawer.selectPatient(preparingPatient);
    fixture.detectChanges();

    const status = document.body.querySelector('[data-testid="medical-record-status"]');
    expect(status?.textContent).toContain('Dossier médical en cours de préparation…');
    expect(status?.querySelector('.quick-booking__inline-spinner')).not.toBeNull();
  });

  it('polls every 1.5 s and stops once the record is READY without touching the draft', () => {
    vi.useFakeTimers();
    const responses = [preparingPatient, preparingPatient, readyPatient];
    const { fixture, drawer, patientsApi } = setup(() => of(responses.shift() ?? readyPatient));
    drawer.selectPatient(preparingPatient);
    drawer.selectSlot(`${slot.start}|${slot.end}`);

    vi.advanceTimersByTime(1_500);
    expect(patientsApi.getPatient).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(3_000);
    expect(patientsApi.getPatient).toHaveBeenCalledTimes(3);
    expect(drawer.selectedPatientRecordState()).toBe('READY');

    vi.advanceTimersByTime(60_000);
    expect(patientsApi.getPatient).toHaveBeenCalledTimes(3);
    expect(drawer.selectedSlotKey()).toBe(`${slot.start}|${slot.end}`);
    expect(drawer.canSubmit()).toBe(true);
    fixture.detectChanges();
    expect(
      document.body.querySelector('[data-testid="medical-record-status"]')?.textContent,
    ).toContain('Dossier médical prêt');
  });

  it('slows down to every 10 s after 20 s and stops when the drawer closes', () => {
    vi.useFakeTimers();
    const { fixture, drawer, patientsApi } = setup(() => of(preparingPatient));
    drawer.selectPatient(preparingPatient);

    vi.advanceTimersByTime(19_500);
    expect(patientsApi.getPatient).toHaveBeenCalledTimes(13);
    vi.advanceTimersByTime(10_000);
    expect(patientsApi.getPatient).toHaveBeenCalledTimes(14);

    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
    vi.advanceTimersByTime(60_000);
    expect(patientsApi.getPatient).toHaveBeenCalledTimes(14);
  });

  it('shows « Réessayer » for a FAILED record and retries provisioning', () => {
    vi.useFakeTimers();
    const failedPatient: PracticePatientDto = { ...patient, mrsReadiness: 'ACTION_REQUIRED' };
    const { fixture, drawer, patientsApi } = setup(() => of(preparingPatient));

    drawer.selectPatient(failedPatient);
    fixture.detectChanges();

    const status = document.body.querySelector('[data-testid="medical-record-status"]');
    expect(status?.textContent).toContain('La préparation du dossier a échoué.');
    const retry = Array.from(status?.querySelectorAll('button') ?? []).find((button) =>
      button.textContent?.includes('Réessayer'),
    );
    expect(retry).toBeDefined();
    expect(patientsApi.getPatient).not.toHaveBeenCalled();

    retry?.click();

    expect(patientsApi.reconcileMrsPatient).toHaveBeenCalledWith(patient.id, expect.any(String));
    expect(patientsApi.getPatient).toHaveBeenCalledWith(patient.id);
    expect(drawer.selectedPatientRecordState()).toBe('PREPARING');
  });
});

describe('QuickBookingDrawer patient step and slots', () => {
  const ready: PracticePatientDto = {
    ...patient,
    id: 'ready-1',
    firstName: 'Sami',
    lastName: 'Trabelsi',
    mrsPatientId: 'mrs-1',
    mrsProvisioned: true,
    mrsReadiness: 'READY',
  };
  const preparing: PracticePatientDto = { ...patient, id: 'prep-1', mrsReadiness: 'PREPARING' };

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  function setup(options: {
    readonly patients?: readonly PracticePatientDto[];
    readonly locations?: readonly (typeof location)[];
    readonly slots?: readonly (typeof slot)[];
    readonly preselectedStart?: string;
    readonly preselectedPatientId?: string;
  } = {}) {
    const page = (content: readonly PracticePatientDto[]) => ({
      content, totalElements: content.length, totalPages: 1, size: 20, number: 0,
      first: true, last: true, empty: content.length === 0,
    });
    const patientsApi = {
      listPatients: vi.fn(() => of(page(options.patients ?? [ready, preparing]))),
      getPatient: vi.fn(() => of(ready)),
      getAppointmentAvailability: vi.fn(() =>
        of({ ...availability, slots: options.slots ?? [slot] }),
      ),
    };
    TestBed.configureTestingModule({
      imports: [QuickBookingDrawer],
      providers: [
        provideNzIcons(OMNICARE_ICONS),
        provideNzI18n(fr_FR),
        { provide: PracticePatientApiService, useValue: patientsApi },
        {
          provide: PracticeLocationApiService,
          useValue: { list: vi.fn(() => of(options.locations ?? [location])) },
        },
      ],
    });
    const fixture = TestBed.createComponent(QuickBookingDrawer);
    if (options.preselectedStart) {
      fixture.componentRef.setInput('preselectedStart', options.preselectedStart);
      fixture.componentRef.setInput('preselectedPracticeLocationId', location.id);
    }
    if (options.preselectedPatientId) {
      fixture.componentRef.setInput('preselectedPatientId', options.preselectedPatientId);
    }
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    return { fixture, drawer: fixture.componentInstance, patientsApi };
  }

  it('shows the 5 recent patients for an empty search, never the full list', () => {
    vi.useFakeTimers();
    const { drawer, patientsApi } = setup();
    vi.advanceTimersByTime(250);

    expect(patientsApi.listPatients).toHaveBeenCalledWith({ filter: 'ALL', limit: 5 });
    expect(drawer.patientListTitle()).toBe('Patients récents');
  });

  it('runs a capped server search from 2 characters with a 250 ms debounce', () => {
    vi.useFakeTimers();
    const { drawer, patientsApi } = setup();
    vi.advanceTimersByTime(250);
    patientsApi.listPatients.mockClear();

    drawer.searchControl.setValue('M');
    vi.advanceTimersByTime(250);
    expect(patientsApi.listPatients).toHaveBeenLastCalledWith({ filter: 'ALL', limit: 5 });

    drawer.searchControl.setValue('Me');
    vi.advanceTimersByTime(200);
    expect(patientsApi.listPatients).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(50);
    expect(patientsApi.listPatients).toHaveBeenLastCalledWith({
      query: 'Me', filter: 'ALL', limit: 20,
    });
    expect(drawer.patientListTitle()).toBe('Résultats');
  });

  it('preselects the patient passed by the patient chart', () => {
    vi.useFakeTimers();
    const { drawer, patientsApi } = setup({ preselectedPatientId: 'ready-1' });

    expect(patientsApi.getPatient).toHaveBeenCalledWith('ready-1');
    expect(drawer.selectedPatient()?.id).toBe('ready-1');
  });

  it('selects the first result on Enter', () => {
    vi.useFakeTimers();
    const { drawer } = setup();
    vi.advanceTimersByTime(250);

    drawer.selectFirstResult(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(drawer.selectedPatient()?.id).toBe('ready-1');
  });

  it('shows a readiness badge only when the record is not ready', () => {
    vi.useFakeTimers();
    const { drawer } = setup();
    expect(drawer.readinessLabel(ready)).toBeNull();
    expect(drawer.readinessLabel(preparing)).toBe('En préparation');
    expect(drawer.readinessLabel({ ...patient, mrsReadiness: 'ACTION_REQUIRED' })).toBe(
      'Échec — Réessayer',
    );
  });

  it('shows a single cabinet as a compact read-only line', () => {
    vi.useFakeTimers();
    const { fixture, drawer } = setup();
    fixture.detectChanges();
    expect(drawer.selectedLocationId()).toBe(location.id);
    expect(document.body.querySelector('[data-testid="single-cabinet"]')?.textContent).toContain(
      'Cabinet Lac',
    );
  });

  it('preselects the first day that has free slots', () => {
    vi.useFakeTimers();
    const later = { start: '2030-01-05T09:00:00Z', end: '2030-01-05T09:20:00Z', durationMinutes: 20 };
    const { drawer } = setup({ slots: [later] });

    drawer.selectPatient(ready);

    expect(drawer.selectedDate()).toBe('2030-01-05');
    expect(drawer.dateChoice()).toBe('other');
    expect(drawer.slots()).toEqual([later]);
  });

  it('preselects the calendar slot it was opened from', () => {
    vi.useFakeTimers();
    const { drawer } = setup({ preselectedStart: slot.start });

    drawer.selectPatient(ready);

    expect(drawer.selectedSlotKey()).toBe(`${slot.start}|${slot.end}`);
    expect(drawer.canSubmit()).toBe(true);
  });

  it('opens the inline creation form pre-filled from the search; Esc closes the form, then the drawer', () => {
    vi.useFakeTimers();
    const { drawer } = setup({ patients: [] });
    const openChange = vi.fn();
    drawer.openChange.subscribe(openChange);
    drawer.searchControl.setValue('Nour Mechergui');

    drawer.openPatientCreation();
    expect(drawer.patientFormOpen()).toBe(true);
    expect(drawer.patientFormPrefill()).toBe('Nour Mechergui');

    drawer.dismiss();
    expect(drawer.patientFormOpen()).toBe(false);
    expect(openChange).not.toHaveBeenCalled();

    drawer.dismiss();
    expect(openChange).toHaveBeenCalledWith(false);
  });

  it('selects the created patient and collapses the form', () => {
    vi.useFakeTimers();
    const { drawer } = setup();
    drawer.openPatientCreation();

    drawer.onPatientCreated(preparing);

    expect(drawer.patientFormOpen()).toBe(false);
    expect(drawer.selectedPatient()?.id).toBe('prep-1');
    expect(drawer.patientPickerExpanded()).toBe(false);
  });
});
