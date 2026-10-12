import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../../../core/auth/auth.service';
import {
  AccountDeviceResponse,
  AccountSecuritySummaryResponse,
  ChangePasswordRequest,
} from './account-security-api.models';
import { AccountSecurityApiService } from './account-security-api.service';
import { AccountSecuritySection } from './account-security-section';

const SUMMARY: AccountSecuritySummaryResponse = {
  accountType: 'DOCTOR',
  email: 'doctor@omnicare.tn',
  emailVerified: true,
  phone: '+21620123456',
  phoneVerified: false,
  hasPassword: true,
  mustChangePassword: false,
  mfaMethod: 'NONE',
};

const CURRENT_DEVICE: AccountDeviceResponse = {
  deviceId: 'current-device-secret-id',
  label: 'OmniCare dashboard',
  platform: 'WEB',
  current: true,
  lastSeenAt: '2026-10-06T11:00:00Z',
  activeSessionCount: 1,
  revokedAt: null,
};

const OTHER_DEVICE: AccountDeviceResponse = {
  deviceId: 'other-device-secret-id',
  label: 'Téléphone professionnel',
  platform: 'ANDROID',
  current: false,
  lastSeenAt: '2026-10-05T09:30:00Z',
  activeSessionCount: 1,
  revokedAt: null,
};

interface AccountApiStub {
  getSummary: ReturnType<typeof vi.fn<() => Observable<AccountSecuritySummaryResponse>>>;
  getDevices: ReturnType<typeof vi.fn<() => Observable<readonly AccountDeviceResponse[]>>>;
  changePassword: ReturnType<typeof vi.fn<(request: ChangePasswordRequest) => Observable<void>>>;
  logoutDevice: ReturnType<typeof vi.fn<(deviceId: string) => Observable<void>>>;
}

interface AuthStub {
  logoutAll: ReturnType<typeof vi.fn<() => Observable<void>>>;
}

describe('AccountSecuritySection', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('shows independent loading states before authoritative responses complete', () => {
    const summary = new Subject<AccountSecuritySummaryResponse>();
    const devices = new Subject<readonly AccountDeviceResponse[]>();
    const { component, fixture, api } = createComponent({
      getSummary: vi.fn(() => summary),
      getDevices: vi.fn(() => devices),
    });

    fixture.detectChanges();

    expect(api.getSummary).toHaveBeenCalledOnce();
    expect(api.getDevices).toHaveBeenCalledOnce();
    expect(component.summaryState()).toBe('loading');
    expect(component.devicesState()).toBe('loading');
    expect(fixture.nativeElement.textContent).toContain('Chargement des informations de sécurité');
    expect(fixture.nativeElement.textContent).toContain('Chargement des appareils actifs');
    expect(fixture.nativeElement.textContent).not.toContain('doctor@omnicare.tn');
  });

  it('renders safe account values and verified/unverified contact states read-only', () => {
    const { fixture } = createComponent();

    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Médecin');
    expect(text).toContain('doctor@omnicare.tn');
    expect(text).toContain('+21620123456');
    expect(text).toContain('Vérifié');
    expect(text).toContain('Non vérifié');
    expect(text).toContain('lecture seule');
    expect(text).not.toContain('locked_reason');
    expect(text).not.toContain('tokenHash');
    expect(text).not.toContain('Modifier l’email');
    expect(text).not.toContain('Modifier le téléphone');
  });

  it('retries a failed account summary without blanking the independent devices section', () => {
    const getSummary = vi
      .fn<() => Observable<AccountSecuritySummaryResponse>>()
      .mockReturnValueOnce(throwError(() => new Error('failed')))
      .mockReturnValueOnce(of(SUMMARY));
    const { component, fixture } = createComponent({ getSummary });
    fixture.detectChanges();

    expect(component.summaryState()).toBe('error');
    expect(component.devicesState()).toBe('loaded');

    component.loadSummary();
    fixture.detectChanges();

    expect(getSummary).toHaveBeenCalledTimes(2);
    expect(component.summaryState()).toBe('loaded');
  });

  it('prioritizes the password form when a password change is required', () => {
    const { component, fixture } = createComponent({
      getSummary: vi.fn(() => of({ ...SUMMARY, mustChangePassword: true })),
    });

    fixture.detectChanges();

    expect(component.passwordFormOpen()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Modification requise');
    expect(fixture.nativeElement.querySelector('#account-current-password')).not.toBeNull();
  });

  it('rejects mismatched confirmation without sending credentials', () => {
    const { component, fixture, api } = createComponent();
    fixture.detectChanges();
    component.openPasswordForm();
    component.passwordForm.setValue({
      currentPassword: 'CurrentPassword123',
      newPassword: 'NewPassword12345',
      confirmation: 'DifferentPassword123',
    });

    component.changePassword();

    expect(component.passwordForm.hasError('passwordMismatch')).toBe(true);
    expect(api.changePassword).not.toHaveBeenCalled();
    expect(component.passwordFieldError('confirmation')).toContain('ne correspondent pas');
  });

  it('sends the exact password contract and clears every password field after success', () => {
    const { component, fixture, api } = createComponent();
    fixture.detectChanges();
    component.openPasswordForm();
    component.passwordForm.setValue({
      currentPassword: 'CurrentPassword123',
      newPassword: 'NewPassword12345',
      confirmation: 'NewPassword12345',
    });

    component.changePassword();

    expect(api.changePassword).toHaveBeenCalledWith({
      currentPassword: 'CurrentPassword123',
      newPassword: 'NewPassword12345',
    });
    expect(component.passwordForm.getRawValue()).toEqual({
      currentPassword: '',
      newPassword: '',
      confirmation: '',
    });
    expect(component.passwordFormOpen()).toBe(false);
    expect(component.passwordSuccess()).toContain('modifié');
  });

  it('shows an authoritative password error and removes the rejected current password', () => {
    const { component, fixture } = createComponent({
      changePassword: vi.fn(() => throwError(() => new Error('rejected'))),
    });
    fixture.detectChanges();
    component.openPasswordForm();
    component.passwordForm.setValue({
      currentPassword: 'WrongPassword123',
      newPassword: 'NewPassword12345',
      confirmation: 'NewPassword12345',
    });

    component.changePassword();

    expect(component.passwordError()).toContain('Impossible');
    expect(component.passwordForm.controls.currentPassword.value).toBe('');
    expect(component.passwordForm.controls.newPassword.value).toBe('NewPassword12345');
  });

  it('renders MFA as read-only for both unconfigured and configured methods', () => {
    const none = createComponent();
    none.fixture.detectChanges();
    expect(none.fixture.nativeElement.textContent).toContain('Non configurée');
    expect(none.fixture.nativeElement.querySelector('oc-switch')).toBeNull();

    TestBed.resetTestingModule();
    const configured = createComponent({
      getSummary: vi.fn(() => of({ ...SUMMARY, mfaMethod: 'TOTP' })),
    });
    configured.fixture.detectChanges();
    expect(configured.fixture.nativeElement.textContent).toContain(
      'Application d’authentification',
    );
    expect(configured.fixture.nativeElement.textContent).not.toContain('Activer MFA');
    expect(configured.fixture.nativeElement.textContent).not.toContain('Désactiver MFA');
  });

  it('lists safe devices, distinguishes current session and never displays internal IDs', () => {
    const { fixture } = createComponent({
      getDevices: vi.fn(() => of([CURRENT_DEVICE, OTHER_DEVICE])),
    });

    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('OmniCare dashboard');
    expect(text).toContain('Téléphone professionnel');
    expect(text).toContain('Session actuelle');
    expect(text).toContain('Navigateur web');
    expect(text).toContain('Android');
    expect(text).not.toContain(CURRENT_DEVICE.deviceId);
    expect(text).not.toContain(OTHER_DEVICE.deviceId);
    expect(text).not.toContain('user-agent');
    expect(text).not.toContain('Adresse IP');
  });

  it('handles empty and failed device loads without affecting account summary', () => {
    const empty = createComponent();
    empty.fixture.detectChanges();
    expect(empty.fixture.nativeElement.textContent).toContain('Aucun appareil actif');
    expect(empty.component.summaryState()).toBe('loaded');

    TestBed.resetTestingModule();
    const failed = createComponent({
      getDevices: vi.fn(() => throwError(() => new Error('failed'))),
    });
    failed.fixture.detectChanges();
    expect(failed.component.devicesState()).toBe('error');
    expect(failed.component.summaryState()).toBe('loaded');
    expect(failed.fixture.nativeElement.textContent).toContain(
      'Impossible de charger les appareils',
    );
  });

  it('revokes only another device and refreshes the authoritative list after success', () => {
    const logout = new Subject<void>();
    const getDevices = vi
      .fn<() => Observable<readonly AccountDeviceResponse[]>>()
      .mockReturnValueOnce(of([CURRENT_DEVICE, OTHER_DEVICE]))
      .mockReturnValueOnce(of([CURRENT_DEVICE]));
    const { component, fixture, api } = createComponent({
      getDevices,
      logoutDevice: vi.fn(() => logout),
    });
    fixture.detectChanges();

    component.requestDeviceLogout(OTHER_DEVICE);
    component.confirmDeviceLogout();

    expect(api.logoutDevice).toHaveBeenCalledWith(OTHER_DEVICE.deviceId);
    expect(component.devices()).toEqual([CURRENT_DEVICE, OTHER_DEVICE]);

    logout.next();
    logout.complete();

    expect(getDevices).toHaveBeenCalledTimes(2);
    expect(component.devices()).toEqual([CURRENT_DEVICE]);
  });

  it('retains the authoritative device list when revocation fails', () => {
    const { component, fixture } = createComponent({
      getDevices: vi.fn(() => of([CURRENT_DEVICE, OTHER_DEVICE])),
      logoutDevice: vi.fn(() => throwError(() => new Error('rejected'))),
    });
    fixture.detectChanges();

    component.requestDeviceLogout(OTHER_DEVICE);
    component.confirmDeviceLogout();

    expect(component.devices()).toEqual([CURRENT_DEVICE, OTHER_DEVICE]);
    expect(component.deviceMutationError()).toContain('Impossible');
  });

  it('states that logout-all includes the current session and delegates full auth cleanup', () => {
    const { component, fixture, auth } = createComponent({
      getDevices: vi.fn(() => of([CURRENT_DEVICE])),
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('y compris celui-ci');
    component.logoutAllConfirmOpen.set(true);
    component.confirmLogoutAll();

    expect(auth.logoutAll).toHaveBeenCalledOnce();
    expect(component.logoutAllConfirmOpen()).toBe(false);
  });
});

function createComponent(overrides: Partial<AccountApiStub> = {}): {
  component: AccountSecuritySection;
  fixture: ComponentFixture<AccountSecuritySection>;
  api: AccountApiStub;
  auth: AuthStub;
} {
  const api: AccountApiStub = {
    getSummary: vi.fn(() => of(SUMMARY)),
    getDevices: vi.fn(() => of([])),
    changePassword: vi.fn(() => of(undefined)),
    logoutDevice: vi.fn(() => of(undefined)),
    ...overrides,
  };
  const auth: AuthStub = { logoutAll: vi.fn(() => of(undefined)) };
  TestBed.configureTestingModule({
    imports: [AccountSecuritySection],
    providers: [
      { provide: AccountSecurityApiService, useValue: api },
      { provide: AuthService, useValue: auth },
    ],
  });
  const fixture = TestBed.createComponent(AccountSecuritySection);
  return { component: fixture.componentInstance, fixture, api, auth };
}
