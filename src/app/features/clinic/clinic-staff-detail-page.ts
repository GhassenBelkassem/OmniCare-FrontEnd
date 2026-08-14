import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';

import { OcButton, OcEmptyState, OcPageHeader, OcStatusBadge } from '../../shared/ui';
import { ClinicStaffMember } from './clinic-api.models';
import { ClinicApiService } from './clinic-api.service';
import { ClinicContextStore } from './clinic-context.store';
import { ClinicStaffStore } from './clinic-staff.store';
import {
  canEndMembership,
  canReactivateMembership,
  canSuspendMembership,
  clinicMembershipStatusLabel,
  clinicMembershipStatusTone,
  clinicStaffDisplayName,
  clinicStaffFailureMessage,
  clinicStaffRoleLabel,
  readClinicStaffFailureReason,
} from './clinic-staff-utils';

/**
 * Read-focused membership detail. Lifecycle commands are delegated to the staff store so
 * version handling and conflict recovery stay in a single place.
 */
@Component({
  selector: 'app-clinic-staff-detail-page',
  imports: [
    DatePipe,
    RouterLink,
    NzAlertModule,
    OcButton,
    OcEmptyState,
    OcPageHeader,
    OcStatusBadge,
  ],
  providers: [ClinicStaffStore],
  template: `
    <div class="clinic-page">
      <oc-page-header title="Staff member" description="Clinic membership detail">
        <oc-button ocSecondaryActions variant="quiet" routerLink="/clinic/staff"
          >Back to staff</oc-button
        >
      </oc-page-header>

      @if (errorMessage(); as message) {
        <nz-alert nzType="error" [nzMessage]="message" nzShowIcon />
      }

      @if (!store.canRead()) {
        <oc-empty-state
          icon="team"
          title="Staff management is unavailable"
          description="Your clinic membership does not grant access to staff management."
        />
      } @else if (member(); as staffMember) {
        <section class="panel" aria-labelledby="staff-detail-title">
          <h2 id="staff-detail-title">{{ displayName(staffMember) }}</h2>
          <dl class="definition-grid">
            <div>
              <dt>Professional role</dt>
              <dd>{{ roleLabel(staffMember.professionalRole) }}</dd>
            </div>
            <div>
              <dt>Membership status</dt>
              <dd>
                <oc-status-badge [status]="statusTone(staffMember.membershipStatus)" />
                <span>{{ statusLabel(staffMember.membershipStatus) }}</span>
              </dd>
            </div>
            <div>
              <dt>Joined</dt>
              <dd>{{ (staffMember.joinedAt | date: 'mediumDate') ?? '—' }}</dd>
            </div>
          </dl>
        </section>

        <section class="panel" aria-labelledby="staff-actions-title">
          <h2 id="staff-actions-title">Membership actions</h2>
          @if (hasAnyAction(staffMember)) {
            <div class="clinic-actions">
              @if (store.canSuspend() && canSuspendStatus(staffMember.membershipStatus)) {
                <oc-button
                  [disabled]="store.isMutating()"
                  [loading]="store.pendingMutation() === 'suspend'"
                  (click)="suspend(staffMember)"
                  >Suspend</oc-button
                >
              }
              @if (store.canReactivate() && canReactivateStatus(staffMember.membershipStatus)) {
                <oc-button
                  [disabled]="store.isMutating()"
                  [loading]="store.pendingMutation() === 'reactivate'"
                  (click)="reactivate(staffMember)"
                  >Reactivate</oc-button
                >
              }
              @if (store.canEnd() && canEndStatus(staffMember.membershipStatus)) {
                <oc-button
                  variant="destructive"
                  [disabled]="store.isMutating()"
                  [loading]="store.pendingMutation() === 'end'"
                  (click)="end(staffMember)"
                  >End membership</oc-button
                >
              }
            </div>
          } @else {
            <p class="meta">This membership is read-only.</p>
          }
        </section>
      } @else if (!loading()) {
        <oc-empty-state
          icon="team"
          title="Staff member unavailable"
          description="This staff membership could not be loaded."
        />
      }
    </div>
  `,
  styleUrl: './clinic-pages.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClinicStaffDetailPage {
  private readonly api = inject(ClinicApiService);
  private readonly context = inject(ClinicContextStore);
  private readonly route = inject(ActivatedRoute);
  readonly store = inject(ClinicStaffStore);

  /** Route-owned identifier. The clinic itself always comes from ClinicContextStore. */
  readonly membershipId = this.route.snapshot.paramMap.get('membershipId') ?? '';

  readonly roleLabel = clinicStaffRoleLabel;
  readonly statusLabel = clinicMembershipStatusLabel;
  readonly statusTone = clinicMembershipStatusTone;
  readonly displayName = clinicStaffDisplayName;
  readonly canSuspendStatus = canSuspendMembership;
  readonly canReactivateStatus = canReactivateMembership;
  readonly canEndStatus = canEndMembership;

  private readonly memberState = signal<ClinicStaffMember | null>(null);
  private readonly loadingState = signal(false);
  private readonly errorState = signal<string | null>(null);

  readonly member = this.memberState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly errorMessage = computed(
    () => this.store.notice()?.message ?? this.errorState() ?? null,
  );

  private requestSequence = 0;

  constructor() {
    this.context.initialize({ route: false });
    queueMicrotask(() => this.reload());
  }

  hasAnyAction(member: ClinicStaffMember): boolean {
    return (
      (this.store.canSuspend() && canSuspendMembership(member.membershipStatus)) ||
      (this.store.canReactivate() && canReactivateMembership(member.membershipStatus)) ||
      (this.store.canEnd() && canEndMembership(member.membershipStatus))
    );
  }

  suspend(member: ClinicStaffMember): void {
    this.store.suspend(member, 'ADMINISTRATIVE_HOLD', null, () => this.reload());
  }

  reactivate(member: ClinicStaffMember): void {
    this.store.reactivate(member);
    this.reload();
  }

  end(member: ClinicStaffMember): void {
    this.store.end(member, () => this.reload());
  }

  private reload(): void {
    const clinicId = this.context.selectedClinicId();
    if (clinicId === null || !this.store.canRead() || this.membershipId.length === 0) return;

    const sequence = ++this.requestSequence;
    this.loadingState.set(true);
    this.errorState.set(null);
    this.api.getStaffMember(clinicId, this.membershipId).subscribe({
      next: (member) => {
        if (sequence !== this.requestSequence) return;
        this.memberState.set(member);
        this.loadingState.set(false);
      },
      error: (error: unknown) => {
        if (sequence !== this.requestSequence) return;
        this.loadingState.set(false);
        this.errorState.set(clinicStaffFailureMessage(readClinicStaffFailureReason(error)));
      },
    });
  }
}
