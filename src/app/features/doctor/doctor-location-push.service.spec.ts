import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { authInterceptor } from '../../core/auth/auth.interceptor';
import { AuthTokenStore } from '../../core/auth/auth-token.store';
import { RUNTIME_CONFIG } from '../../core/config/runtime-config';
import { ActiveMatchedRequestStore } from './active-matched-request.store';
import { DoctorLocationPushService } from './doctor-location-push.service';

type FixCallback = (position: { coords: { latitude: number; longitude: number } }) => void;
type ErrorCallback = (error: unknown) => void;

describe('DoctorLocationPushService', () => {
  let watchPosition: ReturnType<typeof vi.fn>;
  let clearWatch: ReturnType<typeof vi.fn>;

  function create(): {
    service: DoctorLocationPushService;
    store: ActiveMatchedRequestStore;
    http: HttpTestingController;
  } {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: '/api/v1' } },
      ],
    });
    const tokens = TestBed.inject(AuthTokenStore);
    tokens.setSession({
      accessToken: 'doctor-access-token',
      tokenType: 'Bearer',
      expiresAt: '2026-08-21T23:59:59Z',
      refreshToken: 'doctor-refresh-token',
      refreshExpiresAt: '2026-08-22T23:59:59Z',
      user: { id: 'doc-1', role: 'DOCTOR', mustChangePassword: false },
    });
    const store = TestBed.inject(ActiveMatchedRequestStore);
    const service = TestBed.inject(DoctorLocationPushService);
    return { service, store, http: TestBed.inject(HttpTestingController) };
  }

  function emitFix(latitude: number, longitude: number): void {
    const [onFix] = watchPosition.mock.calls[0] as [FixCallback, ErrorCallback, unknown];
    onFix({ coords: { latitude, longitude } });
  }

  beforeEach(() => {
    vi.useFakeTimers();
    watchPosition = vi.fn(() => 42);
    clearWatch = vi.fn();
    vi.stubGlobal('navigator', {
      geolocation: { watchPosition, clearWatch },
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('does not watch the position while no request is active', () => {
    create();
    TestBed.tick();

    expect(watchPosition).not.toHaveBeenCalled();
    expect(clearWatch).not.toHaveBeenCalled();
  });

  it('starts watching and pushes a fix for each matched request', () => {
    const { service, store, http } = create();

    store.markMatched('r-1');
    TestBed.tick();
    expect(watchPosition).toHaveBeenCalledTimes(1);
    expect(service.pushing()).toBe(true);

    emitFix(36.8065, 10.1815);
    const request = http.expectOne('/api/v1/urgent-requests/r-1/location');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ latitude: 36.8065, longitude: 10.1815 });
    request.flush(null);
  });

  it('pushes one fix per active request', () => {
    const { store, http } = create();

    store.markMatched('r-1');
    store.markMatched('r-2');
    TestBed.tick();

    emitFix(36.8, 10.18);
    for (const id of ['r-1', 'r-2']) {
      http.expectOne(`/api/v1/urgent-requests/${id}/location`).flush(null);
    }
  });

  it('throttles pushes to at most one every five seconds', () => {
    const { store, http } = create();

    store.markMatched('r-1');
    TestBed.tick();

    emitFix(36.8, 10.18);
    http.expectOne('/api/v1/urgent-requests/r-1/location').flush(null);

    emitFix(36.81, 10.19);
    http.expectNone((request) => request.url.includes('/location'));

    vi.advanceTimersByTime(5_000);
    emitFix(36.82, 10.2);
    const second = http.expectOne('/api/v1/urgent-requests/r-1/location');
    expect(second.request.body).toEqual({ latitude: 36.82, longitude: 10.2 });
    second.flush(null);
  });

  it('stops watching once no request is active anymore', () => {
    const { service, store } = create();

    store.markMatched('r-1');
    TestBed.tick();
    store.markClosed('r-1');
    TestBed.tick();

    expect(clearWatch).toHaveBeenCalledWith(42);
    expect(service.pushing()).toBe(false);
  });

  it('keeps the watcher alive but stops pushing when fixes fail', () => {
    const { service, store, http } = create();

    store.markMatched('r-1');
    TestBed.tick();

    const [, onError] = watchPosition.mock.calls[0] as [FixCallback, ErrorCallback, unknown];
    onError({ code: 1, message: 'permission denied' });

    http.expectNone((request) => request.url.includes('/location'));
    expect(watchPosition).toHaveBeenCalledTimes(1);
    expect(service.pushing()).toBe(true);
  });
});
