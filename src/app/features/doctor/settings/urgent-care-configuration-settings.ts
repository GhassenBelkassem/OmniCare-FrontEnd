import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs/operators';

import { AuthService } from '../../../core/auth/auth.service';
import { OcButton, OcField, OcIcon, OcSkeleton, OcStatusBadge } from '../../../shared/ui';
import { CareCapability } from './professional-services-api.models';
import { problemCode, isAuthenticationError, isNetworkError } from './professional-profile-errors';
import { ActiveCabinetStatus } from './care-capabilities-settings';
import { UrgentCareConfigurationApiService } from './urgent-care-configuration-api.service';
import { UrgentCareConfigurationResponse } from './urgent-care-configuration-api.models';
import {
  UrgentConfigurationDraft,
  distanceDecimalValidator,
  feeDecimalValidator,
  sameDecimalValue,
  sameDraft,
  toNullableDecimal,
} from './urgent-care-configuration-form';

@Component({
  selector: 'app-urgent-care-configuration-settings',
  imports: [ReactiveFormsModule, OcButton, OcField, OcIcon, OcSkeleton, OcStatusBadge],
  templateUrl: './urgent-care-configuration-settings.html',
  styleUrl: './urgent-care-configuration-settings.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UrgentCareConfigurationSettings {
  private readonly api = inject(UrgentCareConfigurationApiService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly activeCabinetStatus = input<ActiveCabinetStatus>('loading');
  readonly capabilities = input<readonly CareCapability[]>([]);
  readonly committedCapabilities = input<readonly CareCapability[]>([]);
  readonly capabilitySelectionLoaded = input(false);
  readonly capabilitySelectionUnavailable = input(false);
  readonly dirtyChange = output<boolean>();
  readonly revisionCommitted = output<number>();

  readonly form = new FormGroup({
    homeFeeTnd: new FormControl('', { nonNullable: true, validators: [feeDecimalValidator] }),
    maxHomeTravelKm: new FormControl('', {
      nonNullable: true,
      validators: [distanceDecimalValidator],
    }),
    cabinetFeeTnd: new FormControl('', { nonNullable: true, validators: [feeDecimalValidator] }),
  });
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly revision = signal<number | null>(null);
  private readonly sharedRevisionFloor = signal(0);
  readonly baseline = signal<UrgentConfigurationDraft | null>(null);
  readonly draft = signal<UrgentConfigurationDraft>(this.form.getRawValue());
  readonly error = signal<string | null>(null);
  readonly authenticationError = signal(false);
  readonly conflict = signal(false);
  readonly success = signal<string | null>(null);

  readonly dirty = computed(() => {
    const baseline = this.baseline();
    return baseline !== null && !sameDraft(baseline, this.draft());
  });
  readonly homeEnabled = computed(() => this.capabilities().includes('URGENT_HOME'));
  readonly cabinetEnabled = computed(() => this.capabilities().includes('URGENT_CABINET'));
  readonly homeActivationPending = computed(
    () => this.homeEnabled() && !this.committedCapabilities().includes('URGENT_HOME'),
  );
  readonly cabinetActivationPending = computed(
    () => this.cabinetEnabled() && !this.committedCapabilities().includes('URGENT_CABINET'),
  );
  readonly capabilityChangesPending = computed(
    () => !sameCapabilities(this.capabilities(), this.committedCapabilities()),
  );

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.draft.set(this.form.getRawValue());
      this.error.set(null);
      this.conflict.set(false);
      this.success.set(null);
      this.dirtyChange.emit(this.dirty());
    });
    this.load(false);
  }

  save(): void {
    const revision = this.revision();
    if (
      revision === null ||
      this.loading() ||
      this.saving() ||
      !this.dirty() ||
      this.capabilityChangesPending()
    ) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const draft = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);
    this.conflict.set(false);
    this.success.set(null);
    this.api
      .replace({
        expectedRevision: revision,
        homeFeeTnd: toNullableDecimal(draft.homeFeeTnd),
        cabinetFeeTnd: toNullableDecimal(draft.cabinetFeeTnd),
        maxHomeTravelKm: toNullableDecimal(draft.maxHomeTravelKm),
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
        next: (response) => {
          this.applyCanonical(response);
          this.success.set('Configuration urgente enregistrée.');
          this.revisionCommitted.emit(response.revision);
        },
        error: (error: unknown) => this.handleError(error, 'save'),
      });
  }

  load(preserveDraft = false): void {
    if (this.loading() || this.saving()) return;
    const previousBaseline = this.baseline();
    const previousDraft = this.form.getRawValue();
    this.loading.set(true);
    this.error.set(null);
    this.authenticationError.set(false);
    this.conflict.set(false);
    this.success.set(null);
    this.api
      .get()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (response) => {
          const canonical = responseToDraft(response);
          const merged =
            preserveDraft && previousBaseline
              ? mergeDraft(previousBaseline, previousDraft, canonical)
              : canonical;
          this.revision.set(Math.max(response.revision, this.sharedRevisionFloor()));
          this.baseline.set(canonical);
          this.form.setValue(merged, { emitEvent: false });
          this.form.markAsPristine();
          this.draft.set(merged);
          this.dirtyChange.emit(!sameDraft(canonical, merged));
        },
        error: (error: unknown) => this.handleError(error, 'load'),
      });
  }

  adoptSharedRevision(revision: number): void {
    this.sharedRevisionFloor.update((current) => Math.max(current, revision));
    const current = this.revision();
    if (current !== null && revision > current) this.revision.set(revision);
    this.conflict.set(false);
  }

  fieldError(controlName: keyof UrgentConfigurationDraft): string | null {
    const control = this.form.controls[controlName];
    if (!control.touched || !control.errors) return null;
    if (control.errors['negative']) return 'Saisissez une valeur positive ou nulle.';
    if (control.errors['positive']) return 'La distance doit être strictement supérieure à zéro.';
    if (control.errors['fractionDigits']) {
      return controlName === 'maxHomeTravelKm'
        ? 'Utilisez au maximum 6 chiffres après la virgule.'
        : 'Utilisez au maximum 3 chiffres après la virgule.';
    }
    if (control.errors['integerDigits']) return 'Cette valeur dépasse la limite autorisée.';
    return 'Saisissez uniquement un nombre décimal, avec un point comme séparateur.';
  }

  reAuthenticate(): void {
    this.auth.logout();
  }

  private applyCanonical(response: UrgentCareConfigurationResponse): void {
    const canonical = responseToDraft(response);
    this.revision.set(Math.max(response.revision, this.sharedRevisionFloor()));
    this.baseline.set(canonical);
    this.form.setValue(canonical, { emitEvent: false });
    this.form.markAsPristine();
    this.draft.set(canonical);
    this.dirtyChange.emit(false);
  }

  private handleError(error: unknown, operation: 'load' | 'save'): void {
    this.authenticationError.set(isAuthenticationError(error));
    const code = urgentProblemCode(error);
    this.conflict.set(
      code === 'RESOURCE_STATE_CONFLICT' || code === 'URGENT_CONFIGURATION_CONFLICT',
    );
    if (this.authenticationError()) {
      this.error.set('Votre session n’est plus valide. Reconnectez-vous pour continuer.');
    } else if (isNetworkError(error)) {
      this.error.set(
        operation === 'load'
          ? 'Connexion impossible. La configuration n’a pas été chargée.'
          : 'Connexion impossible. Vos modifications sont conservées.',
      );
    } else if (this.conflict()) {
      this.error.set(
        'Cette configuration a été modifiée ailleurs. Vos saisies sont conservées : réconciliez-les avec la version actuelle.',
      );
    } else if (code === 'INVALID_URGENT_FEE') {
      this.error.set('Un tarif urgent est invalide. Vérifiez les deux montants.');
    } else if (code === 'INVALID_HOME_TRAVEL_DISTANCE') {
      this.error.set('La distance maximale à domicile est invalide.');
    } else if (code === 'PROFESSIONAL_NOT_ELIGIBLE') {
      this.error.set('Votre profil professionnel ne permet pas cette modification actuellement.');
    } else {
      this.error.set(
        operation === 'load'
          ? 'Impossible de charger la configuration urgente.'
          : 'Impossible d’enregistrer. Vos modifications sont conservées.',
      );
    }
  }
}

function urgentProblemCode(error: unknown): string | null {
  const mapped = problemCode(error);
  if (mapped !== null || !(error instanceof HttpErrorResponse) || typeof error.error !== 'string') {
    return mapped;
  }
  try {
    const body: unknown = JSON.parse(error.error);
    return typeof body === 'object' &&
      body !== null &&
      'code' in body &&
      typeof body.code === 'string'
      ? body.code
      : null;
  } catch {
    return null;
  }
}

function responseToDraft(response: UrgentCareConfigurationResponse): UrgentConfigurationDraft {
  return {
    homeFeeTnd: response.home.consultationFeeTnd ?? '',
    maxHomeTravelKm: response.home.maxTravelKm ?? '',
    cabinetFeeTnd: response.cabinet.consultationFeeTnd ?? '',
  };
}

function mergeDraft(
  oldBaseline: UrgentConfigurationDraft,
  oldDraft: UrgentConfigurationDraft,
  newBaseline: UrgentConfigurationDraft,
): UrgentConfigurationDraft {
  return {
    homeFeeTnd: sameDecimalValue(oldDraft.homeFeeTnd, oldBaseline.homeFeeTnd)
      ? newBaseline.homeFeeTnd
      : oldDraft.homeFeeTnd,
    maxHomeTravelKm: sameDecimalValue(oldDraft.maxHomeTravelKm, oldBaseline.maxHomeTravelKm)
      ? newBaseline.maxHomeTravelKm
      : oldDraft.maxHomeTravelKm,
    cabinetFeeTnd: sameDecimalValue(oldDraft.cabinetFeeTnd, oldBaseline.cabinetFeeTnd)
      ? newBaseline.cabinetFeeTnd
      : oldDraft.cabinetFeeTnd,
  };
}

function sameCapabilities(
  selected: readonly CareCapability[],
  committed: readonly CareCapability[],
): boolean {
  return (
    selected.length === committed.length &&
    selected.every((capability) => committed.includes(capability))
  );
}
