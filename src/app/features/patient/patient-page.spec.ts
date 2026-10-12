import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { BehaviorSubject, Subject } from 'rxjs';

import { authInterceptor } from '../../core/auth/auth.interceptor';
import { AuthTokenStore } from '../../core/auth/auth-token.store';
import { RUNTIME_CONFIG } from '../../core/config/runtime-config';
import { RealtimeService } from '../../core/realtime/realtime.service';
import { PatientPage } from './patient-page';

type FakeUrgentEvent = {
  name: string;
  data: Record<string, unknown>;
  timestamp?: string;
};

class FakeParamMap {
  constructor(private readonly values: Readonly<Record<string, string>> = {}) {}
  get(key: string): string | null {
    return this.values[key] ?? null;
  }
}

const PROFILE = {
  userId: 'u-1',
  firstName: 'Hedi',
  lastName: 'Bouazizi',
  displayName: 'Hedi Bouazizi',
  dateOfBirth: '1990-04-12',
  gender: 'M',
  photoUrl: null,
  bloodType: 'O+',
  heightCm: 180,
  weightKg: 78,
  bmi: 24,
  patientId: 'p-1',
  passportCompletion: 60,
  onboardingCompleted: true,
  onboardingStep: 3,
  preferredLanguage: 'fr',
  notificationMedications: true,
  notificationAppointments: true,
  notificationPassport: false,
};

const DOCTORS = [
  { doctorId: 'd-1', name: 'Dr Amira Trabelsi', specialty: null, distanceKm: 3.2 },
  { doctorId: 'd-2', name: 'Dr Karim Ben Ali', specialty: null, distanceKm: 5.1 },
];

const DIRECTORY = [
  {
    doctorId: 'd-1',
    displayName: 'Dr Amira Trabelsi',
    specialty: 'Cardiologie',
    photoUrl: null,
    affiliatedClinicId: null,
    availableForUrgent: true,
    consultationPriceTnd: 60,
    phoneNumber: '+21698123456',
    isActive: true,
    experienceYears: 12,
    distanceKm: 2.5,
  },
  {
    doctorId: 'd-2',
    displayName: 'Dr Karim Ben Ali',
    specialty: 'Pediatrie',
    photoUrl: null,
    affiliatedClinicId: null,
    availableForUrgent: false,
    consultationPriceTnd: null,
    phoneNumber: null,
    isActive: true,
    experienceYears: null,
    distanceKm: null,
  },
  {
    doctorId: 'd-3',
    displayName: 'Dr Salma Gharbi',
    specialty: 'Cardiologie',
    photoUrl: null,
    affiliatedClinicId: null,
    availableForUrgent: true,
    consultationPriceTnd: null,
    phoneNumber: null,
    isActive: true,
    experienceYears: null,
    distanceKm: null,
  },
];

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function bookedAppointment(id: string, date: string, time: string): Record<string, unknown> {
  return {
    id,
    doctorId: 'd-1',
    patientId: 'p-1',
    startTime: `${date}T${time}:00`,
    endTime: `${date}T${time}:30`,
    status: 'CONFIRMED',
    source: 'MANUAL',
    notes: 'Suivi',
    createdAt: '2026-08-01T09:00:00Z',
  };
}

const APPOINTMENTS = [
  bookedAppointment('a-1', todayIso(), '10:00'),
  {
    ...bookedAppointment('a-2', '2026-07-20', '14:00'),
    doctorId: 'd-2',
    status: 'CANCELLED',
    source: 'URGENT',
    notes: 'Douleur',
  },
];

describe('PatientPage', () => {
  function create(options: { tab?: string | null; mustChangePassword?: boolean } = {}): {
    page: PatientPage;
    http: HttpTestingController;
    urgentEvents: Subject<FakeUrgentEvent>;
  } {
    const queryParamMap = new BehaviorSubject(
      new FakeParamMap(options.tab ? { tab: options.tab } : {}),
    );
    const urgentEvents = new Subject<FakeUrgentEvent>();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: '/api/v1' } },
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { queryParamMap: queryParamMap.asObservable(), snapshot: {} },
        },
        {
          provide: RealtimeService,
          useValue: {
            appointmentEvents$: new Subject<FakeUrgentEvent>(),
            urgentEvents$: urgentEvents,
          },
        },
      ],
    });
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const tokens = TestBed.inject(AuthTokenStore);
    tokens.setSession({
      accessToken: 'patient-access-token',
      tokenType: 'Bearer',
      expiresAt: '2026-08-05T12:10:00Z',
      refreshToken: 'patient-refresh-token',
      refreshExpiresAt: '2026-08-06T00:00:00Z',
      user: {
        id: 'patient-1',
        role: 'PATIENT',
        mustChangePassword: options.mustChangePassword ?? false,
      },
    });
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(PatientPage);
    return { page: fixture.componentInstance, http, urgentEvents };
  }

  function flushInitial(
    http: HttpTestingController,
    appointments: readonly Record<string, unknown>[] = APPOINTMENTS,
  ): void {
    http.expectOne((request) => request.url === '/api/v1/profile').flush(PROFILE);
    http
      .match((request) => request.url === '/api/v1/urgent-requests/available-doctors')
      .forEach((request) => request.flush(DOCTORS));
    const directory = http.expectOne((request) => request.url === '/api/v1/doctors');
    expect(directory.request.params.get('lat')).toBe(String(36.8065));
    expect(directory.request.params.get('lng')).toBe(String(10.1815));
    directory.flush(DIRECTORY);
    http.expectOne((request) => request.url === '/api/v1/appointments').flush(appointments);
  }

  afterEach(() => {
    try {
      const http = TestBed.inject(HttpTestingController);
      http.match((request) => request.url.startsWith('assets/'));
      http.verify();
    } finally {
      TestBed.resetTestingModule();
    }
  });

  it('defaults to the home tab', () => {
    const { page, http } = create();
    flushInitial(http);
    expect(page.activeTab()).toBe('home');
  });

  it('opens on the tab supplied by the query params', () => {
    const { page, http } = create({ tab: 'urgent' });
    flushInitial(http);
    expect(page.activeTab()).toBe('urgent');
  });

  it('loads the profile and greets the patient by name', () => {
    const { page, http } = create();
    flushInitial(http);
    expect(page.profile()?.firstName).toBe('Hedi');
    expect(page.greeting()).toBe('Hedi Bouazizi');
  });

  it('lists every active doctor in the directory and filters by name', () => {
    const { page, http } = create({ tab: 'doctors' });
    flushInitial(http);

    expect(page.doctorMode()).toBe('directory');
    expect(page.directoryDoctors().length).toBe(3);
    page.doctorQuery.set('trabelsi');
    expect(page.filteredDoctors().map((doctor) => doctor.id)).toEqual(['d-1']);
  });

  it('maps the directory price, phone, experience and distance fields, and nulls them for urgent doctors', () => {
    const { page, http } = create({ tab: 'doctors' });
    flushInitial(http);

    const amira = page.directoryDoctors()[0];
    expect(amira.priceTnd).toBe(60);
    expect(amira.phoneNumber).toBe('+21698123456');
    expect(amira.experienceYears).toBe(12);
    expect(amira.distanceKm).toBe(2.5);

    const kareem = page.directoryDoctors()[1];
    expect(kareem.priceTnd).toBeNull();
    expect(kareem.phoneNumber).toBeNull();
    expect(kareem.experienceYears).toBeNull();
    expect(kareem.distanceKm).toBeNull();

    page.setDoctorMode('urgent');
    http
      .expectOne((request) => request.url === '/api/v1/urgent-requests/available-doctors')
      .flush(DOCTORS);
    expect(page.doctors()[0].priceTnd).toBeNull();
    expect(page.doctors()[0].phoneNumber).toBeNull();
    expect(page.doctors()[0].experienceYears).toBeNull();
    expect(page.doctors()[0].distanceKm).toBe(3.2);
  });

  it('filters directory doctors by specialty', () => {
    const { page, http } = create({ tab: 'doctors' });
    flushInitial(http);

    expect(page.specialties()).toEqual(['Cardiologie', 'Pediatrie']);
    page.doctorSpecialty.set('Cardiologie');
    expect(page.filteredDoctors().map((doctor) => doctor.id)).toEqual(['d-1', 'd-3']);
  });

  it('switches to urgent mode, refreshes the nearby list and filters it', () => {
    const { page, http } = create({ tab: 'doctors' });
    flushInitial(http);

    page.setDoctorMode('urgent');
    http
      .expectOne((request) => request.url === '/api/v1/urgent-requests/available-doctors')
      .flush(DOCTORS);

    expect(page.doctors().length).toBe(2);
    page.doctorQuery.set('karim');
    expect(page.filteredDoctors().map((doctor) => doctor.id)).toEqual(['d-2']);
  });

  it('does not refetch the directory when re-entering directory mode', () => {
    const { page, http } = create({ tab: 'doctors' });
    flushInitial(http);

    page.setDoctorMode('urgent');
    http
      .expectOne((request) => request.url === '/api/v1/urgent-requests/available-doctors')
      .flush(DOCTORS);
    page.setDoctorMode('directory');
    http.expectNone((request) => request.url === '/api/v1/doctors');
    expect(page.filteredDoctors().length).toBe(3);
  });

  it('reports that the development-only legacy availability flow is retired', () => {
    const { page, http } = create({ tab: 'doctors' });
    flushInitial(http);
    page.startBooking(page.doctors()[0]);

    expect(page.bookingDoctor()?.id).toBe('d-1');
    expect(page.visibleBookingSlots()).toEqual([]);
    expect(page.slotsError()).toContain('réservation Patient Angular est retirée');
    http.expectNone('/api/v1/appointments/availability/slots');
  });

  it('never posts a direct appointment from the obsolete development page', () => {
    const { page, http } = create({ tab: 'doctors' });
    flushInitial(http);
    const slot = { start: `${todayIso()}T09:00:00`, end: `${todayIso()}T09:30:00` };
    page.bookingDoctor.set(page.doctors()[0]);
    page.bookingSlot.set(slot);
    page.bookingNotes.set('Suivi');

    page.bookAppointment();

    http.expectNone('/api/v1/appointments');
    expect(page.bookingDoctor()?.id).toBe('d-1');
    expect(page.bookingMessage()).toBeNull();
    expect(page.bookingError()).toContain('réservation Patient Angular est retirée');
  });

  it('lists only booked appointments in the upcoming period', () => {
    const { page, http } = create({ tab: 'appointments' });
    flushInitial(http);

    page.appointmentPeriod.set('upcoming');
    expect(page.filteredAppointments().every((item) => item.status === 'CONFIRMED' || item.status === 'IN_PROGRESS')).toBe(true);

    page.appointmentPeriod.set('all');
    expect(page.filteredAppointments().some((item) => item.status === 'CANCELLED')).toBe(true);
  });

  it('cancels an upcoming appointment', () => {
    const { page, http } = create({ tab: 'appointments' });
    flushInitial(http);

    page.cancelAppointment('a-1');
    http.expectOne('/api/v1/appointments/a-1/cancel').flush({});
    const cancelled = {
      ...APPOINTMENTS[0],
      status: 'CANCELLED',
    };
    http
      .expectOne((request) => request.url === '/api/v1/appointments')
      .flush([cancelled, APPOINTMENTS[1]]);

    expect(page.appointments().find((item) => item.id === 'a-1')?.status).toBe('CANCELLED');
  });

  it('rejects an invalid location on the urgent form', () => {
    const { page, http } = create({ tab: 'urgent' });
    flushInitial(http);
    page.urgentLat.set('abc');

    page.sendUrgent();

    expect(page.urgentError()).toContain('Latitude');
    expect(page.lastUrgentRequest()).toBeNull();
  });

  it('sends the urgent request without a target selection', () => {
    const { page, http } = create({ tab: 'urgent' });
    flushInitial(http);

    page.sendUrgent();
    const request = http.expectOne('/api/v1/urgent-requests');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      patientLatitude: 36.8065,
      patientLongitude: 10.1815,
      visitPreference: 'HOME_VISIT',
      notes: '',
    });
    request.flush({
      request: {
        id: 'urgent-1',
        patientId: 'p-1',
        patientLatitude: 36.8065,
        patientLongitude: 10.1815,
        visitPreference: 'HOME_VISIT',
        notes: '',
        status: 'PENDING',
        selectedOfferId: null,
        createdAt: '2026-08-13T09:00:00Z',
        offers: [],
      },
      offers: [],
    });
    http
      .expectOne((request) => request.url === '/api/v1/urgent-requests/available-doctors')
      .flush(DOCTORS);
    http
      .expectOne((request) => request.url === '/api/v1/urgent-requests/urgent-1/offers')
      .flush([]);

    expect(page.urgentError()).toBeNull();
    expect(page.lastUrgentRequest()?.id).toBe('urgent-1');
  });

  it('auto-searches for nearby doctors when the urgent tab opens', () => {
    const { page, http } = create({ tab: 'urgent' });
    http.expectOne((request) => request.url === '/api/v1/profile').flush(PROFILE);
    const previews = http.match(
      (request) => request.url === '/api/v1/urgent-requests/available-doctors',
    );
    expect(previews.length).toBe(2);
    const preview = previews.find(
      (request) => request.request.params.get('visitType') === 'HOME_VISIT',
    );
    expect(preview).toBeDefined();
    expect(preview?.request.params.get('lat')).toBe(String(36.8065));
    expect(preview?.request.params.get('lng')).toBe(String(10.1815));
    expect(preview?.request.params.get('radius')).toBe('20');
    previews.forEach((request) => request.flush(DOCTORS));
    http.expectOne((request) => request.url === '/api/v1/doctors').flush(DIRECTORY);
    http.expectOne((request) => request.url === '/api/v1/appointments').flush(APPOINTMENTS);

    expect(page.urgentSearched()).toBe(true);
    expect(page.urgentSearchResults().map((doctor) => doctor.id)).toEqual(['d-1', 'd-2']);
  });

  it('rejects an invalid position when searching without calling the API', () => {
    const { page, http } = create({ tab: 'urgent' });
    flushInitial(http);
    page.urgentLat.set('abc');

    page.searchUrgentDoctors();

    expect(page.urgentSearchError()).toContain('Latitude');
    http.expectNone((request) => request.url === '/api/v1/urgent-requests/available-doctors');
  });

  it('blocks sending when no doctor is available nearby', () => {
    const { page, http } = create({ tab: 'urgent' });
    flushInitial(http);
    page.urgentLat.set('36.7');
    page.urgentLng.set('10.2');
    page.searchUrgentDoctors();
    http
      .expectOne((request) => request.url === '/api/v1/urgent-requests/available-doctors')
      .flush([]);

    page.sendUrgent();

    expect(page.urgentError()).toContain('Aucun medecin disponible');
    expect(page.lastUrgentRequest()).toBeNull();
  });

  it('detects the position with geolocation and re-searches', () => {
    const { page, http } = create({ tab: 'urgent' });
    flushInitial(http);
    const geolocation = { getCurrentPosition: vi.fn() };
    Object.defineProperty(navigator, 'geolocation', { value: geolocation, configurable: true });

    page.detectLocation();
    expect(page.locationDetecting()).toBe(true);
    expect(geolocation.getCurrentPosition).toHaveBeenCalled();

    const onSuccess = geolocation.getCurrentPosition.mock.calls[0][0];
    onSuccess({ coords: { latitude: 36.82, longitude: 10.15 } });

    expect(page.locationDetecting()).toBe(false);
    expect(page.urgentLat()).toBe('36.820000');
    expect(page.urgentLng()).toBe('10.150000');
    const request = http.expectOne(
      (candidate) => candidate.url === '/api/v1/urgent-requests/available-doctors',
    );
    expect(request.request.params.get('lat')).toBe('36.82');
    expect(request.request.params.get('lng')).toBe('10.15');
    request.flush(DOCTORS);

    expect(page.urgentSearchResults().length).toBe(2);
  });

  it('searches for available doctors with the entered position', () => {
    const { page, http } = create({ tab: 'urgent' });
    flushInitial(http);
    page.urgentLat.set('36.7');
    page.urgentLng.set('10.2');

    page.searchUrgentDoctors();
    const request = http.expectOne(
      (candidate) => candidate.url === '/api/v1/urgent-requests/available-doctors',
    );
    expect(request.request.params.get('lat')).toBe('36.7');
    expect(request.request.params.get('lng')).toBe('10.2');
    expect(request.request.params.get('radius')).toBe('20');
    expect(request.request.params.get('visitType')).toBe('HOME_VISIT');
    request.flush(DOCTORS);

    expect(page.urgentSearched()).toBe(true);
    expect(page.urgentSearchResults().map((doctor) => doctor.id)).toEqual(['d-1', 'd-2']);
  });

  it('re-searches with the chosen visit type when the preference changes', () => {
    const { page, http } = create({ tab: 'urgent' });
    flushInitial(http);

    page.updateUrgentPreference('CABINET_VISIT');
    const request = http.expectOne(
      (candidate) => candidate.url === '/api/v1/urgent-requests/available-doctors',
    );
    expect(request.request.params.get('visitType')).toBe('CABINET_VISIT');
    request.flush(DOCTORS);

    expect(page.urgentPreference()).toBe('CABINET_VISIT');
    expect(page.urgentSearchResults().map((doctor) => doctor.id)).toEqual(['d-1', 'd-2']);
  });

  it('refreshes the search results on the safety-net interval as availability changes', () => {
    vi.useFakeTimers();
    try {
      const { page, http } = create({ tab: 'urgent' });
      flushInitial(http);
      page.searchUrgentDoctors();
      http
        .expectOne((request) => request.url === '/api/v1/urgent-requests/available-doctors')
        .flush(DOCTORS);
      expect(page.urgentSearchResults().map((doctor) => doctor.id)).toEqual(['d-1', 'd-2']);

      vi.advanceTimersByTime(30_000);
      const poll = http.expectOne(
        (request) => request.url === '/api/v1/urgent-requests/available-doctors',
      );
      expect(poll.request.params.get('lat')).toBe(String(36.8065));
      expect(page.urgentSearchLoading()).toBe(false);
      poll.flush([DOCTORS[1]]);

      expect(page.urgentSearchResults().map((doctor) => doctor.id)).toEqual(['d-2']);
      expect(page.urgentSearchError()).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('stops polling the urgent search when leaving the urgent tab', () => {
    vi.useFakeTimers();
    try {
      const { page, http } = create({ tab: 'urgent' });
      flushInitial(http);
      page.searchUrgentDoctors();
      http
        .expectOne((request) => request.url === '/api/v1/urgent-requests/available-doctors')
        .flush(DOCTORS);
      page.setTab('home');

      vi.advanceTimersByTime(60_000);
      http.expectNone((request) => request.url === '/api/v1/urgent-requests/available-doctors');
    } finally {
      vi.useRealTimers();
    }
  });

  it('refreshes the nearby doctors list while urgent mode is open', () => {
    vi.useFakeTimers();
    try {
      const { page, http } = create({ tab: 'doctors' });
      flushInitial(http);
      page.setDoctorMode('urgent');
      http
        .expectOne((request) => request.url === '/api/v1/urgent-requests/available-doctors')
        .flush(DOCTORS);
      expect(page.doctors().length).toBe(2);

      vi.advanceTimersByTime(30_000);
      http
        .expectOne((request) => request.url === '/api/v1/urgent-requests/available-doctors')
        .flush([DOCTORS[0]]);
      expect(page.doctors().map((doctor) => doctor.id)).toEqual(['d-1']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('sends an urgent request to every nearby doctor', () => {
    const { page, http } = create({ tab: 'urgent' });
    flushInitial(http);
    page.searchUrgentDoctors();
    http
      .expectOne((request) => request.url === '/api/v1/urgent-requests/available-doctors')
      .flush(DOCTORS);
    page.urgentNotes.set('Douleur');

    page.sendUrgent();
    const offer = {
      offerId: 'of-1',
      requestId: 'urgent-1',
      doctorId: 'd-1',
      status: 'PENDING',
      sentAt: '2026-08-13T09:00:00Z',
      respondedAt: null,
      patientName: 'Hedi Bouazizi',
      patientLatitude: 36.8065,
      patientLongitude: 10.1815,
      visitPreference: 'HOME_VISIT',
      notes: 'Douleur',
    };
    const request = http.expectOne('/api/v1/urgent-requests');
    expect(request.request.body).toEqual({
      patientLatitude: 36.8065,
      patientLongitude: 10.1815,
      visitPreference: 'HOME_VISIT',
      notes: 'Douleur',
    });
    request.flush({
      request: {
        id: 'urgent-1',
        patientId: 'p-1',
        patientLatitude: 36.8065,
        patientLongitude: 10.1815,
        visitPreference: 'HOME_VISIT',
        notes: 'Douleur',
        status: 'PENDING',
        selectedOfferId: null,
        createdAt: '2026-08-13T09:00:00Z',
        offers: [offer],
      },
      offers: [offer],
    });
    http
      .expectOne((request) => request.url === '/api/v1/urgent-requests/available-doctors')
      .flush(DOCTORS);
    http
      .expectOne((request) => request.url === '/api/v1/urgent-requests/urgent-1/offers')
      .flush([]);

    expect(page.urgentError()).toBeNull();
    expect(page.lastUrgentRequest()?.offers.map((item) => item.doctorId)).toEqual(['d-1']);
    expect(page.urgentPending()).toBe(true);
  });

  it('lists the accepted offers and selects the chosen doctor', () => {
    const { page, http } = create({ tab: 'urgent' });
    flushInitial(http);
    const offer = {
      offerId: 'of-1',
      requestId: 'urgent-1',
      doctorId: 'd-1',
      status: 'PENDING',
      sentAt: '2026-08-13T09:00:00Z',
      respondedAt: null,
      patientName: 'Hedi Bouazizi',
      patientLatitude: 36.8065,
      patientLongitude: 10.1815,
      visitPreference: 'HOME_VISIT',
      notes: 'Douleur',
    };
    page.sendUrgent();
    http.expectOne('/api/v1/urgent-requests').flush({
      request: {
        id: 'urgent-1',
        patientId: 'p-1',
        patientLatitude: 36.8065,
        patientLongitude: 10.1815,
        visitPreference: 'HOME_VISIT',
        notes: 'Douleur',
        status: 'PENDING',
        selectedOfferId: null,
        createdAt: '2026-08-13T09:00:00Z',
        offers: [offer],
      },
      offers: [offer],
    });
    http
      .expectOne((request) => request.url === '/api/v1/urgent-requests/available-doctors')
      .flush(DOCTORS);
    const accepted = [
      {
        offerId: 'of-1',
        doctorId: 'd-1',
        doctorName: 'Dr Amira Trabelsi',
        distanceKm: 3.2,
        acceptedAt: '2026-08-13T09:01:00Z',
      },
      {
        offerId: 'of-2',
        doctorId: 'd-2',
        doctorName: 'Dr Karim Ben Ali',
        distanceKm: 5.1,
        acceptedAt: '2026-08-13T09:01:30Z',
      },
    ];
    http
      .expectOne((request) => request.url === '/api/v1/urgent-requests/urgent-1/offers')
      .flush(accepted);

    expect(page.acceptedOffers().length).toBe(2);

    page.selectOffer('of-1');
    const select = http.expectOne('/api/v1/urgent-requests/urgent-1/select');
    expect(select.request.method).toBe('PATCH');
    expect(select.request.body).toEqual({ offerId: 'of-1' });
    select.flush({
      id: 'urgent-1',
      patientId: 'p-1',
      patientLatitude: 36.8065,
      patientLongitude: 10.1815,
      visitPreference: 'HOME_VISIT',
      notes: 'Douleur',
      status: 'MATCHED',
      selectedOfferId: 'of-1',
      createdAt: '2026-08-13T09:00:00Z',
      offers: [offer],
    });
    expect(page.lastUrgentRequest()?.status).toBe('MATCHED');
    expect(page.lastUrgentRequest()?.selectedOfferId).toBe('of-1');
    expect(page.offerSelectingId()).toBeNull();
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith([
      '/patient',
      'urgent-request',
      'urgent-1',
      'tracking',
    ]);
  });

  it('refreshes the accepted offers when an OFFER_ACCEPTED realtime event arrives', () => {
    const { page, http, urgentEvents } = create({ tab: 'urgent' });
    flushInitial(http);
    page.sendUrgent();
    const pendingRequest = {
      id: 'urgent-1',
      patientId: 'p-1',
      patientLatitude: 36.8065,
      patientLongitude: 10.1815,
      visitPreference: 'HOME_VISIT',
      notes: null,
      status: 'PENDING',
      selectedOfferId: null,
      createdAt: '2026-08-13T09:00:00Z',
      offers: [],
    };
    http.expectOne('/api/v1/urgent-requests').flush({
      request: pendingRequest,
      offers: [],
    });
    http
      .expectOne((request) => request.url === '/api/v1/urgent-requests/available-doctors')
      .flush(DOCTORS);
    http
      .expectOne((request) => request.url === '/api/v1/urgent-requests/urgent-1/offers')
      .flush([]);
    expect(page.acceptedOffers().length).toBe(0);

    urgentEvents.next({
      name: 'OFFER_ACCEPTED',
      data: { requestId: 'urgent-1', doctorId: 'd-1', doctorName: 'Dr Amira Trabelsi' },
      timestamp: '2026-08-13T09:01:00Z',
    });

    http
      .expectOne((request) => request.url === '/api/v1/urgent-requests/urgent-1')
      .flush(pendingRequest);
    http
      .expectOne((request) => request.url === '/api/v1/urgent-requests/urgent-1/offers')
      .flush([
        {
          offerId: 'of-1',
          doctorId: 'd-1',
          doctorName: 'Dr Amira Trabelsi',
          distanceKm: 3.2,
          acceptedAt: '2026-08-13T09:01:00Z',
        },
      ]);

    expect(page.acceptedOffers().length).toBe(1);
    expect(page.acceptedOffers()[0].doctorId).toBe('d-1');
  });

  it('ignores urgent realtime events for other requests', () => {
    const { page, http, urgentEvents } = create({ tab: 'urgent' });
    flushInitial(http);
    page.sendUrgent();
    http.expectOne('/api/v1/urgent-requests').flush({
      request: {
        id: 'urgent-1',
        patientId: 'p-1',
        patientLatitude: 36.8065,
        patientLongitude: 10.1815,
        visitPreference: 'HOME_VISIT',
        notes: null,
        status: 'PENDING',
        selectedOfferId: null,
        createdAt: '2026-08-13T09:00:00Z',
        offers: [],
      },
      offers: [],
    });
    http
      .expectOne((request) => request.url === '/api/v1/urgent-requests/available-doctors')
      .flush(DOCTORS);
    http
      .expectOne((request) => request.url === '/api/v1/urgent-requests/urgent-1/offers')
      .flush([]);

    urgentEvents.next({
      name: 'OFFER_ACCEPTED',
      data: { requestId: 'someone-elses-request' },
      timestamp: '2026-08-13T09:01:00Z',
    });

    http.verify();
    expect(page.acceptedOffers().length).toBe(0);
  });

  it('resets the urgent form after a submission', () => {
    const { page, http } = create({ tab: 'urgent' });
    flushInitial(http);
    page.sendUrgent();
    http.expectOne('/api/v1/urgent-requests').flush({
      request: {
        id: 'urgent-1',
        patientId: 'p-1',
        patientLatitude: 36.8065,
        patientLongitude: 10.1815,
        visitPreference: 'HOME_VISIT',
        notes: null,
        status: 'PENDING',
        selectedOfferId: null,
        createdAt: '2026-08-13T09:00:00Z',
        offers: [],
      },
      offers: [],
    });
    http
      .expectOne((request) => request.url === '/api/v1/urgent-requests/available-doctors')
      .flush(DOCTORS);
    http
      .expectOne((request) => request.url === '/api/v1/urgent-requests/urgent-1/offers')
      .flush([]);

    page.resetUrgentForm();

    expect(page.lastUrgentRequest()).toBeNull();
    expect(page.acceptedOffers()).toEqual([]);
    expect(page.urgentNotes()).toBe('');
  });

  it('saves the profile via PATCH', () => {
    const { page, http } = create({ tab: 'profile' });
    flushInitial(http);
    page.updateDraft('firstName', 'Noura');
    page.updateDraftFlag('notificationAppointments', {
      target: { checked: false },
    } as unknown as Event);

    page.saveProfile();
    const request = http.expectOne('/api/v1/profile');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({
      firstName: 'Noura',
      lastName: 'Bouazizi',
      dateOfBirth: '1990-04-12',
      gender: 'M',
      preferredLanguage: 'fr',
      notificationMedications: true,
      notificationAppointments: false,
      notificationPassport: false,
    });
    request.flush({ ...PROFILE, firstName: 'Noura', displayName: 'Noura Bouazizi' });

    expect(page.profileSaved()).toBe('Profil mis a jour.');
    expect(page.profile()?.firstName).toBe('Noura');
  });

  it('rejects a short new password without calling the API', () => {
    const { page, http } = create({ tab: 'profile' });
    flushInitial(http);
    page.passwordCurrent.set('old-password');
    page.passwordNew.set('short');
    page.passwordConfirm.set('short');

    page.changePassword();

    expect(page.passwordError()).toContain('12 caracteres');
  });

  it('gates the workspace while the password must change', () => {
    const { page, http } = create({ mustChangePassword: true });
    expect(page.locked()).toBe(true);
    http.verify();
  });

  it('unlocks and initializes the workspace after changing the temporary password', () => {
    const { page, http } = create({ mustChangePassword: true });
    expect(page.locked()).toBe(true);

    page.passwordCurrent.set('old-password');
    page.passwordNew.set('new-password-123');
    page.passwordConfirm.set('new-password-123');
    page.changePassword();
    const request = http.expectOne('/api/v1/auth/password/change');
    expect(request.request.body).toEqual({
      currentPassword: 'old-password',
      newPassword: 'new-password-123',
    });
    request.flush(null);

    expect(page.locked()).toBe(false);
    flushInitial(http);
    expect(page.profile()?.firstName).toBe('Hedi');
  });
});
