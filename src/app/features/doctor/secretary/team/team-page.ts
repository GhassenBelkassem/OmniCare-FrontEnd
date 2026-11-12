import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  Input,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { OcAvatar, OcButton, OcCard, OcEmptyState, OcPageHeader, OcSkeleton, OcStatusBadge } from '../../../../shared/ui';
import {
  DoctorStaffSummary,
  SecretaryInvitationResponse,
  SecretaryMembershipStatus,
  SecretaryPermission,
} from '../secretary-api.models';
import { SecretaryApiService } from '../secretary-api.service';
import { InviteDialog } from './invite-dialog';
import { InviteDialogResult } from './invite-dialog';
import {
  membershipStatusLabel,
  membershipStatusTone,
  permissionLabel,
  permissionTone,
  secretaryErrorMessage,
  secretaryFieldError,
  formatDateTimeFr,
} from '../secretary-page-utils';

@Component({
  selector: 'app-team-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    OcAvatar,
    OcButton,
    OcCard,
    OcEmptyState,
    OcPageHeader,
    OcSkeleton,
    OcStatusBadge,
    InviteDialog,
  ],
  templateUrl: './team-page.html',
  styleUrl: './team-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamPage {
  private readonly api = inject(SecretaryApiService);
  private readonly formBuilder = inject(FormBuilder);

  readonly members = signal<readonly DoctorStaffSummary[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);

  readonly inviteOpen = signal(false);
  readonly inviting = signal(false);
  readonly inviteError = signal<string | null>(null);
  readonly emailError = signal<string | null>(null);
  readonly inviteResult = signal<SecretaryInvitationResponse | null>(null);

  readonly inviteForm = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    permissions: [[] as readonly SecretaryPermission[]],
    firstName: ['', [Validators.maxLength(80)]],
    lastName: ['', [Validators.maxLength(80)]],
  });

  readonly hasMembers = computed(() => this.members().length > 0);

  @Input() embedded = false;

  readonly listErrorMessage = computed(() => {
    const message = this.loadError();
    if (message === null) return null;
    return this.inviteResult() !== null
      ? "Invitation envoyée, mais la liste n'a pas pu être rafraîchie."
      : message;
  });

  readonly submitAttempted = signal(false);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.api.list().subscribe({
      next: (members) => {
        this.members.set(members);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loadError.set(secretaryErrorMessage(error));
        this.loading.set(false);
      },
    });
  }

  emailInvalidForDisplay(): boolean {
    const email = this.inviteForm.controls.email;
    return email.invalid && (email.touched || this.submitAttempted());
  }

  openInvite(): void {
    this.inviteOpen.set(true);
    this.inviteError.set(null);
    this.emailError.set(null);
    this.inviteResult.set(null);
    this.submitAttempted.set(false);
    this.inviteForm.reset({ email: '', permissions: [], firstName: '', lastName: '' });
  }

  closeInvite(): void {
    if (this.inviting()) return;
    this.inviteOpen.set(false);
    this.submitAttempted.set(false);
  }

  onInviteDialogClose(result: InviteDialogResult): void {
    if (result === null) {
      this.closeInvite();
      return;
    }
    // Submit the invitation
    const { email, permissions, firstName, lastName } = result;
    this.inviting.set(true);
    this.inviteError.set(null);
    this.emailError.set(null);

    this.api
      .invite({
        email,
        ...(permissions ? { permissions: [...permissions] } : {}),
        ...(firstName ? { firstName } : {}),
        ...(lastName ? { lastName } : {}),
      })
      .subscribe({
        next: (response) => {
          this.inviting.set(false);
          this.inviteResult.set(response);
          this.load();
          this.closeInvite();
        },
        error: (error: unknown) => {
          this.inviting.set(false);
          this.inviteError.set(secretaryErrorMessage(error));
          this.emailError.set(secretaryFieldError(error, 'email'));
          // Keep dialog open on error
        },
      });
  }

  statusLabel(status: SecretaryMembershipStatus): string {
    return membershipStatusLabel(status);
  }

  statusTone(status: SecretaryMembershipStatus) {
    return membershipStatusTone(status);
  }

  permissionSummary(membership: DoctorStaffSummary): string {
    return membership.permissions.map(permissionLabel).join(', ') || 'Aucune';
  }

  displayName(member: DoctorStaffSummary): string {
    // DoctorStaffSummary has no firstName/lastName, use email as fallback
    return member.email;
  }

  permissionLabelFn(permission: SecretaryPermission): string {
    return permissionLabel(permission);
  }

  permissionToneFn(permission: SecretaryPermission): 'emerald' | 'teal' | 'aqua' | 'neutral' {
    return permissionTone(permission);
  }

  formatDateTimeFr(value: string): string {
    return formatDateTimeFr(value);
  }
}