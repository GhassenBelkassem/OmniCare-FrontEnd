import type { OcTab } from '../../../shared/ui';

export type PatientDetailState = 'loading' | 'ready' | 'not-found' | 'forbidden' | 'error';
export type PatientDetailTab = 'overview' | 'consultations' | 'documents' | 'timeline';
export type PatientDetailSource = 'omnicare' | 'manual' | 'imported' | 'walk_in';
export type PatientDetailLinkage = 'linked' | 'possible' | 'unlinked';

export interface PatientDetailPerson {
  readonly id: string;
  readonly fullName: string;
  readonly initials: string;
  readonly dateOfBirth: string | null;
  readonly dateOfBirthLabel: string;
  readonly age: number | null;
  readonly sexLabel: string;
  readonly phone: string;
  readonly email: string | null;
  readonly address: string | null;
  readonly administrativeId: string | null;
  readonly insuranceNumber: string | null;
  readonly source: PatientDetailSource;
  readonly sourceLabel: string;
  readonly linkage: PatientDetailLinkage;
  readonly linkageLabel: string;
}

export interface PatientDetailAppointment {
  readonly id: string;
  readonly date: string;
  readonly status: 'Terminé' | 'Planifié';
}

export interface PatientDetailTimelineEvent {
  readonly id: string;
  readonly date: string;
  readonly title: string;
  readonly description: string;
  readonly icon: string;
}

export interface PatientDetailViewModel {
  readonly notice: string | null;
  readonly state: PatientDetailState;
  readonly stateDescription: string;
  readonly directoryHref: string;
  readonly scheduleHref: string | null;
  readonly patient: PatientDetailPerson | null;
  readonly tabs: readonly OcTab[];
  readonly activeTab: PatientDetailTab;
  readonly appointments: readonly PatientDetailAppointment[];
  readonly timeline: readonly PatientDetailTimelineEvent[];
}

export type PatientDetailAction =
  | { readonly kind: 'SELECT_TAB'; readonly value: PatientDetailTab }
  | { readonly kind: 'RETRY' }
  | { readonly kind: 'NAVIGATE_DIRECTORY' }
  | { readonly kind: 'SCHEDULE' };
