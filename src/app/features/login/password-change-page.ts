import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { OcButton } from '../../shared/ui';

@Component({
  selector: 'app-password-change-page',
  imports: [ReactiveFormsModule, OcButton],
  template: `
    <main class="login-page">
      <section class="login-card" aria-labelledby="password-change-title">
        <p class="login-eyebrow">Account security</p>
        <h1 id="password-change-title">Change your temporary password</h1>
        <p class="login-intro">You must choose a new password before opening your workspace.</p>
        @if (errorMessage()) {
          <div class="login-error" role="alert">{{ errorMessage() }}</div>
        }
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <label for="current-password">Current password</label>
          <input
            id="current-password"
            type="password"
            formControlName="currentPassword"
            autocomplete="current-password"
          />
          <label for="new-password">New password</label>
          <input
            id="new-password"
            type="password"
            formControlName="newPassword"
            autocomplete="new-password"
          />
          <label for="confirm-password">Confirm new password</label>
          <input
            id="confirm-password"
            type="password"
            formControlName="confirmation"
            autocomplete="new-password"
          />
          <oc-button variant="primary" type="submit" [loading]="submitting()"
            >Change password</oc-button
          >
          <button class="back-link" type="button" [disabled]="submitting()" (click)="logout()">
            Sign out
          </button>
        </form>
      </section>
    </main>
  `,
  styleUrl: './login-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PasswordChangePage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly form = new FormGroup({
    currentPassword: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    newPassword: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(12)],
    }),
    confirmation: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  submit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    const { currentPassword, newPassword, confirmation } = this.form.getRawValue();
    if (newPassword !== confirmation) {
      this.errorMessage.set('The passwords do not match.');
      return;
    }
    this.submitting.set(true);
    this.errorMessage.set(null);
    this.auth.changeRequiredPassword(currentPassword, newPassword).subscribe({
      next: (role) => void this.router.navigateByUrl(this.auth.routeFor(role)),
      error: (error: Error) => {
        this.errorMessage.set(error.message);
        this.submitting.set(false);
      },
    });
  }

  logout(): void {
    this.auth.logout();
  }
}
