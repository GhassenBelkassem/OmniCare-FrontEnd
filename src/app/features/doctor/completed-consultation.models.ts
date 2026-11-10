import type {
  ConsultationSourceType,
  ConsultationStatus,
  MedicalAccessStatus,
} from './active-consultation.models';
import type { ArtifactRenderStatus, ArtifactStatus, ArtifactType } from './artifact.models';

export interface CompletedConsultationListItem {
  readonly consultationId: string;
  readonly patient: {
    readonly displayName: string;
    readonly relationship: string | null;
  };
  readonly sourceType: ConsultationSourceType;
  readonly sourceId: string;
  readonly status: ConsultationStatus;
  readonly medicalAccessStatus: MedicalAccessStatus;
  readonly startedAt: string;
  readonly completedAt: string;
}

export interface CompletedConsultationPage {
  readonly items: readonly CompletedConsultationListItem[];
  readonly page: number;
  readonly pageSize: number;
  readonly totalCount: number;
  readonly totalPages: number;
  readonly hasNext: boolean;
}

export interface CompletedArtifactMetadata {
  readonly artifactId: string;
  readonly artifactType: ArtifactType;
  readonly artifactVersion: number;
  readonly status: ArtifactStatus;
  readonly renderStatus: ArtifactRenderStatus;
  readonly renderVersion: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CompletedConsultationDetail {
  readonly consultation: CompletedConsultationListItem;
  readonly historicalMedicalAccessStatus: 'NOT_AUTHORIZED';
  readonly artifactStatusAvailable: boolean;
  readonly artifacts: readonly CompletedArtifactMetadata[];
}
