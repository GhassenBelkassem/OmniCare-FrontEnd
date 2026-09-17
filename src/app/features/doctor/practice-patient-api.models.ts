export type PracticePatientSourceDto = 'MANUAL' | 'IMPORTED' | 'OMNICARE';
export type PracticePatientSexDto = 'M' | 'F' | 'autre';
export type PracticePatientFilterDto = 'ALL' | 'LINKED' | 'EXTERNAL';

export interface PracticePatientDto {
  readonly id: string;
  readonly doctorId: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly dateOfBirth: string | null;
  readonly sex: PracticePatientSexDto | null;
  readonly phone: string;
  readonly email: string | null;
  readonly address: string | null;
  readonly source: PracticePatientSourceDto;
  readonly linkedOmniCareUserId: string | null;
  readonly mrsPatientId: string | null;
  readonly mrsProvisioned: boolean;
  readonly possibleOmniCareMatch: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreatePracticePatientRequestDto {
  readonly firstName: string;
  readonly lastName: string;
  readonly dateOfBirth: string;
  readonly sex: PracticePatientSexDto;
  readonly phone: string;
  readonly email?: string;
  readonly address?: string;
}

export interface LinkOmniCareUserRequestDto {
  readonly omniCareUserId: string;
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
