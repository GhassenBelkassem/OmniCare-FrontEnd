export type PracticeLocationType = 'CABINET';

export interface PracticeLocationMediaResponse {
  readonly id: string;
  readonly url: string;
  readonly displayOrder: number;
  readonly createdAt: string;
}

export interface PracticeLocationResponse {
  readonly id: string;
  readonly type: PracticeLocationType;
  readonly name: string;
  readonly governorate: string;
  readonly city: string;
  readonly address: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly publicPhone: string | null;
  readonly wheelchairAccessible: boolean;
  readonly patientInstructions: string | null;
  readonly primary: boolean;
  readonly active: boolean;
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly gallery: readonly PracticeLocationMediaResponse[];
}

export interface CreatePracticeLocationRequest {
  readonly type: PracticeLocationType;
  readonly name: string;
  readonly governorate: string;
  readonly city: string;
  readonly address: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly publicPhone: string | null;
  readonly wheelchairAccessible: boolean;
  readonly patientInstructions: string | null;
  readonly primary: boolean;
  readonly active: boolean;
}

export interface UpdatePracticeLocationRequest {
  readonly name: string;
  readonly governorate: string;
  readonly city: string;
  readonly address: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly publicPhone: string;
  readonly wheelchairAccessible: boolean;
  readonly patientInstructions: string;
  readonly primary: boolean;
  readonly active: boolean;
  readonly expectedRevision: number;
}

export const PRACTICE_LOCATION_LIMIT = 10;
export const PRACTICE_LOCATION_MEDIA_LIMIT = 10;
export const PRACTICE_LOCATION_MEDIA_MAX_BYTES = 8 * 1024 * 1024;
export const PRACTICE_LOCATION_MEDIA_TYPES = ['image/jpeg', 'image/png'] as const;
