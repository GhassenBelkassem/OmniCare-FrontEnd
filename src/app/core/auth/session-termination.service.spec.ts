import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { LoginSession } from './auth.models';
import { SensitiveStateRegistry } from './sensitive-state.registry';
import { SessionTerminationService } from './session-termination.service';
import { AuthTokenStore } from './auth-token.store';

describe('SessionTerminationService', () => {
  const router = {
    url: '/doctor/consultation/c-1',
    navigateByUrl: vi.fn(() => Promise.resolve(true)),
  };

  beforeEach(() => {
    router.url = '/doctor/consultation/c-1';
    router.navigateByUrl.mockClear();
    TestBed.configureTestingModule({ providers: [{ provide: Router, useValue: router }] });
  });

  it('atomically clears credentials, registered sensitive state, and navigates safely', async () => {
    const tokens = TestBed.inject(AuthTokenStore);
    const registry = TestBed.inject(SensitiveStateRegistry);
    let consultation: string | null = 'doctor-a-consultation';
    let realtimeConnected = true;
    registry.register(() => {
      consultation = null;
    });
    registry.register(() => {
      realtimeConnected = false;
    });
    tokens.setSession(session('doctor-a'));

    const termination = TestBed.inject(SessionTerminationService);
    await Promise.all([
      termination.terminate('EXPLICIT_LOGOUT'),
      termination.terminate('REFRESH_REJECTED'),
    ]);

    expect(tokens.authState()).toBe('ANONYMOUS');
    expect(tokens.accessToken()).toBeNull();
    expect(consultation).toBeNull();
    expect(realtimeConnected).toBe(false);
    expect(router.navigateByUrl).toHaveBeenCalledTimes(1);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
  });

  it('does not expose Doctor A state after Doctor B authenticates in the same browser', async () => {
    const tokens = TestBed.inject(AuthTokenStore);
    const registry = TestBed.inject(SensitiveStateRegistry);
    let selectedPatient: string | null = 'doctor-a-patient';
    registry.register(() => {
      selectedPatient = null;
    });
    tokens.setSession(session('doctor-a'));

    await TestBed.inject(SessionTerminationService).terminate('EXPLICIT_LOGOUT');
    tokens.setSession(session('doctor-b'));

    expect(tokens.user()?.id).toBe('doctor-b');
    expect(selectedPatient).toBeNull();
  });
});

function session(userId: string): LoginSession {
  return {
    accessToken: `${userId}-access`,
    tokenType: 'Bearer',
    expiresAt: '2999-01-01T00:00:00Z',
    refreshToken: `${userId}-refresh`,
    refreshExpiresAt: '2999-01-02T00:00:00Z',
    user: { id: userId, role: 'DOCTOR', mustChangePassword: false },
  };
}
