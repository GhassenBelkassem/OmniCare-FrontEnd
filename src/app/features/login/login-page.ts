import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { DEMO_WORKSPACES, DemoWorkspaceRole } from '../../core/auth/demo-auth';
import { AuthService } from '../../core/auth/auth.service';
import { APP_MODE } from '../../core/config/app-mode';
import { OcButton } from '../../shared/ui';

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
  readonly staticDemoMode = APP_MODE.staticDemo;
  readonly demoWorkspaces = DEMO_WORKSPACES;
  readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  submit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.errorMessage.set(null);
    const { email, password } = this.form.getRawValue();
    this.auth.login(email, password).subscribe({
      next: (role) => void this.router.navigateByUrl(this.auth.routeFor(role)),
      error: (error: Error) => {
        this.errorMessage.set(error.message);
        this.submitting.set(false);
      },
    });
  }

  continueAs(role: DemoWorkspaceRole): void {
    if (!this.staticDemoMode || this.submitting()) return;
    this.submitting.set(true);
    this.errorMessage.set(null);
    try {
      const authenticatedRole = this.auth.loginAsDemoRole(role);
      void this.router.navigateByUrl(this.auth.routeFor(authenticatedRole));
    } catch (error: unknown) {
      this.errorMessage.set(
        error instanceof Error ? error.message : 'The demo workspace is unavailable.',
      );
      this.submitting.set(false);
    }
  }
}
