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
  /**
   * A secretary works inside the doctor's workspace on a restricted set of
   * destinations, so it lands on the same shell rather than on a separate
   * dashboard. This case must stay explicit: the generic fall-through below
   * would otherwise send a freshly invited secretary to /forbidden.
   */
  if (role === 'SECRETARY') return '/doctor';
  if (role === 'PATIENT') return '/patient';
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
