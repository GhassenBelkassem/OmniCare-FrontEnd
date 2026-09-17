export type DayOfWeekDto =
  'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';
export type AvailabilityExceptionTypeDto = 'BLOCK' | 'EXTRA';
export type AppointmentStatusDto =
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'CANCELLED'
  | 'COMPLETED'
  | 'NO_SHOW'
  | string;
export type AppointmentSourceDto = 'WEB' | 'MOBILE' | 'QR' | 'URGENT' | string;

export interface AvailabilityRuleDto {
  readonly id?: string;
  readonly doctorId?: string;
  readonly dayOfWeek: DayOfWeekDto;
  readonly active: boolean;
  readonly startTime: string;
  readonly endTime: string;
  readonly pauseStart: string | null;
  readonly pauseEnd: string | null;
  readonly slotDurationMinutes: number;
}

export interface AvailabilityExceptionDto {
  readonly id: string;
  readonly doctorId?: string;
  readonly exceptionDate: string;
  readonly type: AvailabilityExceptionTypeDto;
  readonly startTime: string;
  readonly endTime: string;
  readonly reason: string | null;
}

export type AvailabilityExceptionRequestDto = Omit<AvailabilityExceptionDto, 'id' | 'doctorId'>;

export interface SlotDto {
  readonly start: string;
  readonly end: string;
}

export interface AppointmentDto {
  readonly id: string;
  readonly doctorId: string;
  readonly patientId: string;
  readonly patientName: string | null;
  readonly startTime: string;
  readonly endTime: string;
  readonly status: AppointmentStatusDto;
  readonly source: AppointmentSourceDto;
  readonly notes: string | null;
  readonly quotedPriceTnd: number | null;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly createdAt: string;
}

export interface DoctorStatsDto {
  readonly consultations: number;
  readonly upcoming: number;
  readonly finished: number;
  readonly urgentRequests: number;
}

export interface BookingRequestDto {
  readonly doctorId: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly notes: string | null;
}

export interface UrgentAvailabilityStatusDto {
  readonly doctorId: string;
  readonly acceptsHomeVisits: boolean;
  readonly acceptsCabinetVisits: boolean;
  readonly availableForUrgent: boolean;
  readonly currentLatitude: number | null;
  readonly currentLongitude: number | null;
  readonly locationUpdatedAt: string | null;
}

export interface UrgentAvailabilityToggleDto {
  readonly acceptsHomeVisits: boolean;
  readonly acceptsCabinetVisits: boolean;
  readonly currentLatitude: number | null;
  readonly currentLongitude: number | null;
}

export type UrgentVisitPreferenceDto = 'HOME_VISIT' | 'CABINET_VISIT' | 'EITHER';
export type UrgentOfferStatusDto = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';

export interface UrgentOfferDto {
  readonly offerId: string;
  readonly requestId: string;
  readonly doctorId: string;
  readonly status: UrgentOfferStatusDto;
  readonly sentAt: string;
  readonly respondedAt: string | null;
  readonly patientName: string;
  readonly patientLatitude: number;
  readonly patientLongitude: number;
  readonly visitPreference: UrgentVisitPreferenceDto | null;
  readonly notes: string | null;
  readonly requestStatus: string;
}

export interface NotificationItemDto {
  readonly id: string;
  readonly type: string;
  readonly priority: string;
  readonly category: string;
  readonly titleFr: string;
  readonly bodyFr: string;
  readonly titleAr: string;
  readonly bodyAr: string;
  readonly deepLinkPayload: Readonly<Record<string, unknown>> | null;
  readonly read: boolean;
  readonly createdAt: string;
}

export interface NotificationListResponseDto {
  readonly items: readonly NotificationItemDto[];
  readonly page: number;
  readonly pageSize: number;
  readonly totalElements: number;
  readonly unreadCount: number;
}

export interface UnreadCountResponseDto {
  readonly unreadCount: number;
}
