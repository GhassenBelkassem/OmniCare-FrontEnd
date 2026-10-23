import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { RUNTIME_CONFIG } from '../../core/config/runtime-config';
import { ApiErrorBody, DashboardRole } from '../../core/auth/auth.models';
import { OcButton } from '../../shared/ui';

interface InvitationValidation {
  readonly email: string;
  readonly role: DashboardRole;
  readonly expiresAt: string;
}

/**
 * The backend provisions invitations for every professional role, not just a
 * clinic administrator or a doctor. A two-way split would greet an invited
 * secretary as "doctor".
 */
const INVITATION_ROLE_LABELS: Readonly<Record<DashboardRole, string>> = {
  PATIENT: 'patient',
  DOCTOR: 'doctor',
  SECRETARY: 'secretary',
  NURSE: 'nurse',
  KINE: 'physiotherapist',
  CLINIC_MEDECIN: 'clinic physician',
  CLINIC_INFIRMIERE: 'clinic nurse',
  CLINIC_KINE: 'clinic physiotherapist',
  CLINIC_ASSISTANT: 'clinic assistant',
  CLINIC_ADMIN: 'clinic administrator',
  ADMIN: 'platform administrator',
};

@Component({
  selector: 'app-first-login-page',
  imports: [ReactiveFormsModule, RouterLink, OcButton],
  template: `
    <main class="first-login">
      <section class="first-login__card" aria-labelledby="first-login-title">
        <p class="eyebrow">Professional invitation</p>
        @if (loading()) {
          <h1 id="first-login-title">Checking your invitation…</h1>
        } @else if (completed()) {
          <h1 id="first-login-title">Your account is ready</h1>
          <p>Your email is verified and your password was created. You can now sign in.</p>
          <a routerLink="/login">Continue to sign in</a>
        } @else if (invitation(); as details) {
          <h1 id="first-login-title">Create your password</h1>
          <p>Complete the {{ invitationRoleLabel(details.role) }} account for <strong>{{ details.email }}</strong>.</p>
          @if (errorMessage()) { <div class="message message--error" role="alert">{{ errorMessage() }}</div> }
          <form [formGroup]="form" (ngSubmit)="submit()">
            <label for="new-password">New password</label>
            <input id="new-password" type="password" formControlName="password" autocomplete="new-password" />
            <small>Use at least 12 characters.</small>
            <label for="confirm-password">Confirm password</label>
            <input id="confirm-password" type="password" formControlName="confirmation" autocomplete="new-password" />
            <oc-button variant="primary" type="submit" [loading]="submitting()">Activate account</oc-button>
          </form>
        } @else {
          <h1 id="first-login-title">This invitation cannot be used</h1>
          <div class="message message--error" role="alert">{{ errorMessage() }}</div>
          <p>Ask your platform administrator to send a new invitation.</p>
          <a routerLink="/login">Return to sign in</a>
        }
      </section>
    </main>
  `,
  styleUrl: './first-login-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FirstLoginPage {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly config = inject(RUNTIME_CONFIG);
  private readonly destroyRef = inject(DestroyRef);
  private readonly token = this.route.snapshot.queryParamMap.get('token') ?? '';
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly completed = signal(false);
  readonly invitation = signal<InvitationValidation | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly form = new FormGroup({
    password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(12)] }),
    confirmation: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  constructor() {
    if (!this.token) {
      this.loading.set(false);
      this.errorMessage.set('The invitation link is incomplete.');
      return;
    }
    this.http.post<InvitationValidation>(`${this.config.apiBaseUrl}/auth/invitations/validate`, { token: this.token })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (details) => { this.invitation.set(details); this.loading.set(false); },
        error: (error: HttpErrorResponse) => { this.errorMessage.set(readMessage(error)); this.loading.set(false); },
      });
  }

  protected invitationRoleLabel(role: DashboardRole): string {
    return INVITATION_ROLE_LABELS[role];
  }

  submit(): void {
    if (this.form.invalid || this.submitting()) { this.form.markAllAsTouched(); return; }
    const { password, confirmation } = this.form.getRawValue();
    if (password !== confirmation) { this.errorMessage.set('The passwords do not match.'); return; }
    this.submitting.set(true);
    this.errorMessage.set(null);
    this.http.post<void>(`${this.config.apiBaseUrl}/auth/invitations/accept`, { token: this.token, newPassword: password })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => { this.completed.set(true); this.submitting.set(false); },
        error: (error: HttpErrorResponse) => { this.errorMessage.set(readMessage(error)); this.submitting.set(false); },
      });
  }
}

function readMessage(error: HttpErrorResponse): string {
  return (error.error as ApiErrorBody | null)?.message ?? 'The invitation could not be processed.';
}
