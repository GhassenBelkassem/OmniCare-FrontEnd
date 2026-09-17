export type DashboardRole = 'ADMIN' | 'DOCTOR' | 'CLINIC_ADMIN' | 'PATIENT';

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
