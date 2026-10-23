import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { finalize } from 'rxjs/operators';

import { AuthService } from '../../../core/auth/auth.service';
import {
  OcButton,
  OcCard,
  OcConfirmDialog,
  OcField,
  OcSkeleton,
  OcStatusBadge,
} from '../../../shared/ui';
import { ApiErrorBody } from '../../../core/auth/auth.models';
import {
  AccountDeviceResponse,
  AccountSecuritySummaryResponse,
} from './account-security-api.models';
import { AccountSecurityApiService } from './account-security-api.service';

type LoadState = 'notLoaded' | 'loading' | 'loaded' | 'error';
type PasswordControlName = 'currentPassword' | 'newPassword' | 'confirmation';

function matchingPasswords(control: AbstractControl): ValidationErrors | null {
  const newPassword = control.get('newPassword')?.value as string | null;
  const confirmation = control.get('confirmation')?.value as string | null;
  return newPassword === confirmation ? null : { passwordMismatch: true };
}

@Component({
  selector: 'app-account-security-section',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    OcButton,
    OcCard,
    OcConfirmDialog,
    OcField,
    OcSkeleton,
    OcStatusBadge,
  ],
  templateUrl: './account-security-section.html',
  styleUrl: './account-security-section.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountSecuritySection implements OnInit {
  private readonly api = inject(AccountSecurityApiService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly summaryState = signal<LoadState>('notLoaded');
  readonly summary = signal<AccountSecuritySummaryResponse | null>(null);
  readonly devicesState = signal<LoadState>('notLoaded');
  readonly devices = signal<readonly AccountDeviceResponse[]>([]);
  readonly passwordFormOpen = signal(false);
  readonly passwordSaving = signal(false);
  readonly passwordError = signal<string | null>(null);
  readonly passwordSuccess = signal<string | null>(null);
  readonly deviceBeingRevoked = signal<AccountDeviceResponse | null>(null);
  readonly deviceRevoking = signal(false);
  readonly deviceMutationError = signal<string | null>(null);
  readonly logoutAllConfirmOpen = signal(false);
  readonly logoutAllPending = signal(false);
  readonly logoutAllError = signal<string | null>(null);

  readonly passwordForm = new FormGroup(
    {
      currentPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(128)],
      }),
      newPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(12), Validators.maxLength(128)],
      }),
      confirmation: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(128)],
      }),
    },
    { validators: matchingPasswords },
  );

  ngOnInit(): void {
    this.loadSummary();
    this.loadDevices();
  }

  loadSummary(): void {
    this.summaryState.set('loading');
    this.summary.set(null);
    this.api
      .getSummary()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (summary) => {
          this.summary.set(summary);
          this.summaryState.set('loaded');
          if (summary.mustChangePassword && summary.hasPassword) {
            this.passwordFormOpen.set(true);
          }
        },
        error: () => this.summaryState.set('error'),
      });
  }

  loadDevices(): void {
    this.devicesState.set('loading');
    this.deviceMutationError.set(null);
    this.api
      .getDevices()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (devices) => {
          this.devices.set(devices);
          this.devicesState.set('loaded');
        },
        error: () => this.devicesState.set('error'),
      });
  }

  accountTypeLabel(accountType: string): string {
    return accountType === 'DOCTOR' ? 'Médecin' : 'Compte professionnel';
  }

  mfaLabel(method: string): string {
    if (method === 'TOTP') return 'Application d’authentification';
    if (method === 'SMS_OTP') return 'Code à usage unique par SMS';
    return method === 'NONE' ? 'Non configurée' : 'Méthode configurée';
  }

  devicePlatformLabel(platform: string | null): string {
    if (platform === 'WEB') return 'Navigateur web';
    if (platform === 'ANDROID') return 'Android';
    if (platform === 'IOS') return 'iPhone ou iPad';
    return 'Autre appareil';
  }

  openPasswordForm(): void {
    this.passwordError.set(null);
    this.passwordSuccess.set(null);
    this.passwordFormOpen.set(true);
  }

  closePasswordForm(): void {
    this.passwordForm.reset();
    this.passwordError.set(null);
    this.passwordFormOpen.set(false);
  }

  passwordFieldError(field: PasswordControlName): string | null {
    const control = this.passwordForm.controls[field];
    if (!control.touched) return null;
    if (control.hasError('required')) return 'Ce champ est requis.';
    if (control.hasError('minlength'))
      return 'Le mot de passe doit contenir au moins 12 caractères.';
    if (control.hasError('maxlength')) return 'Ce champ ne peut pas dépasser 128 caractères.';
    if (field === 'confirmation' && this.passwordForm.hasError('passwordMismatch')) {
      return 'Les mots de passe ne correspondent pas.';
    }
    return null;
  }

  changePassword(): void {
    this.passwordForm.markAllAsTouched();
    if (this.passwordForm.invalid || this.passwordSaving()) return;

    const { currentPassword, newPassword } = this.passwordForm.getRawValue();
    this.passwordSaving.set(true);
    this.passwordError.set(null);
    this.passwordSuccess.set(null);
    this.api
      .changePassword({ currentPassword, newPassword })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.passwordSaving.set(false)),
      )
      .subscribe({
        next: () => {
          this.passwordForm.reset();
          this.passwordFormOpen.set(false);
          this.passwordSuccess.set('Votre mot de passe a été modifié.');
          this.summary.update((summary) =>
            summary ? { ...summary, mustChangePassword: false, hasPassword: true } : summary,
          );
        },
        error: (error: unknown) => {
          this.passwordForm.controls.currentPassword.reset();
          this.passwordError.set(
            accountMutationError(error, 'Impossible de modifier le mot de passe.'),
          );
        },
      });
  }

  requestDeviceLogout(device: AccountDeviceResponse): void {
    if (device.current) return;
    this.deviceMutationError.set(null);
    this.deviceBeingRevoked.set(device);
  }

  cancelDeviceLogout(): void {
    if (!this.deviceRevoking()) this.deviceBeingRevoked.set(null);
  }

  confirmDeviceLogout(): void {
    const device = this.deviceBeingRevoked();
    if (!device || device.current || this.deviceRevoking()) return;

    this.deviceRevoking.set(true);
    this.deviceMutationError.set(null);
    this.api
      .logoutDevice(device.deviceId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.deviceRevoking.set(false)),
      )
      .subscribe({
        next: () => {
          this.deviceBeingRevoked.set(null);
          this.loadDevices();
        },
        error: (error: unknown) => {
          this.deviceBeingRevoked.set(null);
          this.deviceMutationError.set(
            accountMutationError(error, 'Impossible de déconnecter cet appareil.'),
          );
        },
      });
  }

  confirmLogoutAll(): void {
    if (this.logoutAllPending()) return;
    this.logoutAllPending.set(true);
    this.logoutAllError.set(null);
    this.auth
      .logoutAll()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.logoutAllPending.set(false)),
      )
      .subscribe({
        next: () => this.logoutAllConfirmOpen.set(false),
        error: (error: unknown) => {
          this.logoutAllConfirmOpen.set(false);
          this.logoutAllError.set(
            accountMutationError(error, 'Impossible de déconnecter toutes les sessions.'),
          );
        },
      });
  }
}

function accountMutationError(error: unknown, fallback: string): string {
  if (!(error instanceof HttpErrorResponse)) return fallback;
  const body = error.error as ApiErrorBody | null;
  return typeof body?.message === 'string' && body.message.trim() ? body.message : fallback;
}
