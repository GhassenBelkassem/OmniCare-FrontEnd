import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs/operators';

import { AuthService } from '../../../core/auth/auth.service';
import {
  OcAvatar,
  OcButton,
  OcCard,
  OcEmptyState,
  OcField,
  OcIcon,
  OcSkeleton,
  OcStatusBadge,
  OcSwitch,
  OcTagInput,
  OcTextarea,
} from '../../../shared/ui';
import { MeProfessionalProfileResponse } from './professional-profile-api.models';
import { ProfessionalProfileApiService } from './professional-profile-api.service';
import {
  RE_AUTHENTICATE_MESSAGE,
  STALE_PROFILE_MESSAGE,
  isAuthenticationError,
  isConflict,
  isNetworkError,
  isValidationError,
  problemDetails,
} from './professional-profile-errors';
import { ProfessionalQualificationsSection } from './professional-qualifications-section';
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
interface ManagedField {
  readonly key: 'professionalLicenseNumber' | 'verifiedAt' | 'governorate' | 'alsoIndependent';
  readonly label: string;
}

const MANAGED_FIELDS: readonly ManagedField[] = [
  { key: 'professionalLicenseNumber', label: 'Numéro de licence' },
  { key: 'governorate', label: 'Gouvernorat' },
  { key: 'verifiedAt', label: 'Vérifié le' },
  { key: 'alsoIndependent', label: 'Exercice indépendant' },
];

@Component({
  selector: 'app-professional-profile-section',
  imports: [
    FormsModule,
    OcAvatar,
    OcButton,
    OcCard,
    OcEmptyState,
    OcField,
    OcIcon,
    OcSkeleton,
    OcStatusBadge,
    OcSwitch,
    OcTagInput,
    OcTextarea,
    ProfessionalQualificationsSection,
  ],
  templateUrl: './professional-profile-section.html',
  styleUrl: './professional-profile-section.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfessionalProfileSection {
  private readonly api = inject(ProfessionalProfileApiService);
  private readonly auth = inject(AuthService);
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
  readonly conflict = signal(false);
  readonly avatarFailed = signal(false);

  constructor() {
    this.loadProfile();
  }

  loadProfile(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.authError.set(null);
    this.api
      .getProfile()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
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

  save(): void {
    if (this.saving() || this.conflict()) return;
    const baseline = this.profile();
    if (baseline === null) return;

    const errors = validateDraft(this.draft());
    this.fieldErrors.set(errors);
    if (hasFieldErrors(errors)) {
      this.saved.set(null);
      this.saveError.set("Corrigez les erreurs indiquees avant d'enregistrer.");
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
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
        next: (profile) => {
          this.applyProfile(profile);
          this.saved.set('Profil mis à jour.');
        },
        error: (error: unknown) => this.handleSaveError(error),
      });
  }

  reloadServerProfile(): void {
    this.loadProfile();
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
        return profile.verifiedAt !== null && profile.verifiedAt !== ''
          ? profile.verifiedAt.slice(0, 10)
          : '—';
      default:
        return profile[key] ?? '—';
    }
  }

  identityName(): string {
    const profile = this.profile();
    if (profile === null) return 'Médecin';
    return (
      profile.displayName?.trim() ||
      [profile.firstName, profile.lastName]
        .filter((value) => value !== null && value.trim() !== '')
        .join(' ') ||
      'Médecin'
    );
  }

  identityLegalName(): string {
    const profile = this.profile();
    if (profile === null) return '—';
    return (
      [profile.firstName, profile.lastName]
        .filter((value) => value !== null && value.trim() !== '')
        .join(' ') || '—'
    );
  }

  private applyProfile(profile: MeProfessionalProfileResponse): void {
    this.profile.set(profile);
    this.draft.set(draftFromProfile(profile));
    this.fieldErrors.set({});
    this.saveError.set(null);
    this.saved.set(null);
    this.conflict.set(false);
    this.avatarFailed.set(false);
  }

  private handleLoadError(error: unknown): void {
    if (isAuthenticationError(error)) {
      this.authError.set(RE_AUTHENTICATE_MESSAGE);
      return;
    }
    if (error instanceof HttpErrorResponse && error.status === 404) {
      this.loadError.set('Profil professionnel introuvable pour votre compte.');
      return;
    }
    this.loadError.set(
      isNetworkError(error)
        ? 'Connexion impossible. Vérifiez votre réseau puis réessayez.'
        : 'Impossible de charger le profil professionnel.',
    );
  }

  private handleSaveError(error: unknown): void {
    if (isAuthenticationError(error)) {
      this.authError.set(RE_AUTHENTICATE_MESSAGE);
      return;
    }
    if (isConflict(error)) {
      this.conflict.set(true);
      this.saveError.set(STALE_PROFILE_MESSAGE);
      return;
    }
    if (error instanceof HttpErrorResponse && error.status === 404) {
      this.saveError.set('Profil professionnel introuvable. Veuillez contacter le support.');
      return;
    }
    if (isValidationError(error)) {
      const body = problemDetails(error);
      if (body?.fieldErrors !== undefined) this.applyBackendFieldErrors(body.fieldErrors);
      this.saveError.set('Données invalides. Corrigez les champs puis réessayez.');
      return;
    }
    this.saveError.set(
      isNetworkError(error)
        ? 'Connexion impossible. Vérifiez votre réseau puis réessayez.'
        : 'Impossible d’enregistrer le profil. Réessayez.',
    );
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
