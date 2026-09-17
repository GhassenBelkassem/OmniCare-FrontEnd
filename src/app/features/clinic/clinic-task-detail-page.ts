import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';

import { OcButton, OcEmptyState, OcPageHeader, OcStatusBadge } from '../../shared/ui';
import {
  CLINIC_GENERIC_TASK_BLOCK_REASONS,
  ClinicGenericTaskBlockReason,
  ClinicInformationReasonCode,
  ClinicPosition,
  ClinicTaskDetail,
  ClinicTaskHandoverReasonCode,
  ClinicTaskHandoverTarget,
  CLINIC_HANDOVER_REASON_CODES,
  hasClinicCapability,
} from './clinic-api.models';
import { ClinicApiService } from './clinic-api.service';
import {
  clinicCaseReference,
  clinicCaseSituationLabel,
  clinicCaseStatusLabel,
  clinicInformationReasonLabel,
  clinicPriorityLabel,
  clinicWorkflowStepLabel,
} from './clinic-case-utils';
import { ClinicContextStore } from './clinic-context.store';
import { ClinicInformationDialog } from './clinic-information-dialog';
import { ClinicTaskStore } from './clinic-task.store';
import { clinicHandoverReasonLabel } from './clinic-handover-utils';
import {
  clinicTaskBlockedReasonLabel,
  isAcknowledgementOverdue,
  isGenericTaskBlockReason,
  isTaskDeadlineOverdue,
  clinicTaskReference,
  clinicTaskStatusLabel,
  clinicTaskStatusTone,
  clinicTaskTypeLabel,
} from './clinic-task-utils';

@Component({
  selector: 'app-clinic-task-detail-page',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    NzSelectModule,
    NzSkeletonModule,
    OcButton,
    OcEmptyState,
    OcPageHeader,
    OcStatusBadge,
    ClinicInformationDialog,
  ],
  providers: [ClinicTaskStore],
  templateUrl: './clinic-task-detail-page.html',
  styleUrl: './clinic-task-detail-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClinicTaskDetailPage {
  private readonly context = inject(ClinicContextStore);
  private readonly api = inject(ClinicApiService);
  private readonly route = inject(ActivatedRoute);
  readonly store = inject(ClinicTaskStore);
  private readonly paramMap = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  private loadedRequestKey = '';
  private loadedPositionKey = '';

  readonly positions = signal<readonly ClinicPosition[]>([]);
  readonly positionsError = signal(false);
  readonly currentPositionName = signal<string | null>(null);
  readonly positionControl = new FormControl<string | null>(null);
  readonly genericBlockReasonControl = new FormControl<ClinicGenericTaskBlockReason | null>(null);
  readonly genericBlockOpen = signal(false);
  readonly handoverOpen = signal(false);
  readonly handoverTargets = signal<readonly ClinicTaskHandoverTarget[]>([]);
  readonly handoverTargetsLoading = signal(false);
  readonly handoverTargetsError = signal(false);
  readonly handoverTargetControl = new FormControl<string | null>(null);
  readonly handoverReasonControl = new FormControl<ClinicTaskHandoverReasonCode | null>(null);
  readonly handoverSubmitting = signal(false);
  readonly handoverNotice = signal<string | null>(null);
  readonly handoverError = signal<string | null>(null);
  readonly informationDialogOpen = signal(false);
  readonly informationReason = signal<ClinicInformationReasonCode | null>(null);
  readonly patientInstruction = signal('');
  readonly dateTimeFormat = 'dd MMM yyyy, HH:mm';
  readonly taskReference = clinicTaskReference;
  readonly caseReference = clinicCaseReference;
  readonly taskTypeLabel = clinicTaskTypeLabel;
  readonly taskStatusLabel = clinicTaskStatusLabel;
  readonly taskStatusTone = clinicTaskStatusTone;
  readonly priorityLabel = clinicPriorityLabel;
  readonly caseStatusLabel = clinicCaseStatusLabel;
  readonly situationLabel = clinicCaseSituationLabel;
  readonly stepLabel = clinicWorkflowStepLabel;
  readonly blockReasonLabel = clinicTaskBlockedReasonLabel;
  readonly informationReasonLabel = clinicInformationReasonLabel;
  readonly genericBlockReasons = CLINIC_GENERIC_TASK_BLOCK_REASONS;
  readonly handoverReasons = CLINIC_HANDOVER_REASON_CODES;
  readonly handoverReasonLabel = clinicHandoverReasonLabel;
  readonly canReassign = computed(() =>
    hasClinicCapability(this.context.bootstrap(), 'CLINIC_TASK_REASSIGN'),
  );

  constructor() {
    this.context.initialize({ route: false });
    effect(() => {
      const clinicId = this.context.selectedClinicId();
      const bootstrap = this.context.bootstrap();
      const taskId = this.paramMap().get('taskId');
      if (
        clinicId === null ||
        taskId === null ||
        !hasClinicCapability(bootstrap, 'CLINIC_TASK_READ')
      ) {
        return;
      }
      const requestKey = `${clinicId}|${taskId}`;
      if (requestKey === this.loadedRequestKey) return;
      this.loadedRequestKey = requestKey;
      this.store.loadDetail({
        clinicId,
        taskId,
        includeCase: hasClinicCapability(bootstrap, 'CLINIC_CASE_INTAKE_READ'),
      });
      if (hasClinicCapability(bootstrap, 'CLINIC_TASK_REASSIGN')) this.loadPositions(clinicId);
    });
    effect(() => {
      const clinicId = this.context.selectedClinicId();
      const task = this.store.detail();
      const assignedPositionId = task?.assignedPositionId ?? null;
      if (clinicId === null || assignedPositionId === null) {
        this.loadedPositionKey = '';
        this.currentPositionName.set(null);
        return;
      }
      if (hasClinicCapability(this.context.bootstrap(), 'CLINIC_TASK_REASSIGN')) {
        this.currentPositionName.set(null);
        return;
      }
      if (!hasClinicCapability(this.context.bootstrap(), 'CLINIC_POSITION_READ')) {
        this.currentPositionName.set(null);
        return;
      }

      const positionKey = `${clinicId}|${assignedPositionId}`;
      if (positionKey === this.loadedPositionKey) return;
      this.loadedPositionKey = positionKey;
      this.currentPositionName.set(null);
      this.api.getPosition(clinicId, assignedPositionId).subscribe({
        next: (position) => this.currentPositionName.set(position.displayName),
        error: () => this.currentPositionName.set(null),
      });
    });
  }

  refresh(): void {
    this.store.refreshDetail();
  }

  owns(task: ClinicTaskDetail): boolean {
    return task.assignedMembershipId === this.context.bootstrap()?.membership.membershipId;
  }

  canAcknowledge(task: ClinicTaskDetail): boolean {
    return (
      this.context.bootstrap()?.membership.professionalRole !== 'CLINIC_ADMIN' &&
      task.status === 'ASSIGNED' &&
      task.assignedMembershipId === null
    );
  }

  canStart(task: ClinicTaskDetail): boolean {
    return this.owns(task) && task.status === 'ACKNOWLEDGED';
  }

  canRequestInformation(task: ClinicTaskDetail): boolean {
    const request = this.store.caseDetail();
    return (
      this.owns(task) &&
      task.status === 'IN_PROGRESS' &&
      task.taskType === 'ADMINISTRATIVE_REVIEW' &&
      hasClinicCapability(this.context.bootstrap(), 'CLINIC_CASE_INTAKE_REVIEW') &&
      (request?.availableActions.includes('REQUEST_INFORMATION') ?? false)
    );
  }

  canAdministrativeReviewComplete(task: ClinicTaskDetail): boolean {
    const request = this.store.caseDetail();
    return (
      this.owns(task) &&
      task.status === 'IN_PROGRESS' &&
      task.taskType === 'ADMINISTRATIVE_REVIEW' &&
      hasClinicCapability(this.context.bootstrap(), 'CLINIC_CASE_INTAKE_REVIEW') &&
      (request?.availableActions.includes('READY_FOR_PLANNING') ?? false)
    );
  }

  canGenericBlock(task: ClinicTaskDetail): boolean {
    return this.owns(task) && task.status === 'IN_PROGRESS';
  }

  canGenericUnblock(task: ClinicTaskDetail): boolean {
    return (
      this.owns(task) &&
      task.status === 'BLOCKED' &&
      isGenericTaskBlockReason(task.blockedReasonCode)
    );
  }

  canGenericComplete(task: ClinicTaskDetail): boolean {
    return (
      this.owns(task) && task.status === 'IN_PROGRESS' && task.taskType === 'REQUEST_COORDINATION'
    );
  }

  canReassignTask(task: ClinicTaskDetail): boolean {
    return this.canReassign() && ['ASSIGNED', 'ACKNOWLEDGED', 'IN_PROGRESS'].includes(task.status);
  }

  canInitiateHandover(task: ClinicTaskDetail): boolean {
    return (
      this.owns(task) &&
      hasClinicCapability(this.context.bootstrap(), 'CLINIC_TASK_HANDOVER') &&
      ['ACKNOWLEDGED', 'IN_PROGRESS', 'BLOCKED'].includes(task.status)
    );
  }

  acknowledge(task: ClinicTaskDetail): void {
    this.store.acknowledgeDetail(task);
  }

  start(task: ClinicTaskDetail): void {
    this.store.start(task);
  }

  openBlockDialog(): void {
    this.store.clearCommandFeedback();
    this.informationReason.set(null);
    this.patientInstruction.set('');
    this.informationDialogOpen.set(true);
  }

  openGenericBlock(): void {
    this.store.clearCommandFeedback();
    this.genericBlockReasonControl.setValue(null);
    this.genericBlockOpen.set(true);
  }

  block(task: ClinicTaskDetail): void {
    const reasonCode = this.genericBlockReasonControl.value;
    if (reasonCode === null || !this.canGenericBlock(task)) return;
    this.genericBlockOpen.set(false);
    this.store.block(task, reasonCode);
  }

  unblock(task: ClinicTaskDetail): void {
    if (!this.canGenericUnblock(task)) return;
    this.store.unblock(task);
  }

  confirmBlock(reasonCode: ClinicInformationReasonCode): void {
    const clinicId = this.context.selectedClinicId();
    const request = this.store.caseDetail();
    if (clinicId === null || request === null) return;
    this.informationDialogOpen.set(false);
    this.store.runCaseCommand(
      'BLOCK',
      this.api.requestInformation(clinicId, request.clinicCaseId, {
        expectedVersion: request.version,
        reasonCode,
        patientInstruction: this.patientInstruction().trim() || undefined,
      }),
      'Task blocked while waiting for patient information.',
    );
  }

  complete(task: ClinicTaskDetail): void {
    const clinicId = this.context.selectedClinicId();
    const request = this.store.caseDetail();
    if (clinicId === null || request === null || !this.canAdministrativeReviewComplete(task))
      return;
    this.store.runCaseCommand(
      'COMPLETE',
      this.api.readyForPlanning(clinicId, request.clinicCaseId, {
        expectedVersion: request.version,
      }),
      'Administrative review completed. The backend advanced the workflow.',
    );
  }

  completeGeneric(task: ClinicTaskDetail): void {
    if (!this.canGenericComplete(task)) return;
    this.store.complete(task);
  }

  reassign(task: ClinicTaskDetail): void {
    const target = this.positionControl.value;
    if (target === null || target === task.assignedPositionId) return;
    this.store.reassign(task, target);
  }

  openHandover(task: ClinicTaskDetail): void {
    const clinicId = this.context.selectedClinicId();
    if (clinicId === null || !this.canInitiateHandover(task)) return;
    this.handoverOpen.set(true);
    this.handoverTargetsLoading.set(true);
    this.handoverTargetsError.set(false);
    this.handoverTargets.set([]);
    this.handoverTargetControl.setValue(null);
    this.handoverReasonControl.setValue(null);
    this.handoverNotice.set(null);
    this.handoverError.set(null);
    this.api.listHandoverTargets(clinicId, task.taskId).subscribe({
      next: (page) => {
        this.handoverTargets.set(page.items);
        this.handoverTargetsLoading.set(false);
      },
      error: () => {
        this.handoverTargetsLoading.set(false);
        this.handoverTargetsError.set(true);
      },
    });
  }

  initiateHandover(task: ClinicTaskDetail): void {
    const clinicId = this.context.selectedClinicId();
    const toMembershipId = this.handoverTargetControl.value;
    const reasonCode = this.handoverReasonControl.value;
    if (
      clinicId === null ||
      toMembershipId === null ||
      reasonCode === null ||
      !this.canInitiateHandover(task)
    ) return;
    this.handoverSubmitting.set(true);
    this.handoverError.set(null);
    this.api.initiateHandover(clinicId, task.taskId, {
      toMembershipId,
      reasonCode,
      expectedTaskVersion: task.version,
    }).subscribe({
      next: () => {
        this.handoverSubmitting.set(false);
        this.handoverOpen.set(false);
        this.handoverNotice.set('Handover initiated. You remain the task owner while it is pending.');
        // Refresh the source-owned history; a pending proposal never changes task authority.
        this.api.listOutgoingHandovers(clinicId).subscribe({ error: () => undefined });
        this.store.refreshDetail();
      },
      error: () => {
        this.handoverSubmitting.set(false);
        this.handoverError.set(
          'This changed while you were viewing it. The latest information has been loaded.',
        );
        this.store.refreshDetail();
      },
    });
  }

  ownerLabel(task: ClinicTaskDetail): string {
    if (task.assignedMembershipId === null) return 'Position queue (unowned)';
    return this.owns(task) ? 'You' : task.assignedMembershipId;
  }

  positionLabel(positionId: string | null): string {
    if (positionId === null) return 'Not currently routed';
    return (
      this.positions().find((position) => position.id === positionId)?.displayName ??
      this.currentPositionName() ??
      'Position unavailable'
    );
  }

  isAcknowledgementOverdue(task: ClinicTaskDetail): boolean {
    return isAcknowledgementOverdue(task);
  }

  isTaskDeadlineOverdue(task: ClinicTaskDetail): boolean {
    return isTaskDeadlineOverdue(task.status, task.dueAt);
  }

  private loadPositions(clinicId: string): void {
    this.api.listActivePositions(clinicId).subscribe({
      next: (page) => {
        this.positions.set(page.items);
        this.positionsError.set(false);
      },
      error: () => {
        this.positions.set([]);
        this.positionsError.set(true);
      },
    });
  }
}
