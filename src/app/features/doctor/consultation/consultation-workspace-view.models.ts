import type { OcStatus } from '../../../shared/ui/status-badge/oc-status-badge';
import type { OcTab } from '../../../shared/ui/tabs/oc-tabs';

export type ConsultationWorkspaceSection =
  | 'note'
  | 'vitals'
  | 'prescription'
  | 'orders'
  | 'documents'
  | 'finalization';

export interface ConsultationIdentityBadge {
  readonly label: string;
  readonly icon?: 'user' | 'solution';
  readonly emphasis?: boolean;
}

export interface ConsultationWorkspaceViewModel {
  readonly screenReaderDescription: string;
  readonly title: string;
  readonly initials: string;
  readonly identityBadges: readonly ConsultationIdentityBadge[];
  readonly contextItems: readonly string[];
  readonly status: OcStatus;
  readonly statusLabel: string;
  readonly tabs: readonly OcTab[];
  readonly activeSection: ConsultationWorkspaceSection;
  readonly activeSectionLabel: string;
  readonly feedback: string | null;
  readonly patientRecordHref: string | null;
  readonly activeSaveStatus: OcStatus;
  readonly activeSaveLabel: string;
  readonly showSaveAction: boolean;
  readonly canSave: boolean;
  readonly saving: boolean;
  readonly showPdfPreview: boolean;
  readonly canPreviewPdf: boolean;
  readonly canFinish: boolean;
  readonly finishing: boolean;
  readonly finishLabel: string;
}

export type ConsultationWorkspaceAction =
  | { readonly kind: 'SET_SECTION'; readonly section: ConsultationWorkspaceSection }
  | { readonly kind: 'OPEN_MEDICAL_RECORD' }
  | { readonly kind: 'DISMISS_FEEDBACK' }
  | { readonly kind: 'SAVE_ACTIVE' }
  | { readonly kind: 'PREVIEW_PDF' }
  | { readonly kind: 'FINISH' };
