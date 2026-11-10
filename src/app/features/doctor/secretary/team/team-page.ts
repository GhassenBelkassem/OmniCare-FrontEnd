import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { OcButton, OcEmptyState, OcPageHeader, OcStatus, OcStatusBadge } from '../../../../shared/ui';
import {
  DoctorStaffSummary,
  SecretaryInvitationResponse,
  SecretaryMembershipStatus,
  SecretaryPermission,
} from '../secretary-api.models';
import { SecretaryApiService } from '../secretary-api.service';
import { SecretaryPermissionSelect } from '../secretary-permission-select';
import {
  membershipStatusLabel,
  membershipStatusTone,
  permissionLabels,
  secretaryErrorMessage,
  secretaryFieldError,
} from '../secretary-page-utils';

@Component({
  selector: 'app-team-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    OcButton,
    OcEmptyState,
    OcPageHeader,
    OcStatusBadge,
    SecretaryPermissionSelect,
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
    // An empty selection is submitted explicitly so the backend can answer with
    // `secretary-permission-empty` rather than the form silently guessing.
    permissions: [[] as readonly SecretaryPermission[]],
    // Optional: a doctor who does not have the name to hand must still be able to
    // delegate immediately, so neither field is required. Length is capped to match the
    // backend's own limit rather than being discovered as a 400 on submit.
    firstName: ['', [Validators.maxLength(80)]],
    lastName: ['', [Validators.maxLength(80)]],
  });

  readonly hasMembers = computed(() => this.members().length > 0);

  /**
   * A list refresh that fails after a successful invitation must not contradict the
   * invitation's own result, so it reports itself as a list problem with its own retry
   * instead of a generic failure beside "Invitation sent".
   */
  readonly listErrorMessage = computed(() => {
    const message = this.loadError();
    if (message === null) return null;
    return this.inviteResult() !== null
      ? 'Invitation sent, but the team list could not be refreshed.'
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

  submitInvite(): void {
    if (this.inviting()) return;
    this.submitAttempted.set(true);
    if (this.inviteForm.invalid) {
      this.inviteForm.markAllAsTouched();
      return;
    }
    const { email, permissions, firstName, lastName } = this.inviteForm.getRawValue();
    this.inviting.set(true);
    this.inviteError.set(null);
    this.emailError.set(null);

    // Trimmed then dropped when blank, so an untouched optional field is absent from the
    // payload rather than present-and-empty. The backend's profile-creation rule treats
    // "absent" and "blank" the same way, but sending neither keeps the wire honest.
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();

    this.api
      .invite({
        email: email.trim(),
        // An empty selection must OMIT the key, not send `permissions: []`. The backend treats
        // an absent set as "grant the defaults" (VIEW_AGENDA, CREATE_APPOINTMENT,
        // VIEW_PATIENT_CONTACT) but rejects an explicitly empty one with 422
        // `secretary-permission-empty`, which made the form's own "leave empty to grant the
        // default agenda set" hint impossible to honour.
        ...(permissions.length === 0 ? {} : { permissions }),
        ...(trimmedFirstName === '' ? {} : { firstName: trimmedFirstName }),
        ...(trimmedLastName === '' ? {} : { lastName: trimmedLastName }),
      })
      .subscribe({
        next: (response) => {
          this.inviting.set(false);
          this.inviteResult.set(response);
// The open panel already reports the outcome in full ("An invitation was
          // sent to <email> with status <badge>"). A page-level success message as
          // well would restate the same fact in a second place.
          this.load();
        },
        error: (error: unknown) => {
          this.inviting.set(false);
          this.inviteError.set(secretaryErrorMessage(error));
          this.emailError.set(secretaryFieldError(error, 'email'));
        },
      });
  }

  statusLabel(status: SecretaryMembershipStatus): string {
    return membershipStatusLabel(status);
  }

  statusTone(status: SecretaryMembershipStatus): OcStatus {
    return membershipStatusTone(status);
  }

  permissionSummary(membership: DoctorStaffSummary): string {
    return permissionLabels(membership.permissions);
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

}
