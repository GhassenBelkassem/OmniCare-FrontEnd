import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs/operators';

import { ApiErrorBody } from '../../../core/auth/auth.models';
import { AuthService } from '../../../core/auth/auth.service';
import { OcButton, OcCard, OcEmptyState, OcField, OcTagInput, OcTextarea } from '../../../shared/ui';
import { MeProfessionalProfileResponse } from './professional-profile-api.models';
import { ProfessionalProfileApiService } from './professional-profile-api.service';
import {
  EDITABLE_FIELDS,
  EditableProfessionalProfileField,
  EditableScalarField,
  EditableTagListField,
  ProfessionalProfileDraft,
  ProfessionalProfileFieldErrors,
  buildProfessionalProfilePatch,
  draftFromProfile,
  emptyProfessionalProfileDraft,
  hasFieldErrors,
  validateDraft,
} from './professional-profile-form';
import { PracticeLocationService } from './practice-location.service';

const MFA_METHOD_LABELS: Readonly<Record<string, string>> = {
  none: 'Aucune',
  email_otp: 'Code par email',
  totp: 'Application d\'authentification',
  sms: 'Code par SMS',
};

const RE_AUTHENTICATE_MESSAGE = 'Votre session n\'est plus valide. Reconnectez-vous pour continuer.';

interface ManagedField {
  readonly key:
    | 'professionalLicenseNumber'
    | 'verifiedAt'
    | 'affiliatedClinicId'
    | 'governorate'
    | 'mfaMethod'
    | 'alsoIndependent';
  readonly label: string;
}

const MANAGED_FIELDS: readonly ManagedField[] = [
  { key: 'professionalLicenseNumber', label: 'Numero de licence' },
  { key: 'governorate', label: 'Gouvernorat' },
  { key: 'affiliatedClinicId', label: 'Clinique' },
  { key: 'verifiedAt', label: 'Verifie le' },
  { key: 'mfaMethod', label: 'Authentification' },
  { key: 'alsoIndependent', label: 'Exercice independant' },
];

@Component({
  selector: 'app-professional-profile-section',
  imports: [FormsModule, OcButton, OcCard, OcEmptyState, OcField, OcTagInput, OcTextarea],
  templateUrl: './professional-profile-section.html',
  styleUrl: './professional-profile-section.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfessionalProfileSection {
  private readonly api = inject(ProfessionalProfileApiService);
  private readonly auth = inject(AuthService);
  private readonly location = inject(PracticeLocationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly managedFields = MANAGED_FIELDS;

  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly profile = signal<MeProfessionalProfileResponse | null>(null);
  readonly draft = signal<ProfessionalProfileDraft>(emptyProfessionalProfileDraft());
  readonly fieldErrors = signal<ProfessionalProfileFieldErrors>({});

  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);
  readonly saved = signal<string | null>(null);
  readonly authError = signal<string | null>(null);

  readonly locating = signal(false);
  readonly locationError = signal<string | null>(null);

  constructor() {
    this.loadProfile();
  }

  loadProfile(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.authError.set(null);
    this.api
      .getProfile()
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.loading.set(false)))
      .subscribe({
        next: (profile) => this.applyProfile(profile),
        error: (error: unknown) => this.handleLoadError(error),
      });
  }

  updateScalar(field: EditableScalarField, value: string): void {
    this.draft.update((draft) => ({ ...draft, [field]: value }));
    this.clearFieldError(field);
    this.markDirty();
  }

  updateBoolean(value: boolean): void {
    this.draft.update((draft) => ({ ...draft, acceptingNewPatients: value }));
    this.clearFieldError('acceptingNewPatients');
    this.markDirty();
  }

  updateList(field: EditableTagListField, value: readonly string[]): void {
    this.draft.update((draft) => ({ ...draft, [field]: value }));
    this.clearFieldError(field);
    this.markDirty();
  }

  async useCurrentLocation(): Promise<void> {
    if (this.locating()) return;
    this.locating.set(true);
    this.locationError.set(null);
    const coords = await this.location.getCurrentPosition();
    this.locating.set(false);
    if (coords === null) {
      this.locationError.set('Impossible de recuperer votre position. Autorisez la geolocalisation puis reessayez.');
      return;
    }
    this.updateScalar('practiceLatitude', coords.latitude.toFixed(6));
    this.updateScalar('practiceLongitude', coords.longitude.toFixed(6));
  }

  save(): void {
    if (this.saving()) return;
    const baseline = this.profile();
    if (baseline === null) return;

    const errors = validateDraft(this.draft());
    this.fieldErrors.set(errors);
    if (hasFieldErrors(errors)) {
      this.saved.set(null);
      this.saveError.set('Corrigez les erreurs indiquees avant d\'enregistrer.');
      return;
    }

    const patch = buildProfessionalProfilePatch(this.draft(), baseline);
    if (Object.keys(patch).length === 0) {
      this.saveError.set(null);
      this.saved.set('Aucune modification a enregistrer.');
      return;
    }

    this.saving.set(true);
    this.saveError.set(null);
    this.saved.set(null);
    this.authError.set(null);
    this.api
      .updateProfile(patch)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => this.reloadAfterSave(),
        error: (error: unknown) => this.handleSaveError(error),
      });
  }

  reAuthenticate(): void {
    this.auth.logout();
  }

  managedValue(key: ManagedField['key']): string {
    const profile = this.profile();
    if (profile === null) return '—';
    switch (key) {
      case 'alsoIndependent':
        return profile.alsoIndependent === null ? '—' : profile.alsoIndependent ? 'Oui' : 'Non';
      case 'verifiedAt':
        return profile.verifiedAt !== null && profile.verifiedAt !== '' ? profile.verifiedAt.slice(0, 10) : '—';
      case 'mfaMethod':
        return mfaLabel(profile.mfaMethod);
      default:
        return profile[key] ?? '—';
    }
  }

  private applyProfile(profile: MeProfessionalProfileResponse): void {
    this.profile.set(profile);
    this.draft.set(draftFromProfile(profile));
    this.fieldErrors.set({});
    this.saveError.set(null);
    this.saved.set(null);
    this.locationError.set(null);
  }

  private handleLoadError(error: unknown): void {
    if (error instanceof HttpErrorResponse && error.status === 403) {
      this.authError.set(RE_AUTHENTICATE_MESSAGE);
      return;
    }
    if (error instanceof HttpErrorResponse && error.status === 404) {
      this.loadError.set('Profil professionnel introuvable pour votre compte.');
      return;
    }
    this.loadError.set('Impossible de charger le profil professionnel.');
  }

  private reloadAfterSave(): void {
    this.api
      .getProfile()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (profile) => {
          this.applyProfile(profile);
          this.saved.set('Profil mis a jour.');
        },
        error: () => this.saved.set('Profil enregistre, mais impossible de le recharger.'),
      });
  }

  private handleSaveError(error: unknown): void {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 403) {
        this.authError.set(RE_AUTHENTICATE_MESSAGE);
        return;
      }
      if (error.status === 404) {
        this.saveError.set('Profil professionnel introuvable. Veuillez contacter le support.');
        return;
      }
      const body = error.error as ApiErrorBody | null;
      if (error.status === 400 && body !== null) {
        if (body.fieldErrors !== undefined) this.applyBackendFieldErrors(body.fieldErrors);
        this.saveError.set(body.message ?? 'Donnees invalides. Corrigez les champs puis reessayez.');
        return;
      }
    }
    this.saveError.set('Unable to save the profile. Please try again.');
  }

  private applyBackendFieldErrors(errors: Readonly<Record<string, string>>): void {
    this.fieldErrors.update((fieldErrors) => {
      const next: ProfessionalProfileFieldErrors = { ...fieldErrors };
      for (const [key, message] of Object.entries(errors)) {
        if ((EDITABLE_FIELDS as readonly string[]).includes(key)) {
          next[key as EditableProfessionalProfileField] = message;
        }
      }
      return next;
    });
  }

  private clearFieldError(field: EditableProfessionalProfileField): void {
    this.fieldErrors.update((fieldErrors) => {
      if (fieldErrors[field] === undefined) return fieldErrors;
      const next: ProfessionalProfileFieldErrors = { ...fieldErrors };
      delete next[field];
      return next;
    });
  }

  private markDirty(): void {
    this.saved.set(null);
    this.saveError.set(null);
  }
}

function mfaLabel(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  return MFA_METHOD_LABELS[value.toLowerCase()] ?? value;
}