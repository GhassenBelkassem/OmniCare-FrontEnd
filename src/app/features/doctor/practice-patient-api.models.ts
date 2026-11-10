export type PracticePatientSourceDto = 'MANUAL' | 'IMPORTED' | 'OMNICARE';
export type PracticePatientSexDto = 'M' | 'F' | 'autre';
export type PracticePatientFilterDto = 'ALL' | 'LINKED' | 'EXTERNAL';
export type PracticePatientMrsReadinessDto = 'PREPARING' | 'RETRYING' | 'READY' | 'ACTION_REQUIRED';
export type ExternalPatientStatusDto = 'UNCLAIMED' | 'CLAIM_PENDING' | 'CLAIMED';

export interface PracticePatientDto {
  readonly id: string;
  readonly doctorId: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly dateOfBirth: string | null;
  readonly approximateAgeYears: number | null;
  readonly sex: PracticePatientSexDto | null;
  readonly phone: string | null;
  readonly practiceIdentifier: string | null;
  readonly email: string | null;
  readonly address: string | null;
  readonly source: PracticePatientSourceDto;
  readonly linkedOmniCareUserId: string | null;
  readonly mrsPatientId: string | null;
  readonly mrsProvisioned: boolean;
  readonly possibleOmniCareMatch: boolean;
  readonly possibleDuplicate: boolean;
  readonly mrsReadiness: PracticePatientMrsReadinessDto;
  readonly externalPatientStatus: ExternalPatientStatusDto;
  readonly lastConsultationAt: string | null;
  readonly nextAppointmentAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreatePracticePatientRequestDto {
  readonly firstName: string;
  readonly lastName: string;
  readonly dateOfBirth?: string;
  readonly approximateAgeYears?: number;
  readonly sex: PracticePatientSexDto;
  readonly phone?: string;
  readonly practiceIdentifier?: string;
  readonly email?: string;
  readonly address?: string;
}

export type PracticePatientDuplicateReasonDto =
  'SAME_PHONE' | 'SAME_PRACTICE_IDENTIFIER' | 'SAME_NAME_AND_BIRTH';

export interface PracticePatientDuplicateCandidateDto {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly dateOfBirth: string | null;
  readonly approximateAgeYears: number | null;
  readonly phone: string | null;
  readonly practiceIdentifier: string | null;
  readonly matchReasons: readonly PracticePatientDuplicateReasonDto[];
}

export interface LinkOmniCareUserRequestDto {
  readonly omniCareUserId: string;
}

export interface CreatePracticePatientAppointmentRequestDto {
  readonly practiceLocationId: string;
  readonly startTime: string;
  readonly endTime: string;
}

export interface PracticePatientAppointmentDto {
  readonly id: string;
  readonly doctorId: string;
  readonly patientId: string | null;
  readonly patientName: string | null;
  readonly startTime: string;
  readonly endTime: string;
  readonly status: string;
  readonly source: 'PRACTICE_PATIENT';
  readonly createdAt: string;
  readonly subjectType: 'PRACTICE_PATIENT';
  readonly practicePatientId: string;
}

export interface PracticePatientReconciliationDto {
  readonly patientId: string;
  readonly authorityVersion: number;
  readonly status: 'QUEUED';
  readonly replayed: boolean;
}

export interface DuplicatePracticePhoneDto {
  readonly existingPatientId: string;
}

export interface PageDto<T> {
  readonly content: readonly T[];
  readonly totalElements: number;
  readonly totalPages: number;
  readonly size: number;
  readonly number: number;
  readonly first: boolean;
  readonly last: boolean;
  readonly empty: boolean;
}
