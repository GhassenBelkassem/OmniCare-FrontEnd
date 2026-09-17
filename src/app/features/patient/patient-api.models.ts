import type {
  UrgentOfferDto,
  UrgentOfferStatusDto,
  UrgentVisitPreferenceDto,
} from '../doctor/appointment-api.models';

export type {
  AppointmentDto,
  BookingRequestDto,
  SlotDto,
  UrgentOfferDto,
  UrgentOfferStatusDto,
  UrgentVisitPreferenceDto,
} from '../doctor/appointment-api.models';

export type UrgentRequestStatusDto = 'PENDING' | 'MATCHED' | 'ARRIVED' | 'CANCELLED' | 'EXPIRED';

export type BodyPartDto =
  | 'HEAD'
  | 'NECK'
  | 'CHEST'
  | 'ABDOMEN'
  | 'BACK'
  | 'LEFT_ARM'
  | 'RIGHT_ARM'
  | 'LEFT_LEG'
  | 'RIGHT_LEG'
  | 'FULL_BODY'
  | 'OTHER';

export interface SymptomsRequestDto {
  readonly bodyParts?: readonly BodyPartDto[] | null;
  readonly painLevel?: number | null;
  readonly notes?: string | null;
}

export interface AvailableDoctorDto {
  readonly doctorId: string;
  readonly name: string;
  readonly specialty: string | null;
  readonly distanceKm: number;
}

export interface DoctorDirectoryDto {
  readonly doctorId: string;
  readonly displayName: string;
  readonly specialty: string | null;
  readonly photoUrl: string | null;
  readonly affiliatedClinicId: string | null;
  readonly availableForUrgent: boolean;
}

export interface UrgentRequestDto {
  readonly id: string;
  readonly patientId: string;
  readonly patientLatitude: number;
  readonly patientLongitude: number;
  readonly visitPreference: UrgentVisitPreferenceDto | null;
  readonly notes: string | null;
  readonly status: UrgentRequestStatusDto;
  readonly selectedOfferId: string | null;
  readonly matchedAt: string | null;
  readonly arrivedAt: string | null;
  readonly createdAt: string;
  readonly offers: readonly UrgentOfferDto[];
}

export interface UrgentRequestCreateRequestDto {
  readonly patientLatitude: number;
  readonly patientLongitude: number;
  readonly visitPreference: UrgentVisitPreferenceDto;
  readonly notes: string;
  readonly symptoms?: SymptomsRequestDto | null;
}

export interface UrgentRequestCreateResponseDto {
  readonly request: UrgentRequestDto;
  readonly offers: readonly UrgentOfferDto[];
}

export interface AcceptedOfferSummaryDto {
  readonly offerId: string;
  readonly doctorId: string;
  readonly doctorName: string;
  readonly distanceKm: number;
  readonly acceptedAt: string;
}

export interface SelectDoctorRequestDto {
  readonly offerId: string;
}

export interface PatientProfileDto {
  readonly userId: string;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly displayName: string | null;
  readonly dateOfBirth: string | null;
  readonly gender: string | null;
  readonly photoUrl: string | null;
  readonly bloodType: string | null;
  readonly heightCm: number | null;
  readonly weightKg: number | null;
  readonly bmi: number | null;
  readonly patientId: string;
  readonly passportCompletion: number;
  readonly onboardingCompleted: boolean;
  readonly onboardingStep: number;
  readonly preferredLanguage: string | null;
  readonly notificationMedications: boolean;
  readonly notificationAppointments: boolean;
  readonly notificationPassport: boolean;
}

export interface UpdateProfileRequestDto {
  readonly firstName?: string | null;
  readonly lastName?: string | null;
  readonly dateOfBirth?: string | null;
  readonly gender?: string | null;
  readonly preferredLanguage?: string | null;
  readonly notificationMedications?: boolean;
  readonly notificationAppointments?: boolean;
  readonly notificationPassport?: boolean;
}

export interface ChangePasswordRequestDto {
  readonly currentPassword: string;
  readonly newPassword: string;
}
