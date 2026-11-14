import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AUTH_MODE } from '../../core/auth/auth-mode';
import type { DashboardRole, LoginOutcome } from '../../core/auth/auth.models';
import { AuthService } from '../../core/auth/auth.service';
import { AuthTokenStore } from '../../core/auth/auth-token.store';
import { OcButton, OcIcon } from '../../shared/ui';

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, RouterLink, NgOptimizedImage, OcButton, OcIcon],
  templateUrl: './login-page.html',
  styleUrl: './login-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly tokens = inject(AuthTokenStore);
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly passwordVisible = signal(false);
  readonly staticDemoMode = AUTH_MODE.staticDemo;
  readonly demoWorkspaces = AUTH_MODE.workspaces;
  readonly otpRequired = () => this.tokens.authState() === 'OTP_REQUIRED';
  readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });
  readonly otp = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(/^\d{6}$/)],
  });

  emailInvalid(): boolean {
    const control = this.form.controls.email;
    return control.touched && control.invalid;
  }

  passwordInvalid(): boolean {
    const control = this.form.controls.password;
    return control.touched && control.invalid;
  }

  togglePasswordVisibility(): void {
    this.passwordVisible.update((visible) => !visible);
  }

  submit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.errorMessage.set(null);
    const { email, password } = this.form.getRawValue();
    this.auth.login(email, password).subscribe({
      next: (outcome) => this.handleOutcome(outcome),
      error: (error: Error) => {
        this.errorMessage.set(error.message);
        this.submitting.set(false);
      },
    });
  }

  verifyOtp(): void {
    if (this.otp.invalid || this.submitting()) {
      this.otp.markAsTouched();
      return;
    }
    this.submitting.set(true);
    this.errorMessage.set(null);
    this.auth.verifyPhoneOtp(this.otp.value).subscribe({
      next: (outcome) => this.handleOutcome(outcome),
      error: (error: Error) => {
        this.errorMessage.set(error.message);
        this.submitting.set(false);
      },
    });
  }

  resendOtp(): void {
    if (this.submitting()) return;
    this.submitting.set(true);
    this.errorMessage.set(null);
    this.auth.resendPhoneOtp().subscribe({
      next: () => this.submitting.set(false),
      error: (error: Error) => {
        this.errorMessage.set(error.message);
        this.submitting.set(false);
      },
    });
  }

  continueAs(role: DashboardRole): void {
    if (!this.staticDemoMode || this.submitting()) return;
    this.submitting.set(true);
    this.errorMessage.set(null);
    try {
      const authenticatedRole = this.auth.loginAsWorkspaceRole(role);
      void this.router.navigateByUrl(this.auth.routeFor(authenticatedRole));
    } catch (error: unknown) {
      this.errorMessage.set(
        error instanceof Error ? error.message : 'The demo workspace is unavailable.',
      );
      this.submitting.set(false);
    }
  }

  private handleOutcome(outcome: LoginOutcome): void {
    this.submitting.set(false);
    if (outcome.kind === 'OTP_REQUIRED') return;
    if (outcome.kind === 'PASSWORD_CHANGE_REQUIRED') {
      void this.router.navigateByUrl('/password-change');
      return;
    }
    void this.router.navigateByUrl(this.auth.routeFor(outcome.role));
  }
}
