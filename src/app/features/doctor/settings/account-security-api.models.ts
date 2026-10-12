export interface AccountSecuritySummaryResponse {
  readonly accountType: string;
  readonly email: string | null;
  readonly emailVerified: boolean;
  readonly phone: string | null;
  readonly phoneVerified: boolean;
  readonly hasPassword: boolean;
  readonly mustChangePassword: boolean;
  readonly mfaMethod: string;
}

export interface AccountDeviceResponse {
  readonly deviceId: string;
  readonly label: string | null;
  readonly platform: string | null;
  readonly current: boolean;
  readonly lastSeenAt: string | null;
  readonly activeSessionCount: number;
  readonly revokedAt: string | null;
}

export interface ChangePasswordRequest {
  readonly currentPassword: string;
  readonly newPassword: string;
}
