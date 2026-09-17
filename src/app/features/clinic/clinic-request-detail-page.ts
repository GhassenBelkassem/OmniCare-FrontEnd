import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { Observable } from 'rxjs';

import { OcButton, OcEmptyState, OcPageHeader, OcStatusBadge } from '../../shared/ui';
import {
  CLINIC_REQUESTS_READ_CAPABILITY,
  ClinicCaseAction,
  ClinicCaseDeclineReasonCode,
  ClinicCaseDetail,
  ClinicInformationReasonCode,
  hasClinicCapability,
} from './clinic-api.models';
import { ClinicApiService } from './clinic-api.service';
import { ClinicCaseStore } from './clinic-case.store';
import {
  clinicCaseReference,
  clinicCaseSituationLabel,
  clinicCaseStatusLabel,
  clinicCaseStatusTone,
  clinicInformationReasonLabel,
  clinicPriorityLabel,
  clinicWorkflowStepLabel,
  isTerminalClinicCase,
  readClinicCaseFailureReason,
  clinicCaseFailureMessage,
} from './clinic-case-utils';
import { ClinicContextStore } from './clinic-context.store';
import { ClinicDeclineDialog } from './clinic-decline-dialog';
import { ClinicInformationDialog } from './clinic-information-dialog';

@Component({
  selector: 'app-clinic-request-detail-page',
  imports: [
    DatePipe,
    RouterLink,
    NzSkeletonModule,
    OcButton,
    OcEmptyState,
    OcPageHeader,
    OcStatusBadge,
    ClinicDeclineDialog,
    ClinicInformationDialog,
  ],
  providers: [ClinicCaseStore],
  templateUrl: './clinic-request-detail-page.html',
  styleUrl: './clinic-request-detail-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClinicRequestDetailPage {
  private readonly context = inject(ClinicContextStore);
  private readonly api = inject(ClinicApiService);
  private readonly route = inject(ActivatedRoute);
  readonly store = inject(ClinicCaseStore);
  private readonly caseId = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  private loadedRequestKey = '';

  readonly statusLabel = clinicCaseStatusLabel;
  readonly statusTone = clinicCaseStatusTone;
  readonly situationLabel = clinicCaseSituationLabel;
  readonly priorityLabel = clinicPriorityLabel;
  readonly stepLabel = clinicWorkflowStepLabel;
  readonly informationReasonLabel = clinicInformationReasonLabel;
  readonly reference = clinicCaseReference;
  readonly terminal = isTerminalClinicCase;
  readonly dateTimeFormat = 'dd MMM yyyy, HH:mm';
  readonly actionLoading = signal<ClinicCaseAction | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly informationDialogOpen = signal(false);
  readonly declineDialogOpen = signal(false);
  readonly informationReason = signal<ClinicInformationReasonCode | null>(null);
  readonly patientInstruction = signal('');
  readonly declineReason = signal<ClinicCaseDeclineReasonCode | null>(null);

  constructor() {
    this.context.initialize({ route: false });
    effect(() => {
      const clinicId = this.context.selectedClinicId();
      const bootstrap = this.context.bootstrap();
      const caseId = this.caseId().get('caseId');
      if (
        clinicId === null ||
        caseId === null ||
        !hasClinicCapability(bootstrap, CLINIC_REQUESTS_READ_CAPABILITY)
      ) {
        return;
      }

      const requestKey = `${clinicId}|${caseId}`;
      if (requestKey === this.loadedRequestKey) return;
      this.loadedRequestKey = requestKey;
      this.store.loadDetail({ clinicId, caseId });
    });
  }

  refresh(): void {
    this.store.refreshDetail();
  }

  canReview(): boolean {
    return hasClinicCapability(this.context.bootstrap(), 'CLINIC_CASE_INTAKE_REVIEW');
  }

  hasAction(request: ClinicCaseDetail, action: ClinicCaseAction): boolean {
    return request.availableActions.includes(action) && this.canReview();
  }

  startReview(request: ClinicCaseDetail): void {
    this.runAction(
      'START_REVIEW',
      this.api.startReview(this.clinicId(), request.clinicCaseId, { expectedVersion: request.version }),
    );
  }

  openInformationDialog(): void {
    this.actionError.set(null);
    this.informationReason.set(null);
    this.patientInstruction.set('');
    this.informationDialogOpen.set(true);
  }

  confirmInformation(reasonCode: ClinicInformationReasonCode): void {
    const request = this.store.detail();
    const clinicId = this.clinicId();
    if (request === null || clinicId === null) return;
    this.runAction(
      'REQUEST_INFORMATION',
      this.api.requestInformation(clinicId, request.clinicCaseId, {
        expectedVersion: request.version,
        reasonCode,
        patientInstruction: this.patientInstruction().trim() || undefined,
      }),
      () => this.informationDialogOpen.set(false),
    );
  }

  openDeclineDialog(): void {
    this.actionError.set(null);
    this.declineReason.set(null);
    this.declineDialogOpen.set(true);
  }

  confirmDecline(declineReasonCode: ClinicCaseDeclineReasonCode): void {
    const request = this.store.detail();
    const clinicId = this.clinicId();
    if (request === null || clinicId === null) return;
    this.runAction(
      'DECLINE',
      this.api.declineCase(clinicId, request.clinicCaseId, {
        expectedVersion: request.version,
        declineReasonCode,
      }),
      () => this.declineDialogOpen.set(false),
    );
  }

  readyForPlanning(request: ClinicCaseDetail): void {
    this.runAction(
      'READY_FOR_PLANNING',
      this.api.readyForPlanning(this.clinicId(), request.clinicCaseId, { expectedVersion: request.version }),
    );
  }

  private clinicId(): string {
    return this.context.selectedClinicId() ?? '';
  }

  private runAction(
    action: ClinicCaseAction,
    request$: Observable<ClinicCaseDetail>,
    onSuccess?: () => void,
  ): void {
    if (this.actionLoading() !== null) return;
    this.actionError.set(null);
    this.actionLoading.set(action);
    request$.subscribe({
      next: () => {
        this.actionLoading.set(null);
        onSuccess?.();
        this.store.refreshDetail();
      },
      error: (error: unknown) => {
        this.actionLoading.set(null);
        const reason = readClinicCaseFailureReason(error);
        this.actionError.set(clinicCaseFailureMessage(reason));
        if (reason === 'CLINIC_CASE_VERSION_CONFLICT' || reason === 'CLINIC_CASE_TRANSITION_INVALID') {
          this.store.refreshDetail();
        }
      },
    });
  }
}
