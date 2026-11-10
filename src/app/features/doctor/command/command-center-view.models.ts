export type CommandCenterAppointmentState =
  | 'completed'
  | 'active'
  | 'confirmed'
  | 'upcoming';

export type CommandCenterAvatarTone = 'mint' | 'blue' | 'rose';

export type CommandCenterLinkAction =
  | { readonly kind: 'NAVIGATE'; readonly href: string }
  | { readonly kind: 'OPEN_APPOINTMENT'; readonly appointmentId: string; readonly href: string }
  | { readonly kind: 'OPEN_REQUEST'; readonly requestId: string; readonly href: string }
  | {
      readonly kind: 'OPEN_SCHEDULED_APPOINTMENT';
      readonly appointmentId: string;
      readonly href: string;
    }
  | { readonly kind: 'CONTINUE_CONSULTATION'; readonly consultationId: string; readonly href: string }
  | { readonly kind: 'CLOSE_CONSULTATION'; readonly consultationId: string; readonly href: string }
  | { readonly kind: 'OPEN_STALE_APPOINTMENT'; readonly appointmentId: string; readonly href: string };

export type CommandCenterCommandAction =
  | { readonly kind: 'START_SCHEDULED'; readonly appointmentId: string }
  | { readonly kind: 'START_URGENT'; readonly commitmentId: string }
  | { readonly kind: 'RETRY_DAY' }
  | { readonly kind: 'RETRY_SCHEDULED_CARE' }
  | { readonly kind: 'RETRY_ACTIVE_CONSULTATION' }
  | { readonly kind: 'RETRY_URGENT_CABINET' };

export type CommandCenterAction = CommandCenterLinkAction | CommandCenterCommandAction;

export interface CommandCenterAppointmentViewModel {
  readonly id: string;
  readonly time: string;
  readonly patient: string;
  readonly initials: string;
  readonly reason: string;
  readonly state: CommandCenterAppointmentState;
  /** Raw status code, rendered through the shared appointment-status mapping. */
  readonly statusCode: string;
  readonly status: string;
  readonly avatarTone: CommandCenterAvatarTone;
  readonly action: CommandCenterLinkAction;
}

export interface CommandCenterRequestViewModel {
  readonly id: string;
  readonly patient: string;
  readonly initials: string;
  readonly reason: string;
  readonly date: string;
  readonly time: string;
  readonly avatarTone: CommandCenterAvatarTone;
  readonly action: CommandCenterLinkAction;
}

export interface CommandCenterNextAppointmentViewModel {
  readonly patient: string;
  readonly initials: string;
  readonly reason: string;
  readonly date: string;
  readonly timeRange: string;
  readonly location: string;
  /** Room is not part of the appointment data yet; the line is hidden when null. */
  readonly room: string | null;
  readonly avatarTone: CommandCenterAvatarTone;
  readonly detailAction: CommandCenterLinkAction;
  readonly startAction: CommandCenterCommandAction | null;
}

export interface CommandCenterClinicalViewModel {
  readonly title: string;
  readonly patient: string;
  readonly initials: string;
  readonly meta: string;
  readonly reasonLabel: string;
  readonly reason: string;
  readonly avatarTone: CommandCenterAvatarTone;
  readonly primaryLabel: string | null;
  readonly primaryAction: CommandCenterAction | null;
  readonly secondaryLabel: string | null;
  readonly secondaryAction: CommandCenterLinkAction | null;
  readonly statusLabel: string | null;
}

/** An IN_PROGRESS consultation/appointment from a previous day, still not closed. */
export interface CommandCenterToCloseViewModel {
  readonly id: string;
  readonly patient: string;
  readonly initials: string;
  readonly startedLabel: string;
  /** Present when an open consultation exists: « Reprendre » / « Clôturer ». */
  readonly resumeAction: CommandCenterLinkAction | null;
  readonly closeAction: CommandCenterLinkAction | null;
  /** Appointment still IN_PROGRESS but no open consultation (e.g. interrupted). */
  readonly detailAction: CommandCenterLinkAction | null;
  readonly note: string | null;
}

export interface CommandCenterViewModel {
  readonly fixtureNote: string | null;
  readonly greeting: string;
  readonly dateLabel: string;
  readonly appointmentCount: number;
  readonly pendingRequestCount: number;
  readonly dayLoading: boolean;
  readonly dayError: string | null;
  readonly appointments: readonly CommandCenterAppointmentViewModel[];
  readonly scheduledCareLoading: boolean;
  readonly scheduledCareError: string | null;
  readonly pendingRequests: readonly CommandCenterRequestViewModel[];
  readonly nextAppointment: CommandCenterNextAppointmentViewModel | null;
  readonly clinicalLoading: boolean;
  readonly clinicalError: string | null;
  readonly clinicalRetryAction: CommandCenterCommandAction | null;
  readonly clinical: CommandCenterClinicalViewModel | null;
  readonly clinicalStarting: boolean;
  readonly clinicalStartError: string | null;
  readonly toClose: readonly CommandCenterToCloseViewModel[];
  readonly availabilityState: 'loading' | 'ready' | 'warning' | 'error';
  readonly availabilityTitle: string;
  readonly availabilityDescription: string;
}
