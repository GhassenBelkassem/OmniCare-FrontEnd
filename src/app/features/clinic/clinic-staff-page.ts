import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';

import {
  OcButton,
  OcDataTableShell,
  OcEmptyState,
  OcPageHeader,
  OcStatusBadge,
} from '../../shared/ui';
import {
  ClinicMembershipStatus,
  ClinicProfessionalRole,
  ClinicStaffMember,
  CLINIC_STAFF_EMAIL_MAX_LENGTH,
  CLINIC_STAFF_NOTE_MAX_LENGTH,
  CLINIC_STAFF_SEARCH_MAX_LENGTH,
  toClinicProfessionalRole,
} from './clinic-api.models';
import { ClinicContextStore } from './clinic-context.store';
import { ClinicStaffDialog } from './clinic-staff-dialog';
import { ClinicStaffStore } from './clinic-staff.store';
import {
  canEndMembership,
  canReactivateMembership,
  canSuspendMembership,
  clinicMembershipStatusLabel,
  clinicMembershipStatusTone,
  clinicStaffDisplayName,
  clinicStaffRoleLabel,
  CLINIC_ATTACHABLE_ROLE_OPTIONS,
  CLINIC_SUSPENSION_REASON_OPTIONS,
} from './clinic-staff-utils';

const STATUS_FILTERS: readonly { readonly value: ClinicMembershipStatus | ''; readonly label: string }[] =
  [
    { value: '', label: 'All statuses' },
    { value: 'ACTIVE', label: 'Active' },
    { value: 'SUSPENDED', label: 'Suspended' },
    { value: 'ENDED', label: 'Ended' },
    { value: 'INVITED', label: 'Invited' },
  ];

type ConfirmKind = 'suspend' | 'end';

@Component({
  selector: 'app-clinic-staff-page',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    NzAlertModule,
    ClinicStaffDialog,
    OcButton,
    OcDataTableShell,
    OcEmptyState,
    OcPageHeader,
    OcStatusBadge,
  ],
  providers: [ClinicStaffStore],
  templateUrl: './clinic-staff-page.html',
  styleUrls: ['./clinic-pages.scss', './clinic-staff-page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClinicStaffPage {
  private readonly context = inject(ClinicContextStore);
  private readonly formBuilder = inject(FormBuilder);
  readonly store = inject(ClinicStaffStore);

  readonly statusFilters = STATUS_FILTERS;
  readonly roleOptions = CLINIC_ATTACHABLE_ROLE_OPTIONS;
  readonly reasonOptions = CLINIC_SUSPENSION_REASON_OPTIONS;
  readonly emailMaxLength = CLINIC_STAFF_EMAIL_MAX_LENGTH;
  readonly noteMaxLength = CLINIC_STAFF_NOTE_MAX_LENGTH;
  readonly searchMaxLength = CLINIC_STAFF_SEARCH_MAX_LENGTH;

  readonly roleLabel = clinicStaffRoleLabel;
  readonly statusLabel = clinicMembershipStatusLabel;
  readonly statusTone = clinicMembershipStatusTone;
  readonly displayName = clinicStaffDisplayName;
  readonly canSuspendStatus = canSuspendMembership;
  readonly canReactivateStatus = canReactivateMembership;
  readonly canEndStatus = canEndMembership;

  readonly addDialogOpen = signal(false);
  readonly confirmKind = signal<ConfirmKind | null>(null);
  readonly confirmTarget = signal<ClinicStaffMember | null>(null);

  readonly addForm = this.formBuilder.nonNullable.group({
    email: [
      '',
      [
        Validators.required,
        Validators.email,
        Validators.maxLength(CLINIC_STAFF_EMAIL_MAX_LENGTH),
      ],
    ],
    professionalRole: ['', [Validators.required]],
  });

  readonly suspendForm = this.formBuilder.nonNullable.group({
    reasonCode: ['ADMINISTRATIVE_HOLD', [Validators.required]],
    note: ['', [Validators.maxLength(CLINIC_STAFF_NOTE_MAX_LENGTH)]],
  });

  readonly tableState = computed<'default' | 'loading' | 'empty' | 'error'>(() => {
    if (this.store.loadFailed()) return 'error';
    if (this.store.loading() && this.store.items().length === 0) return 'loading';
    if (this.store.isEmpty()) return 'empty';
    return 'default';
  });

  readonly pageLabel = computed(() => `Page ${this.store.page() + 1}`);
  readonly confirmHeading = computed(() =>
    this.confirmKind() === 'suspend' ? 'Suspend staff membership' : 'End staff membership',
  );
  readonly confirmDescription = computed(() => {
    const member = this.confirmTarget();
    if (member === null) return '';
    const name = clinicStaffDisplayName(member);
    return this.confirmKind() === 'suspend'
      ? `${name} will lose access to this clinic until the membership is reactivated.`
      : `${name} will be removed from this clinic. An ended membership cannot be reactivated.`;
  });

  constructor() {
    // A direct refresh must rebuild clinic context before any staff query is issued.
    this.context.initialize({ route: false });
    this.store.load();
  }

  trackMembership(_index: number, member: ClinicStaffMember): string {
    return member.membershipId;
  }

  onSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.store.searchChanged(input.value);
  }

  onStatusFilter(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.store.setStatus(value === '' ? null : (value as ClinicMembershipStatus));
  }

  onRoleFilter(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.store.setProfessionalRole(value === '' ? null : toClinicProfessionalRole(value));
  }

  openAddDialog(): void {
    this.addForm.reset({ email: '', professionalRole: '' });
    this.addDialogOpen.set(true);
  }

  closeAddDialog(): void {
    this.addDialogOpen.set(false);
  }

  submitAdd(): void {
    if (this.addForm.invalid || this.store.isMutating()) {
      this.addForm.markAllAsTouched();
      return;
    }
    const { email, professionalRole } = this.addForm.getRawValue();
    const role = toClinicProfessionalRole(professionalRole);
    // Defence in depth: an administrator membership is never attachable from this UI.
    if (role === null || role === 'CLINIC_ADMIN') return;

    this.store.attachProfessional(email.trim(), role, () => this.closeAddDialog());
  }

  requestSuspend(member: ClinicStaffMember): void {
    this.suspendForm.reset({ reasonCode: 'ADMINISTRATIVE_HOLD', note: '' });
    this.confirmTarget.set(member);
    this.confirmKind.set('suspend');
  }

  requestEnd(member: ClinicStaffMember): void {
    this.confirmTarget.set(member);
    this.confirmKind.set('end');
  }

  closeConfirm(): void {
    this.confirmKind.set(null);
    this.confirmTarget.set(null);
  }

  confirmAction(): void {
    const member = this.confirmTarget();
    const kind = this.confirmKind();
    if (member === null || kind === null || this.store.isMutating()) return;

    if (kind === 'end') {
      this.store.end(member, () => this.closeConfirm());
      return;
    }

    if (this.suspendForm.invalid) {
      this.suspendForm.markAllAsTouched();
      return;
    }
    const { reasonCode, note } = this.suspendForm.getRawValue();
    const trimmedNote = note.trim();
    this.store.suspend(
      member,
      this.reasonOptions.find((option) => option.value === reasonCode)?.value ??
        'ADMINISTRATIVE_HOLD',
      trimmedNote.length > 0 ? trimmedNote : null,
      () => this.closeConfirm(),
    );
  }

  reactivate(member: ClinicStaffMember): void {
    this.store.reactivate(member);
  }

  isRowPending(member: ClinicStaffMember): boolean {
    return this.store.pendingMembershipId() === member.membershipId;
  }

  readonly roleFilterOptions: readonly { readonly value: ClinicProfessionalRole | ''; readonly label: string }[] =
    [
      { value: '', label: 'All roles' },
      ...CLINIC_ATTACHABLE_ROLE_OPTIONS.map((option) => ({
        value: option.value as ClinicProfessionalRole,
        label: option.label,
      })),
      { value: 'CLINIC_ADMIN' as ClinicProfessionalRole, label: 'Clinic Administrator' },
    ];
}
