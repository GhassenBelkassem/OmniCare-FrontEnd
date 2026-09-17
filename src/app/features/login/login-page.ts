import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { OcButton } from '../../shared/ui';

type LoginStep = 'credentials' | 'otp';

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, RouterLink, OcButton],
  templateUrl: './login-page.html',
  styleUrl: './login-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly step = signal<LoginStep>('credentials');
  readonly otpPhone = signal<string | null>(null);
  readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });
  readonly otpGroup = new FormGroup({
    otp: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^\d{6}$/)],
    }),
  });
  readonly otp = this.otpGroup.controls.otp;

  submit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.errorMessage.set(null);
    const { email, password } = this.form.getRawValue();
    this.auth.login(email, password).subscribe({
      next: (result) => {
        if (result.kind === 'requires-otp') {
          this.otpPhone.set(result.phone);
          this.step.set('otp');
          this.otp.reset();
          this.submitting.set(false);
          return;
        }
        void this.router.navigateByUrl(this.auth.routeFor(result.role));
      },
      error: (error: Error) => {
        this.errorMessage.set(error.message);
        this.submitting.set(false);
      },
    });
  }

  submitOtp(): void {
    const phone = this.otpPhone();
    if (phone === null || this.otp.invalid || this.submitting()) {
      this.otp.markAsTouched();
      return;
    }
    this.submitting.set(true);
    this.errorMessage.set(null);
    this.auth.verifyPhoneOtp(phone, this.otp.value).subscribe({
      next: (role) => void this.router.navigateByUrl(this.auth.routeFor(role)),
      error: (error: Error) => {
        this.errorMessage.set(error.message);
        this.submitting.set(false);
      },
    });
  }

  backToCredentials(): void {
    this.step.set('credentials');
    this.errorMessage.set(null);
  }

  maskedPhone(phone: string): string {
    if (phone.length < 6) return phone;
    return `+${phone.slice(1, 4)}****${phone.slice(-2)}`;
  }
}
