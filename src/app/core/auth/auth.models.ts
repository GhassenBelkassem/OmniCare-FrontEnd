export type DashboardRole =
  | 'PATIENT'
  | 'DOCTOR'
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

export interface EmailPasswordLoginResponse {
  readonly status: 'AUTHENTICATED' | 'REQUIRES_PHONE_OTP';
  readonly session: LoginSession | null;
  readonly phone: string | null;
}

export interface ApiErrorBody {
  readonly code?: string;
  readonly message?: string;
  readonly fieldErrors?: Readonly<Record<string, string>>;
}
