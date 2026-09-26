export type AccountStatus = 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';
export type ManagedProfessionalRole =
  | 'DOCTOR'
  | 'CLINIC_ADMIN'
  | 'CLINIC_ASSISTANT'
  | 'CLINIC_MEDECIN'
  | 'CLINIC_INFIRMIERE'
  | 'CLINIC_KINE';

export interface AdminProfessional {
  readonly userId: string;
  readonly email: string;
  readonly phone: string | null;
  readonly role: ManagedProfessionalRole;
  readonly status: AccountStatus;
  readonly specialty: string | null;
  readonly governorate: string | null;
  readonly professionalLicenseNumber: string | null;
  readonly licenseVerifiedAt: string | null;
  readonly affiliatedClinicId: string | null;
  readonly alsoIndependent: boolean;
  readonly invitationStatus: InvitationStatus | null;
  readonly invitationExpiresAt: string | null;
  readonly firstLoginAt: string | null;
  readonly lastActiveAt: string | null;
}

export interface ProfessionalPage {
  readonly items: readonly AdminProfessional[];
  readonly page: number;
  readonly pageSize: number;
  readonly totalElements: number;
  readonly totalPages: number;
}

export interface CreateDoctorInput {
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly phone: string | null;
  readonly professionalLicenseNumber: string;
  readonly specialty: string;
  readonly governorate: string;
}

export interface ProfessionalSession {
  readonly sessionId: string;
  readonly deviceLabel: string;
  readonly platform: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly lastSeenAt: string | null;
  readonly revokedAt: string | null;
}

export interface Clinic {
  readonly id: string;
  readonly name: string;
  readonly contactEmail: string;
  readonly contactPhone: string;
  readonly governorate: string;
  readonly address: string;
  readonly inpdpNumber: string;
  readonly status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
  readonly administratorCount: number;
  readonly createdAt: string;
}

export interface ClinicPage {
  readonly items: readonly Clinic[];
  readonly page: number;
  readonly pageSize: number;
  readonly totalElements: number;
  readonly totalPages: number;
}

export interface CreateClinicInput {
  readonly name: string;
  readonly contactEmail: string;
  readonly contactPhone: string;
  readonly governorate: string;
  readonly address: string;
  readonly inpdpNumber: string;
}

export interface ClinicMembership {
  readonly id: string;
  readonly clinicId: string;
  readonly userId: string;
  readonly email: string;
  readonly role: 'CLINIC_ADMIN';
  readonly status: 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'ENDED';
  readonly invitedAt: string;
  readonly activatedAt: string | null;
}
