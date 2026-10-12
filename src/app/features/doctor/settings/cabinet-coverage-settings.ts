import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';

import { AuthService } from '../../../core/auth/auth.service';
import { OcButton, OcIcon, OcRadioGroup, OcRadioOption, OcSkeleton } from '../../../shared/ui';
import {
  CoverageAcceptance,
  PracticeLocationCoverageResponse,
} from './professional-services-api.models';
import { PracticeCoverageApiService } from './professional-services-api.service';
import { mapServicesSettingsFailure } from './services-settings-errors';

const COVERAGE_CHOICES: readonly OcRadioOption[] = [
  { value: 'NOT_DECLARED', label: 'Non renseigné' },
  { value: 'ACCEPTED', label: 'Accepté' },
  { value: 'NOT_ACCEPTED', label: 'Non accepté' },
];

@Component({
  selector: 'app-cabinet-coverage-settings',
  imports: [ReactiveFormsModule, OcButton, OcIcon, OcRadioGroup, OcSkeleton],
  templateUrl: './cabinet-coverage-settings.html',
  styleUrl: './cabinet-coverage-settings.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CabinetCoverageSettings implements OnInit {
  private readonly api = inject(PracticeCoverageApiService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly locationId = input.required<string>();
  readonly choices = COVERAGE_CHOICES;
  readonly form = new FormGroup({
    cnam: new FormControl<CoverageAcceptance>('NOT_DECLARED', { nonNullable: true }),
    privateInsurance: new FormControl<CoverageAcceptance>('NOT_DECLARED', {
      nonNullable: true,
    }),
    selfPay: new FormControl<CoverageAcceptance>('NOT_DECLARED', { nonNullable: true }),
  });
  readonly revision = signal<number | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly authenticationError = signal(false);
  readonly conflict = signal(false);
  readonly success = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    if (this.loading() || this.saving()) return;
    this.loading.set(true);
    this.error.set(null);
    this.authenticationError.set(false);
    this.conflict.set(false);
    this.success.set(null);
    this.form.disable({ emitEvent: false });
    this.api
      .get(this.locationId())
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.loading.set(false);
          this.form.enable({ emitEvent: false });
        }),
      )
      .subscribe({
        next: (response) => this.applyResponse(response),
        error: (error: unknown) => this.handleError(error, 'load'),
      });
  }

  save(): void {
    const revision = this.revision();
    if (revision === null || this.saving() || !this.form.dirty) return;
    const value = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);
    this.authenticationError.set(false);
    this.conflict.set(false);
    this.success.set(null);
    this.form.disable({ emitEvent: false });
    this.api
      .replace(this.locationId(), {
        expectedRevision: revision,
        cnamAcceptance: value.cnam,
        privateInsuranceAcceptance: value.privateInsurance,
        selfPayAcceptance: value.selfPay,
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.saving.set(false);
          this.form.enable({ emitEvent: false });
        }),
      )
      .subscribe({
        next: (response) => {
          this.applyResponse(response);
          this.success.set('Couverture et paiement enregistrés.');
        },
        error: (error: unknown) => this.handleError(error, 'save'),
      });
  }

  reAuthenticate(): void {
    this.auth.logout();
  }

  private applyResponse(response: PracticeLocationCoverageResponse): void {
    this.revision.set(response.revision);
    this.form.reset(
      {
        cnam: response.cnam.acceptance,
        privateInsurance: response.privateInsurance.acceptance,
        selfPay: response.selfPay.acceptance,
      },
      { emitEvent: false },
    );
    this.form.markAsPristine();
  }

  private handleError(error: unknown, operation: 'load' | 'save'): void {
    const failure = mapServicesSettingsFailure(error, 'coverage', operation);
    this.error.set(failure.message);
    this.authenticationError.set(failure.authentication);
    this.conflict.set(failure.conflict);
  }
}
