import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import {
  OcButton,
  OcConfirmDialog,
  OcPageHeader,
  OcStatus,
  OcStatusBadge,
} from '../../../../shared/ui';
import {
  DoctorStaffDetail,
  SecretaryMembershipStatus,
  SecretaryPermission,
} from '../secretary-api.models';
import { SecretaryApiService } from '../secretary-api.service';
import { SecretaryPermissionSelect } from '../secretary-permission-select';
import {
  canEditPermissions,
  canEnd,
  canResendInvitation,
  canSuspend,
  membershipStatusLabel,
  membershipStatusTone,
  permissionLabel,
  secretaryErrorMessage,
} from '../secretary-page-utils';

type PendingAction = 'resend' | 'suspend' | 'end';

/**
 * Single delegation, following the sectioned professional-detail convention
 * (`section.panel` + `dl.definition-grid`) rather than inventing a layout.
 *
 * The lifecycle actions and the permission editor live here rather than on the
 * list, so the list stays a scannable summary and every mutation lands in one
 * place with the full context of who the delegation belongs to.
 */
@Component({
  selector: 'app-team-detail-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    OcButton,
    OcConfirmDialog,
    OcPageHeader,
    OcStatusBadge,
    SecretaryPermissionSelect,
  ],
  templateUrl: './team-detail-page.html',
  styleUrl: './team-detail-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamDetailPage {
  private readonly api = inject(SecretaryApiService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);

  private readonly membershipId =
    this.route.snapshot.paramMap.get('membershipId') ?? '';

  readonly member = signal<DoctorStaffDetail | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly notice = signal<string | null>(null);

  readonly editingPermissions = signal(false);
  readonly savingPermissions = signal(false);
  readonly permissionsError = signal<string | null>(null);

  readonly pending = signal<PendingAction | null>(null);
  readonly actingOn = signal(false);

  readonly permissionForm = this.formBuilder.nonNullable.group({
    permissions: [[] as readonly SecretaryPermission[]],
  });

  /**
   * A name is absent for every delegation created before names were captured,
   * so "not provided" is a real state and gets its own wording rather than a
   * blank cell.
   */
  readonly displayName = computed(() => {
    const member = this.member();
    if (member === null) return '';
    const parts = [member.firstName, member.lastName].filter(
      (part): part is string => part !== null && part.trim() !== '',
    );
    return parts.length === 0 ? '' : parts.join(' ');
  });

  readonly hasName = computed(() => this.displayName() !== '');

  readonly permissionEntries = computed(() =>
    (this.member()?.permissions ?? []).map((permission) => ({
      permission,
      label: permissionLabel(permission),
    })),
  );

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.api.detail(this.membershipId).subscribe({
      next: (member) => {
        this.member.set(member);
        // Seeded on load so the editor always opens on the server's current set
        // rather than on whatever was last typed into a cancelled form.
        this.permissionForm.controls.permissions.setValue([...member.permissions]);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loadError.set(secretaryErrorMessage(error));
        this.loading.set(false);
      },
    });
  }

  // --- permissions -------------------------------------------------------------------------

  canEditPermissions(status: SecretaryMembershipStatus): boolean {
    return canEditPermissions(status);
  }

  startEditing(): void {
    const member = this.member();
    if (member === null) return;
    this.permissionForm.controls.permissions.setValue([...member.permissions]);
    this.permissionsError.set(null);
    this.actionError.set(null);
    this.editingPermissions.set(true);
  }

  cancelEditing(): void {
    if (this.savingPermissions()) return;
    this.editingPermissions.set(false);
    this.permissionsError.set(null);
  }

  /**
   * Save then re-read, never patch what was sent into the rendered state. The
   * endpoint replaces the whole set and the server remains the only authority on
   * what was actually stored.
   */
  savePermissions(): void {
    if (this.savingPermissions()) return;
    const { permissions } = this.permissionForm.getRawValue();
    this.savingPermissions.set(true);
    this.permissionsError.set(null);
    this.actionError.set(null);

    // The whole set is sent, including an empty one. The backend owns the rule that an
    // empty grant is meaningless (`secretary-permission-empty`) and its mapped wording is
    // shown as-is, rather than a second, slightly different local rule guessing at it.
    this.api.replacePermissions(this.membershipId, permissions).subscribe({
      next: () => {
        this.savingPermissions.set(false);
        this.editingPermissions.set(false);
        this.notice.set('Permissions updated.');
        this.load();
      },
      error: (error: unknown) => {
        this.savingPermissions.set(false);
        this.permissionsError.set(secretaryErrorMessage(error));
      },
    });
  }

  // --- lifecycle ---------------------------------------------------------------------------

  requestAction(kind: PendingAction): void {
    this.actionError.set(null);
    this.permissionsError.set(null);
    this.pending.set(kind);
  }

  cancelAction(): void {
    if (this.actingOn()) return;
    this.pending.set(null);
  }

  confirmAction(): void {
    const kind = this.pending();
    const member = this.member();
    if (kind === null || member === null || this.actingOn()) return;

    this.actingOn.set(true);
    this.actionError.set(null);

    const request =
      kind === 'resend'
        ? this.api.resendInvitation(this.membershipId)
        : kind === 'suspend'
          ? this.api.suspend(this.membershipId)
          : this.api.end(this.membershipId);

    request.subscribe({
      next: () => {
        this.actingOn.set(false);
        this.pending.set(null);
        this.notice.set(successNotice(kind, member.email));
        this.load();
      },
      error: (error: unknown) => {
        this.actingOn.set(false);
        this.pending.set(null);
        this.actionError.set(secretaryErrorMessage(error));
      },
    });
  }

  // --- presentation ------------------------------------------------------------------------

  statusLabel(status: SecretaryMembershipStatus): string {
    return membershipStatusLabel(status);
  }

  statusTone(status: SecretaryMembershipStatus): OcStatus {
    return membershipStatusTone(status);
  }

  canResend(status: SecretaryMembershipStatus): boolean {
    return canResendInvitation(status);
  }

  canSuspend(status: SecretaryMembershipStatus): boolean {
    return canSuspend(status);
  }

  canEnd(status: SecretaryMembershipStatus): boolean {
    return canEnd(status);
  }

  /** `Intl` keeps this SSR-safe and avoids hand-rolled date formatting. */
  formatDateTime(value: string): string {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(parsed);
  }

  protected pendingDialogTitle(): string {
    switch (this.pending()) {
      case 'resend':
        return 'Resend invitation';
      case 'suspend':
        return 'Suspend access';
      default:
        return 'End access';
    }
  }

  protected pendingDialogMessage(): string {
    const email = this.member()?.email ?? '';
    switch (this.pending()) {
      case 'resend':
        return `Send a new invitation to ${email}? The previous link stops working.`;
      case 'suspend':
        return `Suspend ${email}? They will lose access to the agenda immediately.`;
      default:
        return `End access for ${email}? This cannot be undone.`;
    }
  }

  protected pendingDialogConfirmLabel(): string {
    switch (this.pending()) {
      case 'resend':
        return 'Resend invitation';
      case 'suspend':
        return 'Suspend access';
      default:
        return 'End access';
    }
  }
}

function successNotice(kind: PendingAction, email: string): string {
  switch (kind) {
    case 'resend':
      return `Invitation resent to ${email}.`;
    case 'suspend':
      return `${email} is suspended.`;
    default:
      return `Access for ${email} has ended.`;
  }
}