export type PatientDirectoryState = 'ready' | 'loading' | 'error';
export type PatientDirectorySortDirection = 'asc' | 'desc';
export type PatientDirectorySortKey =
  'patient' | 'contact' | 'lastConsultation' | 'nextAppointment' | 'linkage' | 'source';

export interface PatientDirectoryOption {
  readonly value: string;
  readonly label: string;
}

export interface PatientDirectoryDateValue {
  readonly dateTime: string;
  readonly dateLabel: string;
  readonly timeLabel?: string;
}

export type PatientDirectoryLinkage = 'linked' | 'possible' | 'unlinked';
export type PatientDirectorySource = 'omnicare' | 'manual' | 'imported' | 'walk_in';
export type PatientDirectoryMrsReadiness = 'preparing' | 'retrying' | 'ready' | 'action_required';

export interface PatientDirectoryRow {
  readonly id: string;
  readonly href: string;
  readonly initials: string;
  readonly displayName: string;
  readonly accessibleName: string;
  readonly secondaryLabel: string;
  readonly phone: string;
  readonly emailLabel: string;
  readonly lastConsultation: PatientDirectoryDateValue | null;
  readonly nextAppointment: PatientDirectoryDateValue | null;
  readonly linkage: PatientDirectoryLinkage;
  readonly linkageLabel: string;
  readonly duplicateWarning: boolean;
  readonly mrsReadiness: PatientDirectoryMrsReadiness;
  readonly mrsReadinessLabel: string;
  readonly source: PatientDirectorySource;
  readonly sourceLabel: string;
}

export interface PatientDirectoryAdvancedFilters {
  readonly expanded: boolean;
  readonly activeCount: number;
  readonly lastConsultation: string;
  readonly lastConsultationOptions: readonly PatientDirectoryOption[];
  readonly source: string;
  readonly sourceOptions: readonly PatientDirectoryOption[];
  readonly linkage: string;
  readonly linkageOptions: readonly PatientDirectoryOption[];
}

export interface PatientDirectoryViewModel {
  readonly notice: string | null;
  readonly headingCount: number;
  readonly createdMessage: string | null;
  readonly categories: readonly PatientDirectoryOption[];
  readonly activeCategory: string;
  readonly searchTerm: string;
  readonly searchPlaceholder: string;
  readonly advancedFilters: PatientDirectoryAdvancedFilters | null;
  readonly state: PatientDirectoryState;
  readonly loadingDescription: string;
  readonly errorDescription: string;
  readonly rows: readonly PatientDirectoryRow[];
  readonly totalResults: number;
  readonly selectable: boolean;
  readonly selectedIds: ReadonlySet<string>;
  readonly allVisibleSelected: boolean;
  readonly sortable: boolean;
  readonly sortKey: PatientDirectorySortKey;
  readonly sortDirection: PatientDirectorySortDirection;
  readonly resultStart: number;
  readonly resultEnd: number;
  readonly page: number;
  readonly pageCount: number;
  readonly pageNumbers: readonly number[];
  readonly pageSize: number;
  readonly pageSizeOptions: readonly number[];
}

export type PatientDirectoryAction =
  | { readonly kind: 'ADD_PATIENT' }
  | { readonly kind: 'DISMISS_CREATED' }
  | { readonly kind: 'SEARCH'; readonly value: string }
  | { readonly kind: 'SELECT_CATEGORY'; readonly value: string }
  | { readonly kind: 'RESET_FILTERS' }
  | { readonly kind: 'TOGGLE_FILTERS' }
  | { readonly kind: 'SELECT_LAST_CONSULTATION'; readonly value: string }
  | { readonly kind: 'SELECT_SOURCE'; readonly value: string }
  | { readonly kind: 'SELECT_LINKAGE'; readonly value: string }
  | { readonly kind: 'RETRY' }
  | { readonly kind: 'SORT'; readonly value: PatientDirectorySortKey }
  | { readonly kind: 'TOGGLE_VISIBLE'; readonly checked: boolean }
  | { readonly kind: 'TOGGLE_PATIENT'; readonly id: string; readonly checked: boolean }
  | { readonly kind: 'OPEN_PATIENT'; readonly id: string }
  | { readonly kind: 'SET_PAGE_SIZE'; readonly value: number }
  | { readonly kind: 'SET_PAGE'; readonly value: number };
