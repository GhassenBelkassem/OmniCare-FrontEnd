export type DashboardRole =
  | 'PATIENT'
  | 'DOCTOR'
  | 'SECRETARY'
  | 'NURSE'
  | 'KINE'
  | 'CLINIC_MEDECIN'
  | 'CLINIC_INFIRMIERE'
  | 'CLINIC_KINE'
  | 'CLINIC_ASSISTANT'
  | 'CLINIC_ADMIN'
  | 'ADMIN';

export const DASHBOARD_ROLES: readonly DashboardRole[] = [
  'PATIENT',
  'DOCTOR',
  'SECRETARY',
  'NURSE',
  'KINE',
  'CLINIC_MEDECIN',
  'CLINIC_INFIRMIERE',
  'CLINIC_KINE',
  'CLINIC_ASSISTANT',
  'CLINIC_ADMIN',
  'ADMIN',
];

export function isDashboardRole(value: unknown): value is DashboardRole {
  return typeof value === 'string' && DASHBOARD_ROLES.includes(value as DashboardRole);
}

export function dashboardRouteFor(role: DashboardRole): string {
  if (role === 'ADMIN') return '/admin';
  if (role === 'DOCTOR') return '/doctor';
  if (role === 'SECRETARY') return '/doctor';
  // Patient care is delivered by the Flutter mobile application. The legacy
  // Angular Patient workspace is development-only and must never become the
  // authenticated production landing page.
  if (role === 'PATIENT') return '/forbidden';
  if (role.startsWith('CLINIC_')) return '/clinic';
  return '/forbidden';
}

export interface AuthenticatedUser {
  readonly id: string;
  readonly role: DashboardRole;
  readonly mustChangePassword: boolean;
}

export interface LoginSession {
  readonly accessToken: string;
  readonly tokenType: 'Bearer';
  readonly expiresAt: string;
  readonly refreshToken: string;
  readonly refreshExpiresAt: string;
  readonly user: AuthenticatedUser;
}

/** Runtime guard for the credential-bearing responses that TypeScript cannot validate. */
export function isLoginSessionPayload(value: unknown): value is LoginSession {
  if (!isRecord(value)) return false;
  return (
    nonEmptyString(value['accessToken']) &&
    value['tokenType'] === 'Bearer' &&
    validTimestamp(value['expiresAt']) &&
    nonEmptyString(value['refreshToken']) &&
    validTimestamp(value['refreshExpiresAt']) &&
    isAuthenticatedUser(value['user'])
  );
}

export interface EmailPasswordLoginResponse {
  readonly status: 'AUTHENTICATED' | 'REQUIRES_PHONE_OTP';
  readonly session: LoginSession | null;
  readonly phone: string | null;
}

export type LoginOutcome =
  | { readonly kind: 'AUTHENTICATED'; readonly role: DashboardRole }
  | { readonly kind: 'PASSWORD_CHANGE_REQUIRED' }
  | { readonly kind: 'OTP_REQUIRED' };

export interface PhoneOtpChallenge {
  readonly phone: string;
  readonly device: DevicePayload;
}

export interface DevicePayload {
  readonly deviceFingerprint: string;
  readonly platform: 'WEB';
  readonly deviceLabel: string;
  readonly sharedDevice: boolean;
  readonly rememberDevice: boolean;
}

export interface ApiErrorBody {
  readonly code?: string;
  readonly message?: string;
  readonly fieldErrors?: Readonly<Record<string, string>>;
}

function isAuthenticatedUser(value: unknown): value is AuthenticatedUser {
  if (!isRecord(value)) return false;
  return (
    nonEmptyString(value['id']) &&
    isDashboardRole(value['role']) &&
    typeof value['mustChangePassword'] === 'boolean'
  );
}

function validTimestamp(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null;
}
