import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  signal,
  inject,
  OnInit,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzModalModule } from 'ng-zorro-antd/modal';

import { OcButton } from '../../../../shared/ui';
import { SecretaryPermission } from '../secretary-api.models';
import { SecretaryPermissionSelect } from '../secretary-permission-select';
import { SECRETARY_PERMISSIONS } from '../secretary-api.models';

export type InviteDialogResult = {
  email: string;
  permissions?: readonly SecretaryPermission[];
  firstName?: string;
  lastName?: string;
} | null;

@Component({
  selector: 'app-invite-dialog',
  imports: [ReactiveFormsModule, NzModalModule, OcButton, SecretaryPermissionSelect],
  templateUrl: './invite-dialog.html',
  styleUrl: './invite-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InviteDialog implements OnInit {
  readonly open = input.required<boolean>();
  readonly closed = output<InviteDialogResult>();

  private readonly formBuilder = inject(FormBuilder);

  readonly inviteForm = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    permissions: [[] as readonly SecretaryPermission[]],
    firstName: ['', [Validators.maxLength(80)]],
    lastName: ['', [Validators.maxLength(80)]],
  });

  readonly inviting = signal(false);
  readonly inviteError = signal<string | null>(null);
  readonly emailError = signal<string | null>(null);

  ngOnInit(): void {
    // Permissions preset: VIEW_AGENDA, CREATE_APPOINTMENT, VIEW_PATIENT_CONTACT
    this.inviteForm.controls.permissions.setValue([
      'VIEW_AGENDA',
      'CREATE_APPOINTMENT',
      'VIEW_PATIENT_CONTACT',
    ]);
  }

  submitInvite(): void {
    if (this.inviting() || this.inviteForm.invalid) return;
    this.inviting.set(true);
    this.inviteError.set(null);
    this.emailError.set(null);

    const { email, permissions, firstName, lastName } = this.inviteForm.getRawValue();
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();

    // An empty selection must OMIT the key; backend grants defaults (VIEW_AGENDA, CREATE_APPOINTMENT, VIEW_PATIENT_CONTACT)
    this.closed.emit({
      email: email.trim(),
      permissions: permissions.length === 0 ? undefined : [...permissions],
      firstName: trimmedFirstName === '' ? undefined : trimmedFirstName,
      lastName: trimmedLastName === '' ? undefined : trimmedLastName,
    });
    this.inviting.set(false);
  }

  cancel(): void {
    this.closed.emit(null);
    this.inviting.set(false);
  }

  emailInvalidForDisplay(): boolean {
    const email = this.inviteForm.controls.email;
    return email.invalid && (email.touched || email.dirty);
  }
}